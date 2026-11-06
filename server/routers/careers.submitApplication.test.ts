import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildApplicationConfirmationEmail,
  createJobApplication,
  getDb,
  getJobApplicationBySubmissionKey,
  getRecentDuplicateJobApplication,
  notifyOwner,
  sendEmail,
} = vi.hoisted(() => ({
  buildApplicationConfirmationEmail: vi.fn(),
  createJobApplication: vi.fn(),
  getDb: vi.fn(),
  getJobApplicationBySubmissionKey: vi.fn(),
  getRecentDuplicateJobApplication: vi.fn(),
  notifyOwner: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("../db", () => ({
  archiveJobApplicationIfUnclaimed: vi.fn(),
  claimInitialOnboardingDelivery: vi.fn(),
  completeClaimedOnboardingDocumentDelivery: vi.fn(),
  createJobApplication,
  deleteJobApplication: vi.fn(),
  getAllJobApplications: vi.fn(),
  getArchivedJobApplications: vi.fn(),
  getDb,
  getJobApplicationById: vi.fn(),
  getJobApplicationBySubmissionKey,
  getRecentDuplicateJobApplication,
  permanentlyDeleteJobApplication: vi.fn(),
  releaseInitialOnboardingDeliveryClaim: vi.fn(),
  restoreJobApplication: vi.fn(),
  updateJobApplication: vi.fn(),
  updateJobApplicationStatusIfUnclaimed: vi.fn(),
}));

vi.mock("../_core/notification", () => ({ notifyOwner }));
vi.mock("../email", () => ({
  buildApplicationConfirmationEmail,
  buildInterviewInviteEmail: vi.fn(),
  buildOnboardingEmail: vi.fn(),
  buildRejectionLetterEmail: vi.fn(),
  buildYogaInstructorOnboardingEmail: vi.fn(),
  sendEmail,
}));

import { careersRouter, POST_COMMIT_EFFECT_TIMEOUT_MS, runPostCommitEffect } from "./careers";

const input = {
  role: "Puppy Monitor",
  location: "KW",
  name: "Applicant Example",
  email: "applicant@example.com",
  phone: "+12895550100",
  whyAPY: "I care about puppy welfare.",
  experience: "Event support and dog handling.",
  videoUrl: "https://example.com/video.mp4",
  videoKey: "applications/video.mp4",
  resumeUrl: "https://example.com/resume.pdf",
  resumeKey: "applications/resume.pdf",
  submissionKey: "4e12e2e5-4c8b-4fbd-a1d4-86b2fe066a5c",
};

function createAuditDb(options?: { rejectCommunication?: boolean; throwCommunicationSynchronously?: boolean }) {
  const inserts: Array<Record<string, unknown>> = [];
  return {
    inserts,
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((value: Record<string, unknown>) => {
          inserts.push(value);
          if (options?.throwCommunicationSynchronously && value.action === "application_confirmation_sent") {
            throw new Error("communications ledger setup failed synchronously");
          }
          if (options?.rejectCommunication && value.action === "application_confirmation_sent") {
            return Promise.reject(new Error("communications ledger temporarily unavailable"));
          }
          return Promise.resolve();
        }),
      })),
    },
  };
}

const caller = () => careersRouter.createCaller({} as never);

