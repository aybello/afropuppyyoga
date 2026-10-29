import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), findMember: vi.fn(), send: vi.fn(), lock: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./apyAccess", () => ({ findActiveTeamMemberByEmail: mocks.findMember }));
vi.mock("./email", () => ({ sendStaffEmailAccessCode: mocks.send }));
vi.mock("./staffingMutationLock", () => ({ withStaffingMutationLock: mocks.lock }));

import {
  STAFF_EMAIL_CODE_TTL_MS,
  hashStaffEmailCode,
  requestStaffEmailAccessCode,
  verifyStaffEmailAccessCode,
} from "./staffEmailCodeAccess";

const member = {
  id: 41,
  name: "Fictional Manager",
  email: "manager@example.com",
  phone: "+12265550123",
  role: "Operations Manager",
  location: "KW",
  isTeamMember: true,
  status: "onboarded",
  deletedAt: null,
};
const owner = { openId: "owner-open-id", name: "Ay Bello", email: "belllo.ayoola@gmail.com", role: "admin" };

function fakeDb(reads: unknown[][]) {
  const select = vi.fn(() => {
    const result = reads.shift() ?? [];
    const query: any = {
      from: () => query,
      where: () => query,
      orderBy: () => query,
      limit: async () => result,
    };
    return query;
  });
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const db = {
    select,
    insert: vi.fn(() => ({ values: vi.fn(async (value) => { inserts.push(value); }) })),
    update: vi.fn(() => ({ set: (value: unknown) => { updates.push(value); return { where: vi.fn(async () => undefined) }; } })),
  };
  mocks.getDb.mockResolvedValue(db);
  mocks.lock.mockImplementation(async (_db, callback) => callback(db));
  return { db, inserts, updates };
}

describe("APY HQ email verification codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("JWT_SECRET", "email-code-test-secret");
    vi.stubEnv("OWNER_OPEN_ID", "owner-open-id");
    mocks.findMember.mockResolvedValue(member);
    mocks.send.mockResolvedValue(undefined);
  });

  it("sends a six-digit code only to an active staff member's own normalized email", async () => {
    const { inserts } = fakeDb([[member], []]);
    await expect(requestStaffEmailAccessCode(" Manager@Example.com ")).resolves.toEqual({ success: true });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual(expect.objectContaining({
      email: "manager@example.com",
      identityType: "staff",
      applicationId: 41,
      ownerOpenId: null,
      codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    }));
    const saved = inserts[0] as { expiresAt: Date };
    expect(saved.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(STAFF_EMAIL_CODE_TTL_MS);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "manager@example.com",
      name: member.name,
      code: expect.stringMatching(/^\d{6}$/),
    }));
  });

  it("sends a six-digit code to the configured owner's own saved email and binds it to the owner identity", async () => {
    mocks.findMember.mockResolvedValue(null);
    const { inserts } = fakeDb([[owner], [owner], []]);
    await expect(requestStaffEmailAccessCode(" BELLLO.AYOOla@gmail.com ")).resolves.toEqual({ success: true });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual(expect.objectContaining({
      email: "belllo.ayoola@gmail.com",
      identityType: "owner",
      applicationId: null,
      ownerOpenId: "owner-open-id",
    }));
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "belllo.ayoola@gmail.com", code: expect.stringMatching(/^\d{6}$/) }));
  });

  it("does not send a code to an unknown email", async () => {
    mocks.findMember.mockResolvedValue(null);
    fakeDb([[]]);
    await expect(requestStaffEmailAccessCode("unknown@example.com")).resolves.toEqual({ success: true });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send a second code during the one-minute cooldown", async () => {
    const { inserts } = fakeDb([[member], [{ createdAt: new Date() }]]);
    await expect(requestStaffEmailAccessCode(member.email)).resolves.toEqual({ success: true });
    expect(inserts).toEqual([]);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("revokes the new code when email delivery fails", async () => {
    const { updates } = fakeDb([[member], []]);
    mocks.send.mockRejectedValue(new Error("delivery failure"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(requestStaffEmailAccessCode(member.email)).resolves.toEqual({ success: true });
    expect(updates).toEqual([{ consumedAt: expect.any(Date) }]);
    warning.mockRestore();
  });

  it("creates an admin owner session identity only after the current saved owner email code is verified", async () => {
    mocks.findMember.mockResolvedValue(null);
    const code = "123456";
    const record = {
      id: 7,
      email: owner.email,
      identityType: "owner",
      applicationId: null,
      ownerOpenId: owner.openId,
      codeHash: hashStaffEmailCode(owner.email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };
    const { updates } = fakeDb([[owner], [record], [owner]]);
    await expect(verifyStaffEmailAccessCode(owner.email, code)).resolves.toEqual({
      kind: "owner",
      applicationId: null,
      ownerOpenId: owner.openId,
      email: owner.email,
      name: "Ay Bello",
      openId: owner.openId,
      role: "admin",
    });
    expect(updates).toEqual([expect.objectContaining({ consumedAt: expect.any(Date), attempts: 1 })]);
  });

  it("rejects a wrong code and increments only its active attempt counter", async () => {
    const code = "123456";
    const record = {
      id: 7,
      email: member.email,
      identityType: "staff",
      applicationId: member.id,
      ownerOpenId: null,
      codeHash: hashStaffEmailCode(member.email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };
    const { updates } = fakeDb([[record]]);
    await expect(verifyStaffEmailAccessCode(member.email, "654321")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([{ attempts: 1 }]);
  });

  it("rejects a code that has already reached the five-attempt limit without another write", async () => {
    const record = {
      id: 7,
      email: member.email,
      identityType: "staff",
      applicationId: member.id,
      ownerOpenId: null,
      codeHash: hashStaffEmailCode(member.email, "123456"),
      attempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };
    const { updates } = fakeDb([[record]]);
    await expect(verifyStaffEmailAccessCode(member.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([]);
  });

  it("rejects a previously issued staff code when the active profile is no longer eligible", async () => {
    const code = "123456";
    const record = {
      id: 7,
      email: member.email,
      identityType: "staff",
      applicationId: member.id,
      ownerOpenId: null,
      codeHash: hashStaffEmailCode(member.email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };
    const { updates } = fakeDb([[record], [{ ...member, isTeamMember: false }]]);
    await expect(verifyStaffEmailAccessCode(member.email, code)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([]);
  });
});
