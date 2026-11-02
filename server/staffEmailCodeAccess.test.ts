import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

// A synthetic subject is mapped to the production pin; no real subject is embedded.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHash: (algorithm: string) => {
    const hash = actual.createHash(algorithm); let value = "";
    const wrapper = { update(input: string) { value += input; hash.update(input); return wrapper; },
      digest(encoding: "hex") { return value === "owner-open-id" ? "48a298ad24d31a86dfdaf645ab845f97499dfad52b4250b9bf666182b7c5d2e3" : hash.digest(encoding); } };
    return wrapper;
  } };
});

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), findMember: vi.fn(), send: vi.fn(), lock: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./apyAccess", () => ({ findActiveTeamMemberByEmail: mocks.findMember }));
vi.mock("./email", () => ({ sendStaffEmailAccessCode: mocks.send }));
vi.mock("./staffingMutationLock", () => ({ withStaffingMutationLock: mocks.lock }));

import {
  STAFF_EMAIL_CODE_TTL_MS,
  hashStaffEmailCode,
  recheckOwnerEmailSession,
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
    let result: unknown[] = [];
    const query: any = {
      from: () => { result = reads.shift() ?? []; return query; },
      where: () => query,
      then: (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve),
      orderBy: () => query,
      limit: async () => result,
    };
    return query;
  });
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const predicates: any[] = [];
  const db = {
    select,
    insert: vi.fn(() => ({ values: vi.fn(async (value) => { inserts.push(value); return [{ insertId: 123 }]; }) })),
    update: vi.fn(() => ({ set: (value: unknown) => { updates.push(value); return { where: vi.fn(async (predicate) => { predicates.push(predicate); return [{ affectedRows: 1 }]; }) }; } })),
  };
  mocks.getDb.mockResolvedValue(db);
  mocks.lock.mockImplementation(async (_db, callback) => callback(db));
  return { db, inserts, updates, predicates };
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

  it("resolves the unique pinned admin when configuration is absent, even among other admins", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    mocks.findMember.mockResolvedValue(null);
    const candidates = [{ ...owner, openId: "another-admin" }, owner];
    const { inserts } = fakeDb([candidates, candidates, []]);
    await requestStaffEmailAccessCode(owner.email);
    expect(inserts[0]).toEqual(expect.objectContaining({ identityType: "owner", ownerOpenId: owner.openId }));
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it.each(["owner-open-id", ""])("never sends owner codes to an altered DB recovery email with config %j", async (configuredId) => {
    vi.stubEnv("OWNER_OPEN_ID", configuredId);
    mocks.findMember.mockResolvedValue(null);
    const changedOwner = { ...owner, email: "attacker@example.com" };
    const { inserts } = fakeDb([[changedOwner]]);
    await expect(requestStaffEmailAccessCode(changedOwner.email)).resolves.toEqual({ success: true });
    expect(inserts).toEqual([]);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not issue a code if the owner recovery address changes during the locked recheck", async () => {
    mocks.findMember.mockResolvedValue(null);
    const { inserts } = fakeDb([[owner], [{ ...owner, email: "attacker@example.com" }]]);
    await expect(requestStaffEmailAccessCode(owner.email)).resolves.toEqual({ success: true });
    expect(inserts).toEqual([]);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects an altered recovery address at verification and before signing a session", async () => {
    mocks.findMember.mockResolvedValue(null);
    const changedOwner = { ...owner, email: "attacker@example.com" };
    const { updates } = fakeDb([[changedOwner], [changedOwner]]);
    await expect(verifyStaffEmailAccessCode(changedOwner.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(recheckOwnerEmailSession(owner.openId, changedOwner.email)).resolves.toBeNull();
    expect(updates).toEqual([]);
  });

  it("does not consume a correct code if the recovery email changes during verification", async () => {
    mocks.findMember.mockResolvedValue(null);
    const record = { id: 7, identityType: "owner", applicationId: null, ownerOpenId: owner.openId,
      codeHash: hashStaffEmailCode(owner.email, "123456"), attempts: 0, consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000) };
    const { updates } = fakeDb([[owner], [record], [{ ...owner, email: "attacker@example.com" }]]);
    await expect(verifyStaffEmailAccessCode(owner.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([]);
  });

  it.each([
    { platform: "wrong-owner", users: [owner], email: owner.email },
    { platform: " ", users: [owner], email: owner.email },
    { platform: owner.openId, users: [], email: owner.email },
    { platform: owner.openId, users: [{ ...owner, openId: "OWNER-OPEN-ID" }], email: owner.email },
    { platform: "", users: [{ ...owner, role: "user" }], email: owner.email },
    { platform: "", users: [{ ...owner, openId: "other-admin" }], email: owner.email },
    { platform: "", users: [owner, owner], email: owner.email },
    { platform: "", users: [owner, { ...owner, email: "attacker@example.com" }], email: owner.email },
    { platform: "", users: [owner], email: "attacker@example.com" },
  ])("rejects conflicting, absent, ineligible, ambiguous or unrelated owner %#", async ({ platform, users, email }) => {
    vi.stubEnv("OWNER_OPEN_ID", platform);
    mocks.findMember.mockResolvedValue(null);
    const { inserts } = fakeDb([users]);
    await expect(requestStaffEmailAccessCode(email)).resolves.toEqual({ success: true });
    expect(inserts).toEqual([]);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects a previously issued code bound to a different subject", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    mocks.findMember.mockResolvedValue(null);
    const record = { id: 7, identityType: "owner", applicationId: null, ownerOpenId: "previous-owner", codeHash: hashStaffEmailCode(owner.email, "123456"), attempts: 0 };
    const { updates } = fakeDb([[owner], [record]]);
    await expect(verifyStaffEmailAccessCode(owner.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([]);
  });

  it("rechecks owner eligibility after a correct code before consuming it", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    mocks.findMember.mockResolvedValue(null);
    const record = { id: 7, identityType: "owner", applicationId: null, ownerOpenId: owner.openId, codeHash: hashStaffEmailCode(owner.email, "123456"), attempts: 0 };
    const { updates } = fakeDb([[owner], [record], [{ ...owner, role: "user" }]]);
    await expect(verifyStaffEmailAccessCode(owner.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([]);
  });

  it("verifies an owner code using the pinned subject without configuration", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    mocks.findMember.mockResolvedValue(null);
    const record = { id: 7, identityType: "owner", applicationId: null, ownerOpenId: owner.openId, codeHash: hashStaffEmailCode(owner.email, "123456"), attempts: 0 };
    const { updates } = fakeDb([[owner], [record], [owner]]);
    await expect(verifyStaffEmailAccessCode(owner.email, "123456")).resolves.toMatchObject({ kind: "owner", openId: owner.openId });
    expect(updates).toEqual([expect.objectContaining({ consumedAt: expect.any(Date) })]);
  });

  it("rejects if the owner subject changes during verification", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    mocks.findMember.mockResolvedValue(null);
    const record = { id: 7, identityType: "owner", applicationId: null, ownerOpenId: owner.openId, codeHash: hashStaffEmailCode(owner.email, "123456"), attempts: 0 };
    const { updates } = fakeDb([[owner], [record], [{ ...owner, openId: "new-owner" }]]);
    await expect(verifyStaffEmailAccessCode(owner.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([]);
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
    expect(updates).toEqual([{ consumedAt: expect.any(Date) }, { consumedAt: expect.any(Date) }]);
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
    expect(updates).toEqual([expect.objectContaining({ consumedAt: expect.any(Date), attempts: expect.anything() })]);
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
    expect(updates).toEqual([{ attempts: expect.anything() }]);
  });

  it("commits five wrong-code attempts and rejects the valid code once locked", async () => {
    const code = "123456";
    let record = {
      id: 7,
      email: member.email,
      identityType: "staff",
      applicationId: member.id,
      ownerOpenId: null,
      codeHash: hashStaffEmailCode(member.email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null as Date | null,
    };
    const db = {};
    const writes = vi.fn();
    mocks.getDb.mockResolvedValue(db);
    mocks.lock.mockImplementation(async (_db, callback) => {
      // Stage changes on a transaction-local copy; an exception discards them.
      let staged = { ...record };
      const tx = {
        select: () => {
          const query: any = {
            from: () => query,
            where: () => query,
            orderBy: () => query,
            limit: async () => [{ ...staged }],
          };
          return query;
        },
        update: () => ({ set: (value: Partial<typeof record>) => ({
          where: async () => { writes(value); staged = { ...staged, ...value, attempts: staged.attempts + 1 }; return [{ affectedRows: 1 }]; },
        }) }),
      };
      const result = await callback(tx);
      record = staged;
      return result;
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
      await expect(verifyStaffEmailAccessCode(member.email, "654321")).rejects.toMatchObject({
        code: "UNAUTHORIZED", message: "That code is invalid or expired.",
      });
      expect(record.attempts).toBe(attempt);
      expect(record.consumedAt).toBeNull();
    }
    await expect(verifyStaffEmailAccessCode(member.email, code)).rejects.toMatchObject({
      code: "UNAUTHORIZED", message: "That code is invalid or expired.",
    });
    expect(record.attempts).toBe(5);
    expect(record.consumedAt).toBeNull();
    expect(writes).toHaveBeenCalledTimes(5);
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
  it("retirement and delayed failure target only the issued row", async () => {
    const { predicates } = fakeDb([[member], []]);
    mocks.send.mockRejectedValue(new Error("delayed failure"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await requestStaffEmailAccessCode(member.email);
    const dialect = new MySqlDialect();
    const retirement = dialect.sqlToQuery(predicates[0]);
    const cleanup = dialect.sqlToQuery(predicates[1]);
    expect(retirement.sql).toContain("`email`");
    expect(cleanup.sql).toContain("`id`");
    expect(cleanup.params).toEqual([123]);
    warning.mockRestore();
  });

  it("passes the locked transaction to staff lookup", async () => {
    const { db } = fakeDb([[{ id: 7, identityType: "staff", applicationId: member.id, ownerOpenId: null,
      codeHash: hashStaffEmailCode(member.email, "123456"), attempts: 0, consumedAt: null,
      expiresAt: new Date(Date.now() + 60000) }], [member]]);
    await verifyStaffEmailAccessCode(member.email, "123456");
    expect(mocks.findMember).toHaveBeenCalledWith(member.email, db);
  });

  it("rejects a consumed newest challenge rather than reviving an older code", async () => {
    const record = { id: 8, identityType: "staff", applicationId: member.id, ownerOpenId: null,
      codeHash: hashStaffEmailCode(member.email, "123456"), attempts: 1, consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000) };
    const { updates } = fakeDb([[record]]);
    await expect(verifyStaffEmailAccessCode(member.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(updates).toEqual([]);
  });

  it("never issues an identity when the conditional consume loses a race", async () => {
    const record = { id: 8, identityType: "staff", applicationId: member.id, ownerOpenId: null,
      codeHash: hashStaffEmailCode(member.email, "123456"), attempts: 0, consumedAt: null,
      expiresAt: new Date(Date.now() + 60000) };
    const { db } = fakeDb([[record], [member]]);
    db.update.mockReturnValueOnce({ set: () => ({ where: async () => [{ affectedRows: 0 }] }) } as any);
    await expect(verifyStaffEmailAccessCode(member.email, "123456")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

});
