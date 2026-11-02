import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findPhone: vi.fn(), findEmail: vi.fn(), sendSms: vi.fn(), getDb: vi.fn(), requestEmail: vi.fn(), consumeEmail: vi.fn(), requestEmailCode: vi.fn(), verifyEmailCode: vi.fn(), recheckOwner: vi.fn(), upsert: vi.fn(), session: vi.fn(), oldInvite: vi.fn() }));
vi.mock("twilio", () => ({ default: () => ({ messages: { create: mocks.sendSms } }) }));
vi.mock("../apyAccess", () => ({ findActiveTeamMemberByPhone: mocks.findPhone, findActiveTeamMemberByEmail: mocks.findEmail, resolveApyAccess: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb, upsertUser: mocks.upsert, getStaffInviteByToken: mocks.oldInvite, createStaffInvite: vi.fn(), getAllActiveStaff: vi.fn(), updateStaffInvite: vi.fn() }));
vi.mock("../email", () => ({ sendStaffInviteEmail: vi.fn() }));
vi.mock("../staffEmailAccess", () => ({ requestStaffEmailAccess: mocks.requestEmail, consumeStaffEmailSignIn: mocks.consumeEmail, STAFF_EMAIL_SIGN_IN_PREFIX: "signin_" }));
vi.mock("../staffEmailCodeAccess", () => ({ requestStaffEmailAccessCode: mocks.requestEmailCode, verifyStaffEmailAccessCode: mocks.verifyEmailCode, recheckOwnerEmailSession: mocks.recheckOwner }));
vi.mock("../_core/sdk", () => ({ sdk: { createSessionToken: mocks.session } }));
import { staffRouter } from "./staff";
import { hashStaffPhoneCode } from "../staffPhoneAccess";
const cookie = vi.fn();
const ctx = { user: null, req: { headers: {}, protocol: "https" }, res: { cookie } } as any;
const member = { id: 42, name: "Fictional Manager", email: "manager@example.com", phone: "+12265550123", role: "Operations Manager", location: "KW" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TWILIO_ACCOUNT_SID", "fake-account"); vi.stubEnv("TWILIO_AUTH_TOKEN", "fake-auth"); vi.stubEnv("TWILIO_PHONE_NUMBER", "+14165550100"); vi.stubEnv("OWNER_PHONE_NUMBER", "+12895550999"); vi.stubEnv("JWT_SECRET", "fake-otp-secret");
  mocks.findPhone.mockResolvedValue(member); mocks.sendSms.mockResolvedValue({}); mocks.requestEmail.mockResolvedValue({ success: true }); mocks.consumeEmail.mockResolvedValue({ name: member.name, email: member.email }); mocks.requestEmailCode.mockResolvedValue({ success: true }); mocks.verifyEmailCode.mockResolvedValue({ kind: "staff", openId: "staff:manager@example.com", name: member.name, email: member.email, role: "staff" }); mocks.recheckOwner.mockResolvedValue("a".repeat(64)); mocks.session.mockResolvedValue("fake-session"); mocks.upsert.mockResolvedValue(undefined);
});
function dbWithCodeRows(rows: any[]) {
  const q: any = { from: () => q, where: () => q, orderBy: () => q, limit: async () => rows };
  const values = vi.fn(async () => undefined); mocks.getDb.mockResolvedValue({ select: () => q, insert: () => ({ values }) }); return values;
}
function dbForPhoneVerification(phone: string) {
  const record = { id: 1, attempts: 0, codeHash: hashStaffPhoneCode(phone, "123456") };
  const codeQuery: any = { from: () => codeQuery, where: () => codeQuery, orderBy: () => codeQuery, limit: async () => [record] };
  const ownerQuery: any = { from: () => ownerQuery, where: () => ownerQuery, orderBy: async () => [] };
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  let selectCount = 0;
  mocks.getDb.mockResolvedValue({ select: () => selectCount++ === 0 ? codeQuery : ownerQuery, update: () => ({ set: updateSet }) });
  return { updateSet };
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
  it("preserves the owner's saved email when verifying the owner phone code", async () => {
    const phone = "+12895550999";
    vi.stubEnv("OWNER_OPEN_ID", "owner-open-id");
    vi.stubEnv("OWNER_NAME", "Owner Name");
    mocks.findPhone.mockResolvedValue(null);
    const { updateSet } = dbForPhoneVerification(phone);

    await expect(staffRouter.createCaller(ctx).verifyPhoneAccessCode({ phone, code: "123456" })).resolves.toEqual({ success: true, name: "Owner Name", role: "Owner" });
    expect(updateSet).toHaveBeenCalledWith({ consumedAt: expect.any(Date), attempts: 1 });
    expect(mocks.upsert).toHaveBeenCalledWith({ openId: "owner-open-id", name: "Owner Name", loginMethod: "phone_otp", role: "admin", lastSignedIn: expect.any(Date) });
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty("email");
    expect(mocks.session).toHaveBeenCalledWith("owner-open-id", expect.objectContaining({ name: "Owner Name" }));
    expect(cookie).toHaveBeenCalledOnce();
  });
  it.each([member.email, null])("keeps staff phone sign-in email semantics for email %s", async (email) => {
    mocks.findPhone.mockResolvedValue({ ...member, email });
    const { updateSet } = dbForPhoneVerification(member.phone);

    await expect(staffRouter.createCaller(ctx).verifyPhoneAccessCode({ phone: member.phone, code: "123456" })).resolves.toEqual({ success: true, name: member.name, role: member.role });
    expect(updateSet).toHaveBeenCalledWith({ consumedAt: expect.any(Date), attempts: 1 });
    expect(mocks.upsert).toHaveBeenCalledWith({ openId: `staff-phone:${member.phone}`, name: member.name, email, loginMethod: "phone_otp", role: "staff", lastSignedIn: expect.any(Date) });
    expect(mocks.session).toHaveBeenCalledWith(`staff-phone:${member.phone}`, expect.objectContaining({ name: member.name }));
    expect(cookie).toHaveBeenCalledOnce();
  });
  it("passes the submitted personal email to self-service without changing roles", async () => {
    await staffRouter.createCaller(ctx).requestEmailAccessLink({ email: " manager@example.com ", origin: "https://afropuppyyoga.ca" });
    expect(mocks.requestEmail).toHaveBeenCalledWith(member.email, "https://afropuppyyoga.ca"); expect(mocks.upsert).not.toHaveBeenCalled(); expect(cookie).not.toHaveBeenCalled();
  });
  it("issues an admin session after father verifies his own email code", async () => {
    mocks.verifyEmailCode.mockResolvedValue({ kind: "owner", openId: "owner-open-id", name: "Ay Bello", email: "belllo.ayoola@gmail.com", role: "admin" });
    await expect(staffRouter.createCaller(ctx).verifyEmailAccessCode({ email: "belllo.ayoola@gmail.com", code: "123456" })).resolves.toEqual({ success: true, name: "Ay Bello", role: "Owner" });
    expect(mocks.verifyEmailCode).toHaveBeenCalledWith("belllo.ayoola@gmail.com", "123456");
    expect(mocks.recheckOwner).toHaveBeenCalledWith("owner-open-id", "belllo.ayoola@gmail.com");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.session).toHaveBeenCalledWith("owner-open-id", expect.objectContaining({ name: "Ay Bello", ownerEmailOtp: true, ownerEmailFingerprint: "a".repeat(64) }));
    expect(cookie).toHaveBeenCalledOnce();
  });
  it("issues no owner session or promotion if demoted after code verification", async () => {
    mocks.verifyEmailCode.mockResolvedValue({ kind: "owner", openId: "owner-open-id", name: "Ay Bello", email: "owner@example.com", role: "admin" });
    mocks.recheckOwner.mockResolvedValue(null);
    await expect(staffRouter.createCaller(ctx).verifyEmailAccessCode({ email: "owner@example.com", code: "123456" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled(); expect(cookie).not.toHaveBeenCalled();
  });
  it("keeps staff email-code sign-in unchanged", async () => {
    await staffRouter.createCaller(ctx).verifyEmailAccessCode({ email: member.email, code: "123456" });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ openId: `staff:${member.email}`, role: "staff", loginMethod: "email_otp" }));
    expect(mocks.recheckOwner).not.toHaveBeenCalled(); expect(cookie).toHaveBeenCalledOnce();
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
