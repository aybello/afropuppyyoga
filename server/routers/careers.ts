import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { adminProcedure, staffProcedure, publicProcedure, router } from "../_core/trpc";

/** Escape user-supplied text before interpolating into HTML email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Validate that a URL is https and not a LinkedIn profile */
const safeVideoUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://"), "Must be an https:// URL")
  .refine(
    (url) => !url.includes("linkedin.com"),
    "LinkedIn profile URLs are not accepted. Please provide a video link (YouTube, Google Drive, Loom, etc.)"
  );

const safeResumeUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://"), "Must be an https:// URL");

/** A staff-supplied onboarding resource must be a secure public link. */
const safeOnboardingUrl = z
  .string()
  .max(2048)
  .url()
  .refine((url) => url.startsWith("https://"), "Document links must use https://");

export const onboardingDocumentSchema = z.object({
  title: z.string().trim().min(1).max(100),
  url: safeOnboardingUrl,
});
export const onboardingInputSchema = z.object({
  id: z.number().int().positive(),
  orientationDate: z.string().trim().min(1).max(80).optional(),
  orientationTime: z.enum(["9:00 AM", "10:00 AM", "10:00 AM (Oakville)"]).optional(),
  planningDocUrl: safeOnboardingUrl.optional(),
  documents: z.array(onboardingDocumentSchema).max(4).optional(),
  additionalNotes: z.string().max(2000).optional(),
}).superRefine((input, ctx) => {
  if (input.orientationTime && !input.orientationDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["orientationDate"],
      message: "Choose an orientation date when an orientation time is provided.",
    });
  }
});
import { archiveJobApplicationIfUnclaimed, claimInitialOnboardingDelivery, completeClaimedOnboardingDocumentDelivery, createJobApplication, deleteJobApplication, getAllJobApplications, releaseInitialOnboardingDeliveryClaim, updateJobApplication, updateJobApplicationStatusIfUnclaimed, getArchivedJobApplications, restoreJobApplication, permanentlyDeleteJobApplication, getRecentDuplicateJobApplication, getJobApplicationById, getJobApplicationBySubmissionKey, getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import {
  sendEmail,
  buildInterviewInviteEmail,
  buildRejectionLetterEmail,
  buildApplicationConfirmationEmail,
  buildOnboardingEmail,
  buildYogaInstructorOnboardingEmail,
} from "../email";
import { buildNewRoleOnboardingEmail } from "../newRoleOnboardingEmail";
import { normalizeApyRole } from "../../shared/apyPermissions";
import { communicationsLog, employees, jobApplicationActions, jobApplications } from "../../drizzle/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

export const APP_STATUS = ["new", "reviewed", "shortlisted", "interview_requested", "interview_scheduled", "accepted", "rejected", "onboarded"] as const;
type AppStatus = (typeof APP_STATUS)[number];

type HiringActor = {
  user: { id: number; name: string | null; email: string | null };
};

export const POST_COMMIT_EFFECT_TIMEOUT_MS = 8_000;

function isDuplicateSubmissionKeyError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "ER_DUP_ENTRY" || /duplicate entry/i.test(candidate?.message ?? "");
}

/**
 * A saved public application must not be held hostage by a provider that
 * accepts a connection but never settles. This cannot cancel the provider's
 * underlying request, but it bounds the browser-facing request and turns a
 * late confirmation into a visible delivery warning instead of a retry trap.
 */
export async function runPostCommitEffect<T>(
  label: string,
  operation: () => Promise<T> | T,
  timeoutMs = POST_COMMIT_EFFECT_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      deadline,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function assertInitialOnboardingStatus(status: string) {
  if (status !== "onboarded") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Add the signed applicant to Employee Directory before sending onboarding documents.",
    });
  }
}

export function assertOnboardingResendStatus(input: { status: string; onboardingSentAt: Date | null }) {
  if ((input.status !== "accepted" && input.status !== "onboarded") || !input.onboardingSentAt) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Resend onboarding is available only after onboarding documents have been sent.",
    });
  }
}

export function assertNoPendingOnboardingClaim(applicant: { status: string; onboardingDeliveryToken: string | null }) {
  if (applicant.onboardingDeliveryToken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Onboarding delivery is in progress. Wait for it to finish or resolve the pending onboarding outcome before changing this application.",
    });
  }
}

