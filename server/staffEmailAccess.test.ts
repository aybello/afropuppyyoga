import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), findMember: vi.fn(), send: vi.fn(), lock: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./apyAccess", () => ({ findActiveTeamMemberByEmail: mocks.findMember }));
vi.mock("./email", () => ({ sendStaffSignInEmail: mocks.send }));
vi.mock("./staffingMutationLock", () => ({ withStaffingMutationLock: mocks.lock }));
import { consumeStaffEmailSignIn, requestStaffEmailAccess, STAFF_EMAIL_SIGN_IN_TTL_MS } from "./staffEmailAccess";
const member = { id: 41, name: "Fictional Manager", email: "manager@example.com", phone: "+12265550123", role: "Operations Manager", location: "KW", isTeamMember: true, status: "onboarded", deletedAt: null };
function fakeDb(reads: any[][]) {
  const select = vi.fn(() => {
    const result = reads.shift() ?? [];
    const q: any = { from: () => q, where: () => q, orderBy: () => q, limit: async () => result };
    return q;
  });
  const values = vi.fn(async () => undefined);
  const sets: any[] = [];
  const update = vi.fn(() => ({ set: (v: any) => { sets.push(v); return { where: vi.fn(async () => undefined) }; } }));
  const db = { select, insert: vi.fn(() => ({ values })), update };
  mocks.getDb.mockResolvedValue(db);
  mocks.lock.mockImplementation(async (_db, cb) => cb(db));
  return { db, values, sets };
}
describe("self-service staff email sign-in", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findMember.mockResolvedValue(member); mocks.send.mockResolvedValue(undefined); });
  it("sends only to the active manager's own normalized email, with a 15-minute link and safe origin", async () => {
    const { values } = fakeDb([[member], []]);
    const result = await requestStaffEmailAccess(" Manager@Example.com ", "https://attacker.example");
    expect(result).toEqual({ success: true });
    expect(mocks.findMember).toHaveBeenCalledWith("manager@example.com");
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 41, email: "manager@example.com", token: expect.stringMatching(/^signin_[a-f0-9]{96}$/), isActive: 1 }));
    const saved = values.mock.calls[0][0] as any;
    expect(saved.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(STAFF_EMAIL_SIGN_IN_TTL_MS);
    expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(STAFF_EMAIL_SIGN_IN_TTL_MS - 5000);
    expect(mocks.send).toHaveBeenCalledWith({ to: "manager@example.com", name: member.name, magicLink: `https://afropuppyyoga.ca/staff-login?token=${saved.token}` });
    expect(result).not.toHaveProperty("token");
  });
  it("does not fall back to the owner for an unknown or inactive email", async () => {
    mocks.findMember.mockResolvedValue(null);
    expect(await requestStaffEmailAccess("unknown@example.com")).toEqual({ success: true });
    expect(mocks.getDb).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([{ ...member, isTeamMember: false }, { ...member, deletedAt: new Date() }, { ...member, email: "changed@example.com" }])("rechecks the saved profile before sending", async (profile) => {
    const { values } = fakeDb([[profile]]);
    await requestStaffEmailAccess("manager@example.com");
    expect(values).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("silently cools down requests for the same saved staff account", async () => {
    const { values } = fakeDb([[member], [{ createdAt: new Date() }]]);
    expect(await requestStaffEmailAccess("manager@example.com")).toEqual({ success: true });
    expect(values).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("caps email sends at five requests per 15 minutes", async () => {
    const { values } = fakeDb([[member], Array.from({ length: 5 }, (_, i) => ({ createdAt: new Date(Date.now() - (i + 1) * 90000) }))]);
    await requestStaffEmailAccess("manager@example.com");
    expect(values).not.toHaveBeenCalled();
  });
  it("revokes only the new link after delivery failure and keeps the public result generic", async () => {
    const { sets } = fakeDb([[member], []]); mocks.send.mockRejectedValue(new Error("mock delivery failure"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await requestStaffEmailAccess("manager@example.com")).toEqual({ success: true });
    expect(sets).toEqual([{ isActive: 0 }]); warn.mockRestore();
  });
  it("consumes a new sign-in link once and uses the current name and saved email", async () => {
    const invite = { id: 7, applicationId: 41, email: member.email, name: "Old name", isActive: 1, firstUsedAt: null, expiresAt: new Date(Date.now() + 60000) };
    const { sets } = fakeDb([[invite], [member]]);
    expect(await consumeStaffEmailSignIn("signin_test")).toEqual({ name: member.name, email: member.email });
    expect(sets).toEqual([expect.objectContaining({ isActive: 0, firstUsedAt: expect.any(Date), lastUsedAt: expect.any(Date) })]);
  });
  it.each([
    { isActive: 0 }, { firstUsedAt: new Date() }, { expiresAt: new Date(0) }, { applicationId: null },
  ])("rejects used, expired or unbound links", async (override) => {
    const { sets } = fakeDb([[{ id: 7, applicationId: 41, email: member.email, isActive: 1, firstUsedAt: null, expiresAt: new Date(Date.now() + 60000), ...override }]]);
    await expect(consumeStaffEmailSignIn("signin_test")).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(sets).toEqual([]);
  });
  it.each([{ ...member, isTeamMember: false }, { ...member, email: "other@example.com" }])("rejects links after staff removal or saved email changes", async (profile) => {
    const { sets } = fakeDb([[{ id: 7, applicationId: 41, email: member.email, isActive: 1, firstUsedAt: null, expiresAt: new Date(Date.now() + 60000) }], [profile]]);
    await expect(consumeStaffEmailSignIn("signin_test")).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(sets).toEqual([]);
  });
});
