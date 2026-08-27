import { z } from "zod";
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
import { createJobApplication, getAllJobApplications, updateJobApplication, deleteJobApplication, getArchivedJobApplications, restoreJobApplication, permanentlyDeleteJobApplication, createSigningToken, getRecentDuplicateJobApplication, getJobApplicationById } from "../db";
import { notifyOwner } from "../_core/notification";
import {
  sendEmail,
  buildInterviewInviteEmail,
  buildRejectionLetterEmail,
  buildApplicationConfirmationEmail,
  buildOnboardingEmail,
  buildYogaInstructorOnboardingEmail,
  buildSigningInviteEmail,
} from "../email";
import crypto from "crypto";
import { getTrustedAppOrigin } from "../_core/trustedOrigin";

export const APP_STATUS = ["new", "reviewed", "shortlisted", "interview_requested", "interview_scheduled", "accepted", "rejected", "onboarded"] as const;
type AppStatus = (typeof APP_STATUS)[number];

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
      })
    )
    .mutation(async ({ input }) => {
      const duplicate = await getRecentDuplicateJobApplication({
        email: input.email,
        role: input.role,
        location: input.location,
      });
      if (duplicate) {
        return { success: true, duplicate: true, notificationWarning: false };
      }

      // Save to DB
      await createJobApplication({
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
        status: "new",
      });

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

      // The application has already been saved. Notification failures should be
      // logged for recovery, not make the applicant retry and create duplicates.
      const confirmation = buildApplicationConfirmationEmail({
        applicantName: input.name,
        role: input.role,
        location: input.location,
      });
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
      if (failedNotifications > 0) {
        console.error(`[Careers] Application ${input.email} saved, but ${failedNotifications} notification(s) failed.`);
      }

      return { success: true, notificationWarning: failedNotifications > 0 };
    }),

  /**
   * Admin-only: list all applications
   */
  list: staffProcedure.query(async () => {
    return getAllJobApplications();
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
    .mutation(async ({ input }) => {
      await updateJobApplication(input.id, { status: input.status as AppStatus });
      return { success: true };
    }),

  /**
   * Admin-only: send interview invitation email to applicant
   */
  sendInterviewInvite: staffProcedure
    .input(
      z.object({
        id: z.number(),
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
        bookingLink: z.string().url(), // Google Calendar booking link
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const applicant = await requireApplicant(input.id);
      const { subject, html, text } = buildInterviewInviteEmail({
        applicantName: applicant.name,
        role: applicant.role,
        location: applicant.location,
        bookingLink: input.bookingLink,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({ to: applicant.email, subject, html, text });

      // A booking link has been sent, but no date or time is confirmed yet.
      await updateJobApplication(input.id, { status: "interview_requested" });

      await notifyOwner({
        title: `Interview Invite Sent — ${applicant.name}`,
        content: `Interview invitation sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).\n\nBooking link: ${input.bookingLink}`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: send offer letter email to applicant
   */
  sendOfferLetter: staffProcedure
    .input(
      z.object({
        id: z.number(),
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
        startDate: z.string().optional(),
        additionalNotes: z.string().optional(),
        origin: z.string().optional(), // frontend origin for building the signing link
      })
    )
    .mutation(async ({ input, ctx }) => {
      const applicant = await requireApplicant(input.id);
      // Determine offer letter type from role and location
      const roleLower = applicant.role.toLowerCase();
      const locationLower = applicant.location.toLowerCase();
      let offerLetterType: "puppy_monitor_kw" | "puppy_monitor_hamilton" | "yoga_instructor" | "operations_specialist" | "bdr" = "puppy_monitor_kw";
      if (roleLower.includes("yoga") || roleLower.includes("instructor")) {
        offerLetterType = "yoga_instructor";
      } else if (roleLower.includes("operations specialist") || roleLower.includes("operation specialist")) {
        offerLetterType = "operations_specialist";
      } else if (roleLower.includes("bdr") || roleLower.includes("business development")) {
        offerLetterType = "bdr";
      } else if (locationLower.includes("hamilton")) {
        offerLetterType = "puppy_monitor_hamilton";
      }

      // Generate a unique signing token (7 day expiry)
      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await createSigningToken({
        applicationId: input.id,
        applicantName: applicant.name,
        applicantEmail: applicant.email,
        role: applicant.role,
        location: applicant.location,
        offerLetterType,
        token,
        signed: 0,
        expiresAt,
      });

      // Build the signing portal link using the origin passed from the frontend
      const origin = getTrustedAppOrigin(input.origin);
      const signingLink = `${origin}/sign?token=${token}`;

      // Send the signing invitation email
      const firstName = applicant.name.split(" ")[0];
      const emailHtml = buildSigningInviteEmail({
        firstName,
        applicantName: applicant.name,
        role: applicant.role,
        location: applicant.location,
        signingLink,
        startDate: input.startDate,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({
        to: applicant.email,
        subject: `${firstName}, your AfroPuppyYoga offer is ready to sign! 🐾`,
        html: emailHtml,
        text: `Hi ${firstName},\n\nCongratulations! We are excited to offer you the ${applicant.role} position at AfroPuppyYoga (${applicant.location}).\n\nPlease review and sign your Offer Letter and NDA using the link below:\n${signingLink}\n\nThis link is valid for 7 days.\n\nWarm regards,\nThe AfroPuppyYoga Team`,
      });

      // Update status to accepted
      await updateJobApplication(input.id, { status: "accepted" });

      await notifyOwner({
        title: `Offer Letter Sent: ${applicant.name}`,
        content: `Offer letter sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).\nSigning link: ${signingLink}`,
      });

      return { success: true, signingLink };
    }),

  /**
   * Admin-only: delete an application
   */
  deleteApplication: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteJobApplication(input.id);
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
    .mutation(async ({ input }) => {
      await restoreJobApplication(input.id);
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
   * Admin-only: send onboarding email to a hired + signed applicant
   */
  sendOnboardingEmail: staffProcedure
    .input(
      z.object({
        id: z.number(),
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
        orientationDate: z.string().optional(),
        orientationTime: z.string().optional(),
        planningDocUrl: z.string().optional(),
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const applicant = await requireApplicant(input.id);
      console.log(`[Onboarding] Sending onboarding email to ${applicant.email} for ${applicant.name} (${applicant.role}, ${applicant.location})`);
      // Use role-specific email template
      const isYogaInstructor = applicant.role.toLowerCase().includes("yoga instructor") || applicant.role.toLowerCase().includes("instructor");
      const { subject, html, text } = isYogaInstructor
        ? buildYogaInstructorOnboardingEmail({
            applicantName: applicant.name,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          })
        : buildOnboardingEmail({
            applicantName: applicant.name,
            role: applicant.role,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          });

      try {
        await sendEmail({ to: applicant.email, subject, html, text });
        console.log(`[Onboarding] ✅ Email sent successfully to ${applicant.email}`);
      } catch (err: any) {
        console.error(`[Onboarding] ❌ Failed to send email:`, err.message || err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email send failed: ${err.message}` });
      }

      // Auto-advance status to onboarded
      await updateJobApplication(input.id, { status: "onboarded" });
      console.log(`[Onboarding] Status updated to onboarded for application ${input.id}`);

      await notifyOwner({
        title: `Onboarding Email Sent — ${applicant.name}`,
        content: `Onboarding email sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}). Status updated to Onboarded.`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: resend onboarding email to an already-onboarded applicant (no status change)
   */
  resendOnboardingEmail: staffProcedure
    .input(
      z.object({
        id: z.number(),
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
        orientationDate: z.string().optional(),
        orientationTime: z.string().optional(),
        planningDocUrl: z.string().optional(),
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const applicant = await requireApplicant(input.id);
      const isYogaInstructor = applicant.role.toLowerCase().includes("yoga instructor") || applicant.role.toLowerCase().includes("instructor");
      const { subject, html, text } = isYogaInstructor
        ? buildYogaInstructorOnboardingEmail({
            applicantName: applicant.name,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          })
        : buildOnboardingEmail({
            applicantName: applicant.name,
            role: applicant.role,
            location: applicant.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          });

      await sendEmail({ to: applicant.email, subject, html, text });

      await notifyOwner({
        title: `Onboarding Email Resent -- ${applicant.name}`,
        content: `Onboarding email resent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: send rejection letter email to applicant
   */
  sendRejectionLetter: staffProcedure
    .input(
      z.object({
        id: z.number(),
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const applicant = await requireApplicant(input.id);
      const { subject, html, text } = buildRejectionLetterEmail({
        applicantName: applicant.name,
        role: applicant.role,
        location: applicant.location,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({ to: applicant.email, subject, html, text });

      // Update status to rejected
      await updateJobApplication(input.id, { status: "rejected" });

      await notifyOwner({
        title: `Rejection Letter Sent — ${applicant.name}`,
        content: `Rejection letter sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).`,
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
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
      })
    )
    .mutation(async ({ input }) => {
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
      await notifyOwner({
        title: `Video Requested: ${applicant.name}`,
        content: `Video request email sent to ${applicant.name} (${applicant.email}) for ${applicant.role} (${applicant.location}).`,
      });
      return { success: true };
    }),
});