/** An employee's lifecycle is managed from Employee Directory, never Careers. */
export function assertApplicantCanBeRejected(applicant: { status: string; onboardingDeliveryToken: string | null }) {
  if (applicant.status === "onboarded") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "An onboarded employee cannot be rejected from the application pipeline. Review their Employee Directory record instead.",
    });
  }
  if (applicant.status === "rejected") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This applicant has already been rejected.",
    });
  }
  assertNoPendingOnboardingClaim(applicant);
}

function onboardingAuditPreview(input: z.infer<typeof onboardingInputSchema>): string {
  const resourceCount = 1 + (input.documents?.length ?? 0);
  const orientation = input.orientationDate
    ? `Orientation: ${input.orientationDate}${input.orientationTime ? ` at ${input.orientationTime}` : ""}. `
    : "";
  return `${orientation}Onboarding resources included: ${resourceCount}.`;
}

function redactedOnboardingUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.origin;
}

function onboardingAuditResources(input: z.infer<typeof onboardingInputSchema>) {
  return {
    usesDefaultPlanningDocument: !input.planningDocUrl,
    planningDocument: input.planningDocUrl ? redactedOnboardingUrl(input.planningDocUrl) : null,
    documents: input.documents?.map((document) => ({
      title: document.title,
      url: redactedOnboardingUrl(document.url),
    })) ?? [],
    notesSha256: input.additionalNotes
      ? createHash("sha256").update(input.additionalNotes).digest("hex")
      : null,
  };
}

async function recordHiringAction(params: {
  ctx: HiringActor;
  applicationId: number;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  details?: Record<string, unknown>;
  communication?: { recipient: string; subject: string; bodyPreview?: string };
}) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(jobApplicationActions).values({
      applicationId: params.applicationId,
      action: params.action,
      fromStatus: params.fromStatus || null,
      toStatus: params.toStatus || null,
      actorUserId: params.ctx.user.id,
      actorName: params.ctx.user.name,
      actorEmail: params.ctx.user.email,
      details: params.details ? JSON.stringify(params.details) : null,
    });
    if (params.communication) {
      await db.insert(communicationsLog).values({
        entityType: "job_application",
        entityId: params.applicationId,
        channel: "email",
        direction: "outbound",
        action: params.action,
        recipient: params.communication.recipient,
        subject: params.communication.subject,
        bodyPreview: params.communication.bodyPreview?.slice(0, 1000) || null,
        deliveryStatus: "sent",
        actorUserId: params.ctx.user.id,
        actorName: params.ctx.user.name,
      });
    }
  } catch (error) {
    // The customer-facing action already succeeded. Do not make staff retry an
    // email because the secondary audit write failed.
    console.error(`[Careers] Failed to record ${params.action} for application ${params.applicationId}:`, error);
  }
}

/**
 * The public application record is committed before this runs. Keep every
 * audit and recovery step best-effort so a temporary ledger outage never
 * tells an applicant to submit the same application again.
 */