async function flushPostSaveWork() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("public careers application submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecentDuplicateJobApplication.mockResolvedValue(null);
    getJobApplicationBySubmissionKey.mockResolvedValue(null);
    createJobApplication.mockResolvedValue(12345);
    buildApplicationConfirmationEmail.mockReturnValue({
      subject: "Application received",
      html: "<p>Thank you</p>",
      text: "Thank you",
    });
    sendEmail.mockResolvedValue(undefined);
    notifyOwner.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["Movement Instructor", "KW"], ["Movement Instructor", "GUE"],
    ["Puppy Monitor", "GUE"], ["Operations Specialist", "GUE"],
  ])("saves a %s application for %s with the existing submission flow", async (role, location) => {
    getDb.mockResolvedValue(createAuditDb().db);
    await expect(caller().submitApplication({ ...input, role, location })).resolves.toMatchObject({ success: true });
    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({ role, location, status: "new" }));
  });

  it("saves a trimmed referral and includes it safely in both owner email formats", async () => {
    getDb.mockResolvedValue(createAuditDb().db);
    const referral = `Alex & <script>"O'Brien"</script>`;

    await expect(caller().submitApplication({ ...input, referredBy: `  ${referral}  ` })).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });

    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({ referredBy: referral, status: "new" }));
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const ownerEmail = sendEmail.mock.calls.find(([message]) => message.to === "afropuppyyoga@gmail.com")?.[0];
    expect(ownerEmail).toBeDefined();
    expect(ownerEmail.html).toContain("Referred By</td>");
    expect(ownerEmail.html).toContain("Alex &amp; &lt;script&gt;&quot;O&#39;Brien&quot;&lt;/script&gt;");
    expect(ownerEmail.html).not.toContain(referral);
    expect(ownerEmail.html).not.toContain("<script>");
    expect(ownerEmail.text).toContain(`\nReferred By: ${referral}\n`);
    expect(buildApplicationConfirmationEmail).toHaveBeenCalledOnce();
    expect(notifyOwner).toHaveBeenCalledOnce();
  });

  it.each([
    ["legacy omitted field", undefined],
    ["empty field", ""],
    ["whitespace-only field", " \t\n "],
  ])("stores null and omits the referral from owner email for %s", async (_description, referredBy) => {
    getDb.mockResolvedValue(createAuditDb().db);
    const application = referredBy === undefined ? input : { ...input, referredBy };

    await expect(caller().submitApplication(application)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({ referredBy: null }));
    const ownerEmail = sendEmail.mock.calls.find(([message]) => message.to === "afropuppyyoga@gmail.com")?.[0];
    expect(ownerEmail).toBeDefined();
    expect(ownerEmail.html).not.toContain("Referred By");
    expect(ownerEmail.text).not.toContain("Referred By");
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(notifyOwner).toHaveBeenCalledOnce();
  });

  it("accepts a referral of 255 characters after trimming", async () => {
    getDb.mockResolvedValue(createAuditDb().db);
    const referredBy = "A".repeat(255);

    await expect(caller().submitApplication({ ...input, referredBy: ` ${referredBy} ` })).resolves.toMatchObject({ success: true, duplicate: false });
    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({ referredBy }));
    const ownerEmail = sendEmail.mock.calls.find(([message]) => message.to === "afropuppyyoga@gmail.com")?.[0];
    expect(ownerEmail.html).toContain(referredBy);
    expect(ownerEmail.text).toContain(`Referred By: ${referredBy}`);
  });

  it("rejects a referral over 255 characters before any submission side effects", async () => {
    await expect(caller().submitApplication({ ...input, referredBy: ` ${"A".repeat(256)} ` })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(getJobApplicationBySubmissionKey).not.toHaveBeenCalled();
    expect(getRecentDuplicateJobApplication).not.toHaveBeenCalled();
    expect(createJobApplication).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("leaves recent-duplicate matching unchanged when a referral is supplied", async () => {
    getRecentDuplicateJobApplication.mockResolvedValueOnce({ id: 12345 });

    await expect(caller().submitApplication({ ...input, referredBy: "A different referrer" })).resolves.toEqual({
      success: true,
      duplicate: true,
      notificationWarning: false,
    });
    expect(getJobApplicationBySubmissionKey).toHaveBeenCalledWith(input.submissionKey);
    expect(getRecentDuplicateJobApplication).toHaveBeenCalledWith({
      email: input.email,
      role: input.role,
      location: input.location,
    });
    expect(createJobApplication).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["uploaded video", {
      videoUrl: "https://storage.example.net/applications/videos/private-video.mp4?token=video-secret",
      videoKey: "applications/videos/private-video.mp4",
    }],
    ["external video", {
      videoUrl: "https://www.youtube.com/watch?v=private-video-id",
      videoKey: undefined,
    }],
  ])("keeps %s and resume references out of owner messages while saving them", async (_kind, video) => {
    const prepared = createAuditDb();
    getDb.mockResolvedValue(prepared.db);
    const application = {
      ...input,
      ...video,
      resumeUrl: "https://storage.example.net/applications/resumes/private-resume.pdf?token=resume-secret",
      resumeKey: "applications/resumes/private-resume.pdf",
      referredBy: "Trusted teammate",
    };
    // Incoming host headers must not influence the link sent to the owner.
    const untrustedCaller = careersRouter.createCaller({
      req: { headers: { host: "attacker.example", "x-forwarded-host": "attacker.example" } },
    } as never);

    await expect(untrustedCaller.submitApplication(application)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });

    expect(createJobApplication).toHaveBeenCalledOnce();
    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({
      videoUrl: application.videoUrl,
      videoKey: application.videoKey ?? null,
      resumeUrl: application.resumeUrl,
      resumeKey: application.resumeKey,
      referredBy: application.referredBy,
      submissionKey: application.submissionKey,
      status: "new",
    }));
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const ownerEmail = sendEmail.mock.calls.find(([message]) => message.to === "afropuppyyoga@gmail.com")?.[0];
    const confirmation = sendEmail.mock.calls.find(([message]) => message.to === application.email)?.[0];
    expect(ownerEmail).toBeDefined();
    expect(confirmation).toEqual({
      to: application.email,
      subject: "Application received",
      html: "<p>Thank you</p>",
      text: "Thank you",
    });
    expect(notifyOwner).toHaveBeenCalledOnce();
    const ownerNotification = notifyOwner.mock.calls[0][0];
    const dashboardUrl = "https://afropuppyyoga.ca/admin/applications";
    expect(ownerEmail.html).toContain(`href="${dashboardUrl}"`);
    expect(ownerEmail.text).toContain(dashboardUrl);
    expect(ownerEmail.html).toContain(application.referredBy);
    expect(ownerEmail.text).toContain(`Referred By: ${application.referredBy}`);
    expect(ownerNotification.content).toContain(dashboardUrl);
    for (const message of [ownerEmail.html, ownerEmail.text, JSON.stringify(ownerNotification)]) {
      for (const secret of [application.videoUrl, application.videoKey, application.resumeUrl, application.resumeKey]) {
        if (secret) expect(message).not.toContain(secret);
      }
      expect(message).not.toContain("attacker.example");
    }
    expect(prepared.inserts).toContainEqual(expect.objectContaining({ action: "application_submitted" }));
    expect(prepared.inserts).toContainEqual(expect.objectContaining({ action: "application_confirmation_sent", deliveryStatus: "sent" }));
  });

  it("confirms a durable application even when the secondary communications audit fails", async () => {
    const prepared = createAuditDb({ rejectCommunication: true });
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().submitApplication(input)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    await flushPostSaveWork();

    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({
      name: input.name,
      email: input.email,
      status: "new",
    }));
    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_submitted",
      applicationId: 12345,
    }));
    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_confirmation_sent",
      entityId: 12345,
    }));
  });

  it("still tells the applicant their application was received when notification delivery fails", async () => {
    const prepared = createAuditDb();
    getDb.mockResolvedValue(prepared.db);
    sendEmail.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("email provider unavailable"));

    await expect(caller().submitApplication(input)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    await flushPostSaveWork();

    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_confirmation_sent",
      deliveryStatus: "failed",
    }));
    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_notification_outcome",
      details: expect.stringContaining('"notificationFailures":1'),
    }));
  });

  it("does not warn an applicant when only the internal owner notification fails", async () => {
    const prepared = createAuditDb();
    getDb.mockResolvedValue(prepared.db);
    notifyOwner.mockRejectedValueOnce(new Error("owner notification unavailable"));

    await expect(caller().submitApplication(input)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    await flushPostSaveWork();

    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_confirmation_sent",
      deliveryStatus: "sent",
    }));
  });

  it("confirms a saved application when audit database access fails after persistence", async () => {
    getDb.mockRejectedValue(new Error("database connection temporarily unavailable"));

    await expect(caller().submitApplication(input)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    await flushPostSaveWork();

    expect(createJobApplication).toHaveBeenCalledOnce();
    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: "Application saved with missing audit trail",
    }));
  });

  it("confirms a saved application when an audit statement throws during setup", async () => {
    const prepared = createAuditDb({ throwCommunicationSynchronously: true });
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().submitApplication(input)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    await flushPostSaveWork();

    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: "Application saved with incomplete audit trail",
    }));
  });

  it("still surfaces a persistence failure before an application is saved", async () => {
    createJobApplication.mockRejectedValue(new Error("database write failed"));

    await expect(caller().submitApplication(input)).rejects.toThrow("database write failed");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("returns an existing submission without saving or sending another notification", async () => {
    getJobApplicationBySubmissionKey.mockResolvedValueOnce({ id: 12345 });

    await expect(caller().submitApplication({ ...input, referredBy: "Another referrer" })).resolves.toEqual({
      success: true,
      duplicate: true,
      notificationWarning: false,
    });
    expect(getJobApplicationBySubmissionKey).toHaveBeenCalledWith(input.submissionKey);
    expect(getRecentDuplicateJobApplication).not.toHaveBeenCalled();
    expect(createJobApplication).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("treats a concurrent submission-key collision as the same application", async () => {
    createJobApplication.mockRejectedValue({ code: "ER_DUP_ENTRY", message: "Duplicate entry" });
    getJobApplicationBySubmissionKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 12345 });

    await expect(caller().submitApplication(input)).resolves.toEqual({
      success: true,
      duplicate: true,
      notificationWarning: false,
    });
    expect(createJobApplication).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("accepts an already-open legacy form without a submission key", async () => {
    const prepared = createAuditDb();
    getDb.mockResolvedValue(prepared.db);
    const legacyInput = { ...input };
    delete (legacyInput as Partial<typeof input>).submissionKey;

    await expect(caller().submitApplication(legacyInput)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    expect(createJobApplication).toHaveBeenCalledWith(expect.objectContaining({
      submissionKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }));
  });

  it("keeps a saved application when confirmation template generation fails", async () => {
    const prepared = createAuditDb();
    getDb.mockResolvedValue(prepared.db);
    buildApplicationConfirmationEmail.mockImplementation(() => {
      throw new Error("confirmation template failed");
    });

    await expect(caller().submitApplication(input)).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    expect(createJobApplication).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_submitted",
      applicationId: 12345,
    }));
    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_notification_outcome",
      details: expect.stringContaining('"confirmationDelivered":false'),
    }));
  });

  it("bounds a stalled post-save provider operation", async () => {
    await expect(
      runPostCommitEffect("stalled provider", () => new Promise<never>(() => undefined), 1),
    ).rejects.toThrow("stalled provider timed out after 1ms");
  });

  it("returns a saved application when every post-save provider stalls", async () => {
    vi.useFakeTimers();
    const prepared = createAuditDb();
    getDb.mockResolvedValue(prepared.db);
    sendEmail.mockImplementation(() => new Promise<void>(() => undefined));
    notifyOwner.mockImplementation(() => new Promise<boolean>(() => undefined));

    const submission = caller().submitApplication(input);
    await vi.advanceTimersByTimeAsync(POST_COMMIT_EFFECT_TIMEOUT_MS);

    await expect(submission).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    expect(createJobApplication).toHaveBeenCalledOnce();
    expect(prepared.inserts).toContainEqual(expect.objectContaining({
      action: "application_submitted",
      applicationId: 12345,
    }));
  });

  it("returns a saved application when the audit database stalls", async () => {
    vi.useFakeTimers();
    getDb.mockImplementation(() => new Promise<never>(() => undefined));

    const submission = caller().submitApplication(input);
    await vi.advanceTimersByTimeAsync(POST_COMMIT_EFFECT_TIMEOUT_MS);

    await expect(submission).resolves.toEqual({
      success: true,
      duplicate: false,
      notificationWarning: false,
    });
    expect(createJobApplication).toHaveBeenCalledOnce();
    expect(getDb).toHaveBeenCalled();
  });
});
