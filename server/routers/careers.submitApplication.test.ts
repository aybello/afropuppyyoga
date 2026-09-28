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