async function recordPublicApplicationAudit(params: {
  applicationId: number;
  name: string;
  email: string;
  role: string;
  location: string;
  confirmation?: { subject: string; text: string };
  confirmationDelivered?: boolean;
  notificationFailures?: number;
  recordSubmission?: boolean;
}) {
  try {
    const db = await runPostCommitEffect("Application audit database connection", () => getDb());
    if (!db) throw new Error("Application audit database is unavailable");

    const auditWrites: Array<Promise<unknown>> = [];
    if (params.recordSubmission !== false) {
      auditWrites.push(runPostCommitEffect("Application submission audit", () => db.insert(jobApplicationActions).values({
        applicationId: params.applicationId,
        action: "application_submitted",
        fromStatus: null,
        toStatus: "new",
        actorName: params.name,
        actorEmail: params.email,
        details: JSON.stringify({
          role: params.role,
          location: params.location,
          ...(params.notificationFailures === undefined ? {} : { notificationFailures: params.notificationFailures }),
        }),
      })));
    }
    if (params.recordSubmission === false && params.notificationFailures !== undefined) {
      auditWrites.push(runPostCommitEffect("Application notification outcome audit", () => db.insert(jobApplicationActions).values({
        applicationId: params.applicationId,
        action: "application_notification_outcome",
        fromStatus: null,
        toStatus: null,
        actorName: "APY HQ",
        details: JSON.stringify({
          notificationFailures: params.notificationFailures,
          confirmationDelivered: params.confirmationDelivered ?? false,
        }),
      })));
    }
    const confirmation = params.confirmation;
    if (confirmation) {
      auditWrites.push(runPostCommitEffect("Application confirmation audit", () => db.insert(communicationsLog).values({
        entityType: "job_application",
        entityId: params.applicationId,
        channel: "email",
        direction: "outbound",
        action: "application_confirmation_sent",
        recipient: params.email,
        subject: confirmation.subject,
        bodyPreview: confirmation.text.slice(0, 1000),
        deliveryStatus: params.confirmationDelivered ? "sent" : "failed",
        actorName: "APY HQ",
      })));
    }

    const auditResults = await Promise.allSettled(auditWrites);

    const failures = auditResults
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason);
    if (failures.length === 0) return;

    console.error(
      `[Careers] Application ${params.applicationId} saved, but ${failures.length} audit write(s) failed.`,
      failures,
    );
    await runPostCommitEffect("Application audit recovery owner notification", () => notifyOwner({
      title: "Application saved with incomplete audit trail",
      content: `Application #${params.applicationId} for ${params.role} at ${params.location} was saved for ${params.email}, but ${failures.length} audit record(s) need review.`,
    })).catch((error) => {
      console.error(`[Careers] Failed to notify owner about application audit recovery for ${params.applicationId}:`, error);
    });
  } catch (error) {
    console.error(`[Careers] Application ${params.applicationId} saved, but application audit setup failed:`, error);
    await runPostCommitEffect("Missing application audit owner notification", () => notifyOwner({
      title: "Application saved with missing audit trail",
      content: `Application #${params.applicationId} for ${params.role} at ${params.location} was saved for ${params.email}, but its audit trail could not be written.`,
    })).catch((notifyError) => {
      console.error(`[Careers] Failed to notify owner about missing application audit trail for ${params.applicationId}:`, notifyError);
    });
  }
}

async function requireApplicant(id: number) {
  const applicant = await getJobApplicationById(id);
  if (!applicant) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Application not found or archived." });
  }
  if (!applicant.email) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This applicant does not have an email address." });
  }
  return { ...applicant, email: applicant.email };
}

async function requireActiveEmployeeForDocuments(applicant: { id: number; status: string; isTeamMember: boolean | number | null }) {
  assertInitialOnboardingStatus(applicant.status);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.sourceApplicationId, applicant.id), eq(employees.employmentStatus, "active"))).limit(1);
  if (!employee || !applicant.isTeamMember) throw new TRPCError({ code: "CONFLICT", message: "Activate this employee in Employee Directory before sending login and onboarding instructions." });
}

