import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const mocks = vi.hoisted(() => ({
  resolveApyAccess: vi.fn(),
  prepareHiringOffer: vi.fn(),
  recordCurrentOfferSignature: vi.fn(),
  getDb: vi.fn(),
  updateJobApplicationStatusIfUnclaimed: vi.fn(),
  sendOfferSigningEmail: vi.fn(),
  sendOfferSigningSms: vi.fn(),
  recordOfferSigningOutcome: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
vi.mock("./hiringOfferLifecycle", () => ({
  prepareHiringOffer: mocks.prepareHiringOffer,
  recordCurrentOfferSignature: mocks.recordCurrentOfferSignature,
}));
vi.mock("./db", () => ({
  createSigningToken: vi.fn(),
  getSigningTokenByToken: vi.fn(),
  updateSigningToken: vi.fn(),
  getSigningTokenByApplicationId: vi.fn(),
  getJobApplicationById: vi.fn(),
  updateJobApplication: vi.fn(),
  updateJobApplicationStatusIfUnclaimed: mocks.updateJobApplicationStatusIfUnclaimed,
  getDb: mocks.getDb,
}));
vi.mock("./email", () => ({ sendEmail: vi.fn() }));
vi.mock("./offerSigningEmail", () => ({ sendOfferSigningEmail: mocks.sendOfferSigningEmail }));
vi.mock("./offerSigningSms", () => ({ sendOfferSigningSms: mocks.sendOfferSigningSms }));
vi.mock("./offerSigningAudit", () => ({ recordOfferSigningOutcome: mocks.recordOfferSigningOutcome }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { signingRouter } from "./routers/signing";

const REQUEST_KEY = "123e4567-e89b-42d3-a456-426614174000";
const TOKEN = "a".repeat(96);
const LINK = `https://afropuppyyoga.ca/sign?token=${TOKEN}`;
const EXPIRES_AT = new Date("2027-02-03T17:45:00.000Z");
const actor = { id: 7, name: "Owner", email: "owner@example.com" };
const applicant = {
  id: 42,
  name: "Saved Applicant",
  email: "saved@example.com",
  phone: "+1 289 555 0101",
  role: "Yoga Instructor",
  location: "Hamilton",
  status: "new",
};
const prepared = {
  applicant,
  reuse: false,
  token: TOKEN,
  expiresAt: EXPIRES_AT,
  offerLetterType: "movement_instructor",
};
const input = { applicationId: applicant.id, requestKey: REQUEST_KEY };

function caller(user: typeof actor | null = actor) {
  return signingRouter.createCaller({
    user,
    res: { setHeader: vi.fn() },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveApyAccess.mockResolvedValue({ level: "owner", canManageOperations: true });
  mocks.getDb.mockResolvedValue({ source: "db" });
  mocks.prepareHiringOffer.mockResolvedValue(prepared);
  mocks.sendOfferSigningEmail.mockResolvedValue({ status: "sent" });
  mocks.sendOfferSigningSms.mockResolvedValue({ status: "queued", phone: "+12895550101" });
  mocks.updateJobApplicationStatusIfUnclaimed.mockResolvedValue(true);
  mocks.recordOfferSigningOutcome.mockResolvedValue({ recorded: true });
  mocks.notifyOwner.mockResolvedValue(undefined);
});

describe("signing.createSigningRequest", () => {
  it("uses real staff middleware and denies anonymous and ordinary staff before preparation", async () => {
    await expect(caller(null).createSigningRequest(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });

    mocks.resolveApyAccess.mockResolvedValue({ level: "team_member", canManageOperations: false });
    await expect(caller().createSigningRequest(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });

    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.prepareHiringOffer).not.toHaveBeenCalled();
    expect(mocks.sendOfferSigningEmail).not.toHaveBeenCalled();
    expect(mocks.sendOfferSigningSms).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed UUID request key before preparation", async () => {
    await expect(caller().createSigningRequest({ applicationId: applicant.id, requestKey: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().createSigningRequest({ applicationId: applicant.id, requestKey: "not-a-uuid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.prepareHiringOffer).not.toHaveBeenCalled();
  });

  it("uses the server-prepared token for the same link in both channels and the saved applicant phone", async () => {
    const result = await caller().createSigningRequest(input);

    expect(mocks.prepareHiringOffer).toHaveBeenCalledWith({ source: "db" }, applicant.id);
    expect(result).toMatchObject({ success: true, signingLink: LINK, expiresAt: EXPIRES_AT });
    expect(mocks.sendOfferSigningEmail).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: applicant.id,
      requestKey: REQUEST_KEY,
      actor,
      email: expect.objectContaining({ to: applicant.email, html: expect.stringContaining(LINK), text: expect.stringContaining(LINK) }),
    }));
    expect(mocks.sendOfferSigningSms).toHaveBeenCalledWith({
      applicationId: applicant.id,
      requestKey: REQUEST_KEY,
      actor,
      applicantName: applicant.name,
      role: applicant.role,
      phone: applicant.phone,
      signingLink: LINK,
    });
  });

  it("still attempts SMS when the email outcome is failed", async () => {
    mocks.sendOfferSigningEmail.mockResolvedValue({ status: "failed", reason: "provider rejected" });
    mocks.sendOfferSigningSms.mockResolvedValue({ status: "delivered", phone: "+12895550101" });

    await expect(caller().createSigningRequest(input)).resolves.toMatchObject({ success: true, email: { status: "failed" }, sms: { status: "delivered" } });
    expect(mocks.sendOfferSigningSms).toHaveBeenCalledOnce();
  });

  it("accepts email-only delivery and passes a missing saved phone to SMS", async () => {
    mocks.prepareHiringOffer.mockResolvedValue({ ...prepared, applicant: { ...applicant, phone: null } });
    mocks.sendOfferSigningSms.mockResolvedValue({ status: "skipped", reason: "No valid saved applicant phone number.", phone: null });

    await expect(caller().createSigningRequest(input)).resolves.toMatchObject({ success: true, email: { status: "sent" }, sms: { status: "skipped" } });
    expect(mocks.sendOfferSigningSms).toHaveBeenCalledWith(expect.objectContaining({ phone: null, signingLink: LINK }));
    expect(mocks.updateJobApplicationStatusIfUnclaimed).toHaveBeenCalledOnce();
  });

  it("does not change status, audit, or notify when neither channel is accepted", async () => {
    mocks.sendOfferSigningEmail.mockResolvedValue({ status: "unknown" });
    mocks.sendOfferSigningSms.mockResolvedValue({ status: "failed", phone: "+12895550101" });

    await expect(caller().createSigningRequest(input)).resolves.toMatchObject({ success: false });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).not.toHaveBeenCalled();
    expect(mocks.recordOfferSigningOutcome).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it.each(["queued", "sent", "delivered"])("treats SMS status %s as accepted", async (status) => {
    mocks.sendOfferSigningEmail.mockResolvedValue({ status: "failed" });
    mocks.sendOfferSigningSms.mockResolvedValue({ status, phone: "+12895550101" });

    await expect(caller().createSigningRequest(input)).resolves.toMatchObject({ success: true, sms: { status } });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).toHaveBeenCalledWith(applicant.id, applicant.status, "accepted");
    expect(mocks.recordOfferSigningOutcome).toHaveBeenCalledOnce();
  });

  it("returns success and a no-resend warning when status tracking loses its claim", async () => {
    mocks.updateJobApplicationStatusIfUnclaimed.mockResolvedValue(false);

    await expect(caller().createSigningRequest(input)).resolves.toMatchObject({ success: true, trackingWarning: expect.stringContaining("Do not resend") });
    expect(mocks.sendOfferSigningEmail).toHaveBeenCalledOnce();
    expect(mocks.sendOfferSigningSms).toHaveBeenCalledOnce();
    expect(mocks.recordOfferSigningOutcome).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("does not turn tracking exceptions into a send exception or resend", async () => {
    mocks.recordOfferSigningOutcome.mockRejectedValue(new Error("audit unavailable"));

    await expect(caller().createSigningRequest(input)).resolves.toMatchObject({ success: true, trackingWarning: expect.stringContaining("Do not resend") });
    expect(mocks.sendOfferSigningEmail).toHaveBeenCalledOnce();
    expect(mocks.sendOfferSigningSms).toHaveBeenCalledOnce();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("does not turn owner notification failure into an exception or resend", async () => {
    mocks.notifyOwner.mockRejectedValue(new Error("notification unavailable"));

    await expect(caller().createSigningRequest(input)).resolves.toMatchObject({ success: true });
    expect(mocks.sendOfferSigningEmail).toHaveBeenCalledOnce();
    expect(mocks.sendOfferSigningSms).toHaveBeenCalledOnce();
    expect(mocks.notifyOwner).toHaveBeenCalledOnce();
  });

  it.each([
    "This applicant has already signed their offer.",
    "This application is rejected. Review its status before sending an offer.",
  ])("does not send when current preparation rejects: %s", async (message) => {
    mocks.prepareHiringOffer.mockRejectedValue(new Error(message));

    await expect(caller().createSigningRequest(input)).rejects.toThrow(message);
    expect(mocks.sendOfferSigningEmail).not.toHaveBeenCalled();
    expect(mocks.sendOfferSigningSms).not.toHaveBeenCalled();
  });

  it("reuses the lifecycle's actual expiry in the response and email instead of claiming a new seven days", async () => {
    const actualExpiry = new Date(Date.now() + 25 * 60 * 1000);
    mocks.prepareHiringOffer.mockResolvedValue({ ...prepared, reuse: true, expiresAt: actualExpiry });
    const expectedLabel = actualExpiry.toLocaleString("en-CA", { timeZone: "America/Toronto", timeZoneName: "short" });

    const result = await caller().createSigningRequest(input);
    expect(result).toMatchObject({ reused: true, expiresAt: actualExpiry });
    const email = mocks.sendOfferSigningEmail.mock.calls[0][0].email;
    expect(email.html).toContain(expectedLabel);
    expect(email.text).toContain(expectedLabel);
  });

  it("HTML-escapes applicant identity fields in the offer email", async () => {
    const unsafe = `<script>&"Ace"O'Reilly`;
    mocks.prepareHiringOffer.mockResolvedValue({
      ...prepared,
      applicant: { ...applicant, name: unsafe, role: "Coach <Lead>", location: "Hamilton & Area" },
    });

    await caller().createSigningRequest(input);
    const html = mocks.sendOfferSigningEmail.mock.calls[0][0].email.html as string;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;&amp;");
    expect(html).toContain("&quot;Ace&quot;");
    expect(html).toContain("O&#39;Reilly");
    expect(html).toContain("Coach &lt;Lead&gt;");
    expect(html).toContain("Hamilton &amp; Area");
  });

  it("records exact outcomes and never exposes the raw signing token to audit or owner notification", async () => {
    mocks.sendOfferSigningSms.mockResolvedValue({ status: "queued", reason: "provider_accepted", phone: "+12895550101" });

    await caller().createSigningRequest(input);
    expect(mocks.recordOfferSigningOutcome).toHaveBeenCalledWith({
      applicationId: applicant.id,
      requestKey: REQUEST_KEY,
      actor,
      fromStatus: applicant.status,
      toStatus: "accepted",
      reused: false,
      offerLetterType: prepared.offerLetterType,
      expiresAt: EXPIRES_AT,
      emailStatus: "sent",
      smsStatus: "queued",
      smsReason: "provider_accepted",
    });
    expect(JSON.stringify(mocks.recordOfferSigningOutcome.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(mocks.notifyOwner.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(mocks.notifyOwner.mock.calls)).not.toContain(LINK);
  });
});
