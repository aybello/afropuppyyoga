import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findPhone: vi.fn(), findEmail: vi.fn(), sendSms: vi.fn(), getDb: vi.fn(), requestEmail: vi.fn(), consumeEmail: vi.fn(), upsert: vi.fn(), session: vi.fn(), oldInvite: vi.fn() }));
vi.mock("twilio", () => ({ default: () => ({ messages: { create: mocks.sendSms } }) }));
vi.mock("../apyAccess", () => ({ findActiveTeamMemberByPhone: mocks.findPhone, findActiveTeamMemberByEmail: mocks.findEmail, resolveApyAccess: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb, upsertUser: mocks.upsert, getStaffInviteByToken: mocks.oldInvite, createStaffInvite: vi.fn(), getAllActiveStaff: vi.fn(), updateStaffInvite: vi.fn() }));
vi.mock("../email", () => ({ sendStaffInviteEmail: vi.fn() }));
vi.mock("../staffEmailAccess", () => ({ requestStaffEmailAccess: mocks.requestEmail, consumeStaffEmailSignIn: mocks.consumeEmail, STAFF_EMAIL_SIGN_IN_PREFIX: "signin_" }));
vi.mock("../_core/sdk", () => ({ sdk: { createSessionToken: mocks.session } }));
import { staffRouter } from "./staff";
const cookie = vi.fn();
const ctx = { user: null, req: { headers: {}, protocol: "https" }, res: { cookie } } as any;
const member = { id: 42, name: "Fictional Manager", email: "manager@example.com", phone: "+12265550123", role: "Operations Manager", location: "KW" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "fake-account"); vi.stubEnv("TWILIO_AUTH_TOKEN", "fake-auth"); vi.stubEnv("TWILIO_PHONE_NUMBER", "+14165550100"); vi.stubEnv("OWNER_PHONE_NUMBER", "+12895550999"); vi.stubEnv("JWT_SECRET", "fake-otp-secret");
  mocks.findPhone.mockResolvedValue(member); mocks.sendSms.mockResolvedValue({}); mocks.requestEmail.mockResolvedValue({ success: true }); mocks.consumeEmail.mockResolvedValue({ name: member.name, email: member.email }); mocks.session.mockResolvedValue("fake-session"); mocks.upsert.mockResolvedValue(undefined);
});
function dbWithCodeRows(rows: any[]) {
  const q: any = { from: () => q, where: () => q, orderBy: () => q, limit: async () => rows };
  const values = vi.fn(async () => undefined); mocks.getDb.mockResolvedValue({ select: () => q, insert: () => ({ values }) }); return values;
}
describe("staff sign-in router", () => {
  it("texts the manager's submitted normalized phone, not the configured owner phone", async () => {
    const values = dbWithCodeRows([]);
    expect(await staffRouter.createCaller(ctx).requestPhoneAccessCode({ phone: "(226) 555-0123" })).toEqual({ success: true });
    expect(mocks.findPhone).toHaveBeenCalledWith(member.phone);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ phone: member.phone }));
    expect(mocks.sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: member.phone }));
    expect(mocks.sendSms.mock.calls[0][0].to).not.toBe(process.env.OWNER_PHONE_NUMBER);
  });
  it("does not text the owner as a fallback for an unknown staff number", async () => {
    mocks.findPhone.mockResolvedValue(null);
    expect(await staffRouter.createCaller(ctx).requestPhoneAccessCode({ phone: "2265550777" })).toEqual({ success: true });
    expect(mocks.sendSms).not.toHaveBeenCalled(); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("does not send a second SMS inside the existing cooldown", async () => {
    dbWithCodeRows([{ createdAt: new Date() }]);
    await staffRouter.createCaller(ctx).requestPhoneAccessCode({ phone: member.phone }); expect(mocks.sendSms).not.toHaveBeenCalled();
  });
  it("passes the submitted personal email to self-service without changing roles", async () => {
    await staffRouter.createCaller(ctx).requestEmailAccessLink({ email: " manager@example.com ", origin: "https://afropuppyyoga.ca" });
    expect(mocks.requestEmail).toHaveBeenCalledWith(member.email, "https://afropuppyyoga.ca"); expect(mocks.upsert).not.toHaveBeenCalled(); expect(cookie).not.toHaveBeenCalled();
  });
  it("creates a staff-only identity after the manager proves her own email", async () => {
    await staffRouter.createCaller(ctx).verifyMagicLink({ token: "signin_fake" });
    expect(mocks.consumeEmail).toHaveBeenCalledWith("signin_fake");
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ openId: "staff:manager@example.com", email: member.email, role: "staff" }));
    expect(mocks.oldInvite).not.toHaveBeenCalled(); expect(cookie).toHaveBeenCalledOnce();
  });
  it("sets no session when the new email link is expired or revoked", async () => {
    mocks.consumeEmail.mockRejectedValue(new Error("invalid"));
    await expect(staffRouter.createCaller(ctx).verifyMagicLink({ token: "signin_fake" })).rejects.toThrow("invalid");
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(cookie).not.toHaveBeenCalled();
  });
});