export const careersRouter = router({
  /**
   * Public: submit a job application.
   * Video is uploaded separately via /api/upload-video and the S3 URL is passed here.
   */
  submitApplication: publicProcedure
    .input(
      z.object({
        role: z.string().min(1).max(100),
        location: z.string().min(1).max(100),
        name: z.string().min(1).max(200),
        email: z.string().email(),
        phone: z.string().max(50).optional(),
        whyAPY: z.string().max(2000).optional(),
        experience: z.string().max(1000).optional(),
        videoUrl: safeVideoUrl, // Required: S3 URL from upload OR a pasted video link
        videoKey: z.string().optional(), // Only present when file was uploaded (not for links)
        resumeUrl: safeResumeUrl, // Required: S3 URL from /api/upload-resume
        resumeKey: z.string().optional(),
        submissionKey: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Older open tabs may submit the pre-upgrade form without a browser key.
      // Keep that form compatible while new forms receive atomic retry safety.
      const submissionKey = input.submissionKey ?? randomUUID();
      const existingSubmission = await getJobApplicationBySubmissionKey(submissionKey);
      if (existingSubmission) {
        return { success: true, duplicate: true, notificationWarning: false };
      }

      const duplicate = await getRecentDuplicateJobApplication({
        email: input.email,
        role: input.role,
        location: input.location,
      });
      if (duplicate) {
        return { success: true, duplicate: true, notificationWarning: false };
      }

      // Send email notification to afropuppyyoga@gmail.com
      const emailHtml = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FEFAF4; padding: 32px; border-radius: 12px;">
          <div style="background: #3D1A2E; padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
            <h1 style="color: #F9E4EE; font-size: 22px; margin: 0;">🐾 New Job Application</h1>
            <p style="color: #C2185B; font-size: 14px; margin: 8px 0 0;">AfroPuppyYoga Careers</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Role</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;">${escapeHtml(input.role)} — ${escapeHtml(input.location)}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;">${escapeHtml(input.name)}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;"><a href="mailto:${escapeHtml(input.email)}" style="color: #C2185B;">${escapeHtml(input.email)}</a></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Phone</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;">${escapeHtml(input.phone ?? "Not provided")}</td></tr>
          </table>
          ${input.whyAPY ? `<div style="margin-bottom: 16px;"><p style="color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0 0 6px;">Why APY</p><p style="color: #5A3040; font-size: 14px; line-height: 1.6; margin: 0; background: white; padding: 12px; border-radius: 8px; border: 1px solid #F0D0DC;">${escapeHtml(input.whyAPY)}</p></div>` : ""}
          ${input.experience ? `<div style="margin-bottom: 16px;"><p style="color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0 0 6px;">Experience</p><p style="color: #5A3040; font-size: 14px; line-height: 1.6; margin: 0; background: white; padding: 12px; border-radius: 8px; border: 1px solid #F0D0DC;">${escapeHtml(input.experience)}</p></div>` : ""}
          <div style="display: flex; gap: 12px; margin-top: 24px;">
            ${input.videoUrl ? `<a href="${input.videoUrl}" style="flex: 1; display: block; text-align: center; background: #C2185B; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold;">▶ Watch Video</a>` : `<span style="flex: 1; display: block; text-align: center; background: #E0C0CC; color: #8B6070; padding: 12px 20px; border-radius: 8px; font-size: 14px;">No video submitted</span>`}
            <a href="${input.resumeUrl}" style="flex: 1; display: block; text-align: center; background: #3D1A2E; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold;">📄 View Resume</a>
          </div>
          <p style="color: #C4A0B0; font-size: 11px; text-align: center; margin-top: 24px;">Manage applications at afropuppyyoga.ca/admin/applications</p>
        </div>
      `;

      // Save to DB
      let applicationId: number;
      try {
        applicationId = await createJobApplication({
          role: input.role,
          location: input.location,
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          whyAPY: input.whyAPY ?? null,
          experience: input.experience ?? null,
          videoUrl: input.videoUrl,
          videoKey: input.videoKey ?? null,
          resumeUrl: input.resumeUrl,
          resumeKey: input.resumeKey ?? null,
          submissionKey,
          status: "new",
        });
      } catch (error) {
        if (!isDuplicateSubmissionKeyError(error)) throw error;
        const concurrentSubmission = await getJobApplicationBySubmissionKey(submissionKey);
        if (!concurrentSubmission) throw error;
        return { success: true, duplicate: true, notificationWarning: false };
      }

      // The application is now durable. Keep all normal notification and
      // audit work in this request under one shared deadline. This preserves
      // normal staff delivery without allowing cumulative provider delays to
      // turn a saved application into a retry trap.
      try {
        await runPostCommitEffect("Application post-save work", async () => {
          const submissionAudit = recordPublicApplicationAudit({
            applicationId,
            name: input.name,
            email: input.email,
            role: input.role,
            location: input.location,
          });

          let confirmation: { subject: string; html: string; text: string };
          try {
            confirmation = buildApplicationConfirmationEmail({
              applicantName: input.name,
              role: input.role,
              location: input.location,
            });
          } catch (error) {
            await Promise.all([
              submissionAudit,
              recordPublicApplicationAudit({
                applicationId,
                name: input.name,
                email: input.email,
                role: input.role,
                location: input.location,
                confirmationDelivered: false,
                notificationFailures: 1,
                recordSubmission: false,
              }),
            ]);
            throw error;
          }
          const notificationResults = await Promise.allSettled([
            sendEmail({
              to: "afropuppyyoga@gmail.com",
              subject: `New Application: ${input.name} — ${input.role} (${input.location})`,
              html: emailHtml,
              text: `New job application received!\n\nRole: ${input.role} — ${input.location}\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone ?? "Not provided"}\n\nWhy APY:\n${input.whyAPY ?? "Not provided"}\n\nExperience:\n${input.experience ?? "Not provided"}\n\nVideo: ${input.videoUrl ?? "Not provided"}\nResume: ${input.resumeUrl}`,
            }),
            sendEmail({
              to: input.email,
              subject: confirmation.subject,
              html: confirmation.html,
              text: confirmation.text,
            }),
            notifyOwner({
              title: `New Application: ${input.role} (${input.location})`,
              content: `${input.name} (${input.email}) applied for ${input.role} — ${input.location}.\n\nVideo: ${input.videoUrl ?? "Not provided"}\nResume: ${input.resumeUrl}`,
            }),
          ]);
          const failedNotifications = notificationResults.filter((result) => result.status === "rejected").length;
          const confirmationFailed = notificationResults[1]?.status === "rejected";
          if (failedNotifications > 0) {
            console.error(`[Careers] Application ${input.email} saved, but ${failedNotifications} notification(s) failed.`);
          }

          await Promise.all([
            submissionAudit,
            recordPublicApplicationAudit({
              applicationId,
              name: input.name,
              email: input.email,
              role: input.role,
              location: input.location,
              confirmation,
              confirmationDelivered: !confirmationFailed,
              notificationFailures: failedNotifications,
              recordSubmission: false,
            }),
          ]);
        });
      } catch (error) {
        console.error(`[Careers] Application ${applicationId} saved, but post-save work did not finish before its deadline:`, error);
      }

      return { success: true, duplicate: false, notificationWarning: false };
    }),

  /**
   * Admin-only: list all applications
   */
  list: staffProcedure.query(async () => {
    return getAllJobApplications();
  }),

  getTimeline: staffProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { actions: [], communications: [] };
      const [actions, communications] = await Promise.all([
        db.select().from(jobApplicationActions)
          .where(eq(jobApplicationActions.applicationId, input.id))
          .orderBy(desc(jobApplicationActions.createdAt)),
        db.select().from(communicationsLog)
          .where(and(eq(communicationsLog.entityType, "job_application"), eq(communicationsLog.entityId, input.id)))
          .orderBy(desc(communicationsLog.createdAt)),
      ]);
      return { actions, communications };
    }),

  /**
   * Admin-only: update application status
   */
  updateStatus: staffProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(APP_STATUS),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      assertNoPendingOnboardingClaim(applicant);
      if (input.status === "onboarded") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Use Add to Employee Directory after the current offer and NDA are signed. Send onboarding documents afterward.",
        });
      }
      if (applicant.status === "onboarded") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An onboarded applicant cannot be moved through the general status selector. Review their Employee Directory record instead.",
        });
      }
      const transitioned = await updateJobApplicationStatusIfUnclaimed(input.id, applicant.status as AppStatus, input.status as AppStatus);
      if (!transitioned) {
        throw new TRPCError({ code: "CONFLICT", message: "Onboarding delivery started before this status change completed. Refresh and resolve it first." });
      }
      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "status_changed",
        fromStatus: applicant.status,
        toStatus: input.status,
      });
      return { success: true };
    }),

  /**
   * Admin-only: send interview invitation email to applicant
   */
  sendInterviewInvite: staffProcedure
    .input(
      z.object({
        id: z.number(),
        bookingLink: z.string().url(), // Google Calendar booking link
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      assertApplicantCanBeRejected(applicant);
      const { subject, html, text } = buildInterviewInviteEmail({
        applicantName: applicant.name,
        role: applicant.role,
        location: applicant.location,
        bookingLink: input.bookingLink,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({ to: applicant.email, subject, html, text });

      // A booking link has been sent, but no date or time is confirmed yet.
      const transitioned = await updateJobApplicationStatusIfUnclaimed(input.id, applicant.status as AppStatus, "interview_requested");
      if (!transitioned) {
        throw new TRPCError({ code: "CONFLICT", message: "Onboarding delivery started before the interview status could be updated. Refresh and resolve it first." });
      }

      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "interview_invite_sent",
        fromStatus: applicant.status,
        toStatus: "interview_requested",
        details: { bookingLink: input.bookingLink },
        communication: {
          recipient: applicant.email,
          subject,
          bodyPreview: text,
        },
      });

      await notifyOwner({
        title: `Interview Invite Sent — ${applicant.name}`,
        content: `Interview invitation sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).\n\nBooking link: ${input.bookingLink}`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: delete an application
   */
  deleteApplication: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      assertApplicantCanBeRejected({ ...applicant, status: applicant.status === "rejected" ? "reviewed" : applicant.status });
      const archived = await archiveJobApplicationIfUnclaimed(input.id);
      if (!archived) {
        throw new TRPCError({ code: "CONFLICT", message: "Onboarding delivery started before this archive completed. Refresh and resolve it first." });
      }
      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "application_archived",
        fromStatus: applicant.status,
        details: { applicantName: applicant.name },
      });
      return { success: true };
    }),

  /**
   * Staff: list archived (soft-deleted) applications
   */
  listArchived: staffProcedure.query(async () => {
    return getArchivedJobApplications();
  }),

  /**
   * Staff: restore a soft-deleted application
   */
  restoreApplication: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await restoreJobApplication(input.id);
      await recordHiringAction({ ctx, applicationId: input.id, action: "application_restored" });
      return { success: true };
    }),

  /**
   * Admin-only: permanently delete an archived application (no recovery)
   */
  permanentlyDelete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await permanentlyDeleteJobApplication(input.id);
      return { success: true };
    }),

  /**
   * Staff: send onboarding email to an Accepted applicant.
   */
  sendOnboardingEmail: staffProcedure
    .input(onboardingInputSchema)
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      await requireActiveEmployeeForDocuments(applicant);
      const claimed = await claimInitialOnboardingDelivery(input.id);
      if (!claimed) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Onboarding is already being sent or was already delivered. Refresh the application before trying again.",
        });
      }
      console.log(`[Onboarding] Sending onboarding email to ${applicant.email} for ${applicant.name} (${applicant.role}, ${applicant.location})`);
      // Use role-specific email template
      const isYogaInstructor = normalizeApyRole(applicant.role) === "yoga instructor";
      const newRole = ["movement instructor", "operations specialist"].includes(normalizeApyRole(applicant.role));
      const { subject, html, text } = newRole
        ? buildNewRoleOnboardingEmail({ ...input, applicantName: applicant.name, role: applicant.role, location: applicant.location })
        : isYogaInstructor
        ? buildYogaInstructorOnboardingEmail({
            applicantName: applicant.name,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            documents: input.documents,
            additionalNotes: input.additionalNotes,
          })
        : buildOnboardingEmail({
            applicantName: applicant.name,
            role: applicant.role,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            documents: input.documents,
            additionalNotes: input.additionalNotes,
          });

      try {
        await sendEmail({ to: applicant.email, subject, html, text });
        console.log(`[Onboarding] ✅ Email sent successfully to ${applicant.email}`);
      } catch (err: any) {
        console.error(`[Onboarding] ❌ Provider acceptance is unknown; preserving claim for staff reconciliation:`, err.message || err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The email provider did not confirm the send. No retry was sent. Use Resolve Pending Onboarding to record the real outcome before trying again.",
        });
      }

      // Documents do not grant access or mark training complete; employment was already activated.
      const completed = await completeClaimedOnboardingDocumentDelivery(input.id, claimed);
      if (!completed) {
        console.error(`[Onboarding] Email provider accepted the send, but application ${input.id} changed before onboarding completion.`);
        throw new TRPCError({
          code: "CONFLICT",
          message: "The email provider accepted the send, but this application changed before completion. Review its history before taking another action.",
        });
      }
      console.log(`[Onboarding] Documents marked sent for application ${input.id}; employee status is unchanged.`);

      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "onboarding_documents_sent",
        fromStatus: applicant.status,
        toStatus: applicant.status,
        details: {
          orientationDate: input.orientationDate,
          orientationTime: input.orientationTime,
          resources: onboardingAuditResources(input),
        },
        communication: { recipient: applicant.email, subject, bodyPreview: onboardingAuditPreview(input) },
      });

      try {
        await notifyOwner({
          title: `Onboarding Documents Sent — ${applicant.name}`,
          content: `Onboarding documents were sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}). The employee can sign in to APY HQ and access role-based training. Sending documents does not mark training complete.`,
        });
      } catch (error) {
        console.error(`[Onboarding] Email delivered but owner notification failed for application ${input.id}:`, error);
      }

      return { success: true };
    }),

  /**
   * Staff: reconcile a stranded initial-onboarding claim after explicitly
   * confirming whether the email provider accepted the send. This never
   * sends another email and cannot overwrite a non-Accepted workflow state.
   */
  reconcileOnboardingDelivery: staffProcedure
    .input(z.object({
      id: z.number().int().positive(),
      outcome: z.enum(["delivered", "not_delivered"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      if (!["accepted", "onboarded"].includes(applicant.status)) throw new TRPCError({ code: "CONFLICT", message: "Review the current employee or applicant status before reconciling delivery." });
      if (!applicant.onboardingDeliveryToken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "There is no pending onboarding delivery to reconcile.",
        });
      }

      if (input.outcome === "delivered") {
        const completed = await completeClaimedOnboardingDocumentDelivery(input.id, applicant.onboardingDeliveryToken);
        if (!completed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This application changed before onboarding could be reconciled. Refresh and review its history.",
          });
        }
        await recordHiringAction({
          ctx,
          applicationId: input.id,
          action: "onboarding_documents_reconciled_delivered",
          fromStatus: applicant.status,
          toStatus: applicant.status,
          details: { reconciliation: "staff_confirmed_provider_accepted" },
        });
        return { success: true, status: applicant.status };
      }

      const released = await releaseInitialOnboardingDeliveryClaim(input.id, applicant.onboardingDeliveryToken);
      if (!released) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This application changed before the pending send could be reopened. Refresh and review its history.",
        });
      }
      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "onboarding_delivery_reopened",
        fromStatus: applicant.status,
        toStatus: applicant.status,
        details: { reconciliation: "staff_confirmed_not_sent" },
      });
      return { success: true, status: applicant.status };
    }),

  /**
   * Staff: resend onboarding documents after an initial documented delivery.
   */
  resendOnboardingEmail: staffProcedure
    .input(onboardingInputSchema)
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      assertOnboardingResendStatus({ status: applicant.status, onboardingSentAt: applicant.onboardingSentAt });
      await requireActiveEmployeeForDocuments(applicant);
      const claim = await claimInitialOnboardingDelivery(input.id, true);
      if (!claim) throw new TRPCError({ code: "CONFLICT", message: "Another onboarding delivery is pending. Refresh and resolve its outcome first." });
      const isYogaInstructor = normalizeApyRole(applicant.role) === "yoga instructor";
      const newRole = ["movement instructor", "operations specialist"].includes(normalizeApyRole(applicant.role));
      const { subject, html, text } = newRole
        ? buildNewRoleOnboardingEmail({ ...input, applicantName: applicant.name, role: applicant.role, location: applicant.location })
        : isYogaInstructor
        ? buildYogaInstructorOnboardingEmail({
            applicantName: applicant.name,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            documents: input.documents,
            additionalNotes: input.additionalNotes,
          })
        : buildOnboardingEmail({
            applicantName: applicant.name,
            role: applicant.role,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            documents: input.documents,
            additionalNotes: input.additionalNotes,
          });

      try { await sendEmail({ to: applicant.email, subject, html, text }); }
      catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The provider did not confirm delivery. Use Resolve Pending Onboarding before retrying." }); }
      if (!await completeClaimedOnboardingDocumentDelivery(input.id, claim)) throw new TRPCError({ code: "CONFLICT", message: "The provider accepted the send. Resolve the pending onboarding outcome before retrying." });

      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "onboarding_resent",
        fromStatus: applicant.status,
        toStatus: applicant.status,
        details: {
          orientationDate: input.orientationDate,
          orientationTime: input.orientationTime,
          resources: onboardingAuditResources(input),
        },
        communication: { recipient: applicant.email, subject, bodyPreview: onboardingAuditPreview(input) },
      });

      try {
        await notifyOwner({
          title: `Onboarding Email Resent -- ${applicant.name}`,
          content: `Onboarding email resent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).`,
        });
      } catch (error) {
        console.error(`[Onboarding] Resend delivered but owner notification failed for application ${input.id}:`, error);
      }

      return { success: true };
    }),

  /**
   * Admin-only: send rejection letter email to applicant
   */
  sendRejectionEmail: staffProcedure
    .input(
      z.object({
        id: z.number(),
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // The row lock prevents an onboarding transition from completing after a
      // staff member opens the rejection modal but before the email is sent.
      const rejection = await db.transaction(async (tx) => {
        const [applicant] = await tx.select().from(jobApplications)
          .where(and(eq(jobApplications.id, input.id), isNull(jobApplications.deletedAt)))
          .limit(1)
          .for("update");
        const recipient = applicant?.email;
        if (!applicant || !recipient) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found or archived." });
        }
        assertApplicantCanBeRejected(applicant);

        const { subject, html, text } = buildRejectionLetterEmail({
          applicantName: applicant.name,
          role: applicant.role,
          location: applicant.location,
          additionalNotes: input.additionalNotes,
        });
        await sendEmail({ to: recipient, subject, html, text });

        const transition = await tx.update(jobApplications).set({ status: "rejected" })
          .where(and(
            eq(jobApplications.id, applicant.id),
            eq(jobApplications.status, applicant.status),
            isNull(jobApplications.onboardingDeliveryToken),
            isNull(jobApplications.deletedAt),
          ));
        if (Number((transition as any)[0]?.affectedRows ?? 0) !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "This application changed before rejection could be completed. Refresh and review it before sending another email." });
        }
        return { applicant, recipient, subject, text };
      });

      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "rejection_sent",
        fromStatus: rejection.applicant.status,
        toStatus: "rejected",
        communication: { recipient: rejection.recipient, subject: rejection.subject, bodyPreview: rejection.text },
      });

      await notifyOwner({
        title: `Rejection Letter Sent — ${rejection.applicant.name}`,
        content: `Rejection letter sent to ${rejection.applicant.name} (${rejection.applicant.email}) for ${rejection.applicant.role} (${rejection.applicant.location}).`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: request applicant to submit or re-submit their intro video
   */
  requestVideo: staffProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      const firstName = applicant.name.split(" ")[0];
      const subject = `${firstName}, we still need your intro video`;
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefaf4;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a0a12;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
    <div style="background:linear-gradient(135deg,#8B2252,#C2185B);padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">We Still Need Your Intro Video</h1>
      <p style="margin:8px 0 0;color:#fce4ec;font-size:14px;">AfroPuppyYoga Careers</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Thank you for applying for the <strong>${escapeHtml(applicant.role)}</strong> position at AfroPuppyYoga (${escapeHtml(applicant.location)}). We are excited to learn more about you!</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">We noticed we do not have your intro video on file yet. A short video (1 to 2 minutes) is an important part of your application and helps us get to know you before we move forward.</p>
      <div style="background:#fef3f7;border-left:4px solid #C2185B;border-radius:8px;padding:18px 22px;margin:24px 0;">
        <p style="margin:0 0 10px;font-weight:700;color:#8B2252;font-size:15px;">What to include in your video:</p>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;color:#3a1a2a;">
          <li>A quick introduction (your name, where you are based)</li>
          <li>Why you want to work with AfroPuppyYoga</li>
          <li>Any relevant experience with animals, yoga, or events</li>
          <li>Your personality and energy (we love enthusiasm!)</li>
        </ul>
      </div>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Please upload your video to YouTube, Google Drive, or Loom and reply to this email with the link. You can also email it directly to <a href="mailto:afropuppyyoga@gmail.com" style="color:#C2185B;">afropuppyyoga@gmail.com</a>.</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">We look forward to hearing from you!</p>
      <p style="margin:32px 0 0;font-size:14px;color:#8B6070;">Warm regards,<br/><strong>The AfroPuppyYoga Team</strong></p>
    </div>
    <div style="background:#fef3f7;padding:20px 40px;text-align:center;border-top:1px solid #f0d0dc;">
      <p style="margin:0;font-size:12px;color:#a07080;">AfroPuppyYoga &mdash; Ontario, Canada &bull; <a href="https://afropuppyyoga.ca" style="color:#C2185B;">afropuppyyoga.ca</a></p>
    </div>
  </div>
</body>
</html>`;
      const text = `Hi ${firstName},\n\nThank you for applying for the ${applicant.role} position at AfroPuppyYoga (${applicant.location}).\n\nWe noticed we do not have your intro video on file yet. Please record a short 1-2 minute video introducing yourself and reply to this email with a link (YouTube, Google Drive, or Loom).\n\nWarm regards,\nThe AfroPuppyYoga Team`;
      await sendEmail({ to: applicant.email, subject, html, text });
      await recordHiringAction({
        ctx,
        applicationId: input.id,
        action: "video_requested",
        fromStatus: applicant.status,
        toStatus: applicant.status,
        communication: { recipient: applicant.email, subject, bodyPreview: text },
      });
      await notifyOwner({
        title: `Video Requested: ${applicant.name}`,
        content: `Video request email sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).`,
      });
      return { success: true };
    }),
});
