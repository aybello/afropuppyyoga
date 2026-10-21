import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const mocks = vi.hoisted(() => ({
  resolveApyAccess: vi.fn(),
  getJobApplicationById: vi.fn(),
  updateJobApplicationStatusIfUnclaimed: vi.fn(),
  getDb: vi.fn(),
  recordInterviewInviteOutcome: vi.fn(),
  buildInterviewInviteEmail: vi.fn(),
  sendInterviewInviteEmail: vi.fn(),
  sendInterviewInviteSms: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
vi.mock("./db", () => ({
  getJobApplicationById: mocks.getJobApplicationById,
  updateJobApplicationStatusIfUnclaimed: mocks.updateJobApplicationStatusIfUnclaimed,
  getDb: mocks.getDb,
}));
vi.mock("./email", () => ({
  sendEmail: vi.fn(),
  buildInterviewInviteEmail: mocks.buildInterviewInviteEmail,
  buildRejectionLetterEmail: vi.fn(),
  buildApplicationConfirmationEmail: vi.fn(),
  buildOnboardingEmail: vi.fn(),
  buildYogaInstructorOnboardingEmail: vi.fn(),
}));
vi.mock("./interviewInviteEmail", () => ({ sendInterviewInviteEmail: mocks.sendInterviewInviteEmail }));
vi.mock("./interviewInviteSms", () => ({ sendInterviewInviteSms: mocks.sendInterviewInviteSms }));
vi.mock("./interviewInviteAudit", () => ({ recordInterviewInviteOutcome: mocks.recordInterviewInviteOutcome }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { careersRouter } from "./routers/careers";

const REQUEST_KEY = "123e4567-e89b-42d3-a456-426614174000";
const BOOKING_LINK = "https://cal.example.com/interview";
const actor = { id: 7, name: "Owner", email: "owner@example.com" };
const applicant = {
  id: 42,
  name: "Saved Applicant",
  email: "saved@example.com",
  phone: "+1 289 555 0101",
  role: "Yoga Instructor",
  location: "Hamilton",
  status: "new",
  onboardingDeliveryToken: null,
};
const input = { id: applicant.id, bookingLink: BOOKING_LINK, requestKey: REQUEST_KEY };

function caller(user: typeof actor | null = actor) {
  return careersRouter.createCaller({ user } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveApyAccess.mockResolvedValue({ level: "owner", canManageOperations: true });
  mocks.getJobApplicationById.mockResolvedValue({ ...applicant });
  mocks.updateJobApplicationStatusIfUnclaimed.mockResolvedValue(true);
  mocks.buildInterviewInviteEmail.mockReturnValue({ subject: "Interview", html: "<p>Interview</p>", text: "Interview" });
  mocks.sendInterviewInviteEmail.mockResolvedValue({ status: "sent" });
  mocks.sendInterviewInviteSms.mockResolvedValue({ status: "queued", phone: "+12895550101" });
  mocks.recordInterviewInviteOutcome.mockResolvedValue({ recorded: true });
  mocks.notifyOwner.mockResolvedValue(undefined);
});

describe("careers.sendInterviewInvite", () => {
  it("uses real staff middleware and denies anonymous and ordinary team members before loading or sending", async () => {
    await expect(caller(null).sendInterviewInvite(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });

    mocks.resolveApyAccess.mockResolvedValue({ level: "team_member", canManageOperations: false });
    await expect(caller().sendInterviewInvite(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });

    expect(mocks.getJobApplicationById).not.toHaveBeenCalled();
    expect(mocks.sendInterviewInviteEmail).not.toHaveBeenCalled();
    expect(mocks.sendInterviewInviteSms).not.toHaveBeenCalled();
  });

  it.each([
    ["rejected", null],
    ["onboarded", null],
    ["reviewed", "onboarding-claim"],
  ])("denies %s/pending-onboarding applicants before either provider", async (status, onboardingDeliveryToken) => {
    mocks.getJobApplicationById.mockResolvedValue({ ...applicant, status, onboardingDeliveryToken });
    await expect(caller().sendInterviewInvite(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "CONFLICT" });
    expect(mocks.sendInterviewInviteEmail).not.toHaveBeenCalled();
    expect(mocks.sendInterviewInviteSms).not.toHaveBeenCalled();
  });

  it("denies an archived or missing applicant before either provider", async () => {
    mocks.getJobApplicationById.mockResolvedValue(null);
    await expect(caller().sendInterviewInvite(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "NOT_FOUND" });
    expect(mocks.sendInterviewInviteEmail).not.toHaveBeenCalled();
    expect(mocks.sendInterviewInviteSms).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...input, requestKey: "not-a-uuid" }, "requestKey"],
    [{ ...input, id: 0 }, "id"],
    [{ ...input, bookingLink: "http://cal.example.com" }, "bookingLink"],
    [{ ...input, bookingLink: `https://example.com/${"x".repeat(2030)}` }, "bookingLink"],
    [{ ...input, additionalNotes: "x".repeat(2001) }, "additionalNotes"],
  ])("rejects invalid input at %s before loading the applicant", async (badInput) => {
    await expect(caller().sendInterviewInvite(badInput)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getJobApplicationById).not.toHaveBeenCalled();
  });

  it("sends both helpers the saved identity, passes a missing saved phone through, and keeps notes email-only", async () => {
    mocks.getJobApplicationById.mockResolvedValue({ ...applicant, phone: null });
    const additionalNotes = "Please bring photo ID.";
    await caller().sendInterviewInvite({ ...input, additionalNotes });

    expect(mocks.buildInterviewInviteEmail).toHaveBeenCalledWith({
      applicantName: applicant.name,
      role: applicant.role,
      location: applicant.location,
      bookingLink: BOOKING_LINK,
      additionalNotes,
    });
    expect(mocks.sendInterviewInviteEmail).toHaveBeenCalledWith({
      applicationId: applicant.id,
      requestKey: REQUEST_KEY,
      actor,
      email: { to: applicant.email, subject: "Interview", html: "<p>Interview</p>", text: "Interview" },
    });
    expect(mocks.sendInterviewInviteSms).toHaveBeenCalledWith({
      applicationId: applicant.id,
      applicantName: applicant.name,
      role: applicant.role,
      phone: null,
      bookingLink: BOOKING_LINK,
      requestKey: REQUEST_KEY,
      actor,
    });
    expect(mocks.sendInterviewInviteSms.mock.calls[0][0]).not.toHaveProperty("additionalNotes");
  });

  it.each(["new", "reviewed", "shortlisted"])("moves %s to interview_requested after an accepted channel", async (status) => {
    mocks.getJobApplicationById.mockResolvedValue({ ...applicant, status });
    await expect(caller().sendInterviewInvite(input)).resolves.toMatchObject({ success: true });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).toHaveBeenCalledWith(applicant.id, status, "interview_requested");
  });

  it.each(["interview_scheduled", "accepted"])("does not rewind %s", async (status) => {
    mocks.getJobApplicationById.mockResolvedValue({ ...applicant, status });
    await expect(caller().sendInterviewInvite(input)).resolves.toMatchObject({ success: true });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).not.toHaveBeenCalled();
  });

  it("succeeds when email is sent even though SMS fails", async () => {
    mocks.sendInterviewInviteSms.mockResolvedValue({ status: "failed", reason: "rejected", phone: "+12895550101" });
    await expect(caller().sendInterviewInvite(input)).resolves.toMatchObject({ success: true, sms: { status: "failed" } });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).toHaveBeenCalledOnce();
  });

  it.each(["queued", "sent", "delivered"])("succeeds when email fails but SMS is %s", async (status) => {
    mocks.sendInterviewInviteEmail.mockResolvedValue({ status: "failed", reason: "not attempted" });
    mocks.sendInterviewInviteSms.mockResolvedValue({ status, phone: "+12895550101" });
    await expect(caller().sendInterviewInvite(input)).resolves.toMatchObject({ success: true, sms: { status } });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).toHaveBeenCalledOnce();
  });

  it("does not transition or audit when both outcomes are unknown", async () => {
    mocks.sendInterviewInviteEmail.mockResolvedValue({ status: "unknown" });
    mocks.sendInterviewInviteSms.mockResolvedValue({ status: "unknown", phone: "+12895550101" });

    await expect(caller().sendInterviewInvite(input)).resolves.toMatchObject({ success: false });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).not.toHaveBeenCalled();
    expect(mocks.recordInterviewInviteOutcome).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("returns a warning without auditing, throwing, or retrying when the status CAS loses", async () => {
    mocks.updateJobApplicationStatusIfUnclaimed.mockResolvedValue(false);
    const result = await caller().sendInterviewInvite(input);
    expect(result).toMatchObject({ success: true, trackingWarning: expect.stringContaining("Do not resend") });
    expect(mocks.updateJobApplicationStatusIfUnclaimed).toHaveBeenCalledOnce();
    expect(mocks.recordInterviewInviteOutcome).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("records exact channel statuses and reasons through the outcome helper rather than blanket delivery", async () => {
    mocks.sendInterviewInviteSms.mockResolvedValue({ status: "queued", reason: "provider accepted", phone: "+12895550101" });

    await caller().sendInterviewInvite(input);
    expect(mocks.recordInterviewInviteOutcome).toHaveBeenCalledOnce();
    expect(mocks.recordInterviewInviteOutcome).toHaveBeenCalledWith({
      applicationId: applicant.id,
      actor,
      fromStatus: "new",
      toStatus: "interview_requested",
      bookingLink: BOOKING_LINK,
      requestKey: REQUEST_KEY,
      emailStatus: "sent",
      smsStatus: "queued",
      smsReason: "provider accepted",
    });
  });

  it("returns an audit warning without reporting a false send failure or notifying the owner", async () => {
    mocks.recordInterviewInviteOutcome.mockResolvedValue({ recorded: false, warning: "audit unavailable; do not resend" });
    await expect(caller().sendInterviewInvite(input)).resolves.toMatchObject({
      success: true,
      trackingWarning: "audit unavailable; do not resend",
    });
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("does not report a false send failure when owner notification fails", async () => {
    mocks.notifyOwner.mockRejectedValue(new Error("notify unavailable"));
    await expect(caller().sendInterviewInvite(input)).resolves.toMatchObject({ success: true });
    expect(mocks.recordInterviewInviteOutcome).toHaveBeenCalledOnce();
    expect(mocks.notifyOwner).toHaveBeenCalledOnce();
  });

  it("recovers a failed audit on a reused-email replay and notifies only after it is recorded", async () => {
    mocks.recordInterviewInviteOutcome
      .mockResolvedValueOnce({ recorded: false, warning: "audit unavailable; do not resend" })
      .mockResolvedValueOnce({ recorded: true });

    await caller().sendInterviewInvite(input);
    mocks.sendInterviewInviteEmail.mockResolvedValue({ status: "sent", reused: true });
    await caller().sendInterviewInvite(input);

    expect(mocks.recordInterviewInviteOutcome).toHaveBeenCalledTimes(2);
    expect(mocks.notifyOwner).toHaveBeenCalledOnce();
  });

  it("notifies once when duplicate audit outcomes are recorded then ignored, regardless of email replay", async () => {
    mocks.recordInterviewInviteOutcome
      .mockResolvedValueOnce({ recorded: true })
      .mockResolvedValueOnce({ recorded: false });

    await caller().sendInterviewInvite(input);
    mocks.sendInterviewInviteEmail.mockResolvedValue({ status: "sent", reused: true });
    await caller().sendInterviewInvite(input);

    expect(mocks.recordInterviewInviteOutcome).toHaveBeenCalledTimes(2);
    expect(mocks.notifyOwner).toHaveBeenCalledOnce();
  });
});
