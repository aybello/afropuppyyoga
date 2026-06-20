import { z } from "zod";
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
import { createJobApplication, getAllJobApplications, updateJobApplication, deleteJobApplication, createSigningToken } from "../db";
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

const APP_STATUS = ["new", "reviewed", "shortlisted", "interview_scheduled", "accepted", "rejected", "onboarded"] as const;
type AppStatus = (typeof APP_STATUS)[number];

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

      // Send email notification to afropuppyyogaofficial@gmail.com
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

      await sendEmail({
        to: "afropuppyyogaofficial@gmail.com",
        subject: `New Application: ${input.name} — ${input.role} (${input.location})`,
        html: emailHtml,
        text: `New job application received!\n\nRole: ${input.role} — ${input.location}\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone ?? "Not provided"}\n\nWhy APY:\n${input.whyAPY ?? "Not provided"}\n\nExperience:\n${input.experience ?? "Not provided"}\n\nVideo: ${input.videoUrl ?? "Not provided"}\nResume: ${input.resumeUrl}`,
      });

      // Send auto-confirmation email to the applicant
      const confirmation = buildApplicationConfirmationEmail({
        applicantName: input.name,
        role: input.role,
        location: input.location,
      });
      await sendEmail({
        to: input.email,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
      });

      // Also send Manus owner notification as backup
      await notifyOwner({
        title: `New Application: ${input.role} (${input.location})`,
        content: `${input.name} (${input.email}) applied for ${input.role} — ${input.location}.\n\nVideo: ${input.videoUrl ?? "Not provided"}\nResume: ${input.resumeUrl}`,
      });

      return { success: true };
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
      const { subject, html, text } = buildInterviewInviteEmail({
        applicantName: input.applicantName,
        role: input.role,
        location: input.location,
        bookingLink: input.bookingLink,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({ to: input.applicantEmail, subject, html, text });

      // Update status to interview_scheduled
      await updateJobApplication(input.id, { status: "interview_scheduled" });

      await notifyOwner({
        title: `Interview Invite Sent — ${input.applicantName}`,
        content: `Interview invitation sent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}).\n\nBooking link: ${input.bookingLink}`,
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
      // Determine offer letter type from role and location
      const roleLower = input.role.toLowerCase();
      const locationLower = input.location.toLowerCase();
      let offerLetterType: "puppy_monitor_kw" | "puppy_monitor_hamilton" | "yoga_instructor" = "puppy_monitor_kw";
      if (roleLower.includes("yoga") || roleLower.includes("instructor")) {
        offerLetterType = "yoga_instructor";
      } else if (locationLower.includes("hamilton")) {
        offerLetterType = "puppy_monitor_hamilton";
      }

      // Generate a unique signing token (7 day expiry)
      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await createSigningToken({
        applicationId: input.id,
        applicantName: input.applicantName,
        applicantEmail: input.applicantEmail,
        role: input.role,
        location: input.location,
        offerLetterType,
        token,
        signed: 0,
        expiresAt,
      });

      // Build the signing portal link using the origin passed from the frontend
      const origin = input.origin ?? "https://afropuppyyoga.ca";
      const signingLink = `${origin}/sign?token=${token}`;

      // Send the signing invitation email
      const firstName = input.applicantName.split(" ")[0];
      const emailHtml = buildSigningInviteEmail({
        firstName,
        applicantName: input.applicantName,
        role: input.role,
        location: input.location,
        signingLink,
        startDate: input.startDate,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({
        to: input.applicantEmail,
        subject: `${firstName}, your AfroPuppyYoga offer is ready to sign! 🐾`,
        html: emailHtml,
        text: `Hi ${firstName},\n\nCongratulations! We are excited to offer you the ${input.role} position at AfroPuppyYoga (${input.location}).\n\nPlease review and sign your Offer Letter and NDA using the link below:\n${signingLink}\n\nThis link is valid for 7 days.\n\nWarm regards,\nThe AfroPuppyYoga Team`,
      });

      // Update status to accepted
      await updateJobApplication(input.id, { status: "accepted" });

      await notifyOwner({
        title: `Offer Letter Sent: ${input.applicantName}`,
        content: `Offer letter sent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}).\nSigning link: ${signingLink}`,
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
      // Use role-specific email template
      const isYogaInstructor = input.role.toLowerCase().includes("yoga instructor") || input.role.toLowerCase().includes("instructor");
      const { subject, html, text } = isYogaInstructor
        ? buildYogaInstructorOnboardingEmail({
            applicantName: input.applicantName,
            location: input.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          })
        : buildOnboardingEmail({
            applicantName: input.applicantName,
            role: input.role,
            location: input.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          });

      await sendEmail({ to: input.applicantEmail, subject, html, text });

      // Auto-advance status to onboarded
      await updateJobApplication(input.id, { status: "onboarded" });

      await notifyOwner({
        title: `Onboarding Email Sent — ${input.applicantName}`,
        content: `Onboarding email sent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}). Status updated to Onboarded.`,
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
      const isYogaInstructor = input.role.toLowerCase().includes("yoga instructor") || input.role.toLowerCase().includes("instructor");
      const { subject, html, text } = isYogaInstructor
        ? buildYogaInstructorOnboardingEmail({
            applicantName: input.applicantName,
            location: input.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          })
        : buildOnboardingEmail({
            applicantName: input.applicantName,
            role: input.role,
            location: input.location,
            orientationDate: input.orientationDate,
            orientationTime: input.orientationTime,
            planningDocUrl: input.planningDocUrl,
            additionalNotes: input.additionalNotes,
          });

      await sendEmail({ to: input.applicantEmail, subject, html, text });

      await notifyOwner({
        title: `Onboarding Email Resent -- ${input.applicantName}`,
        content: `Onboarding email resent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}).`,
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
      const { subject, html, text } = buildRejectionLetterEmail({
        applicantName: input.applicantName,
        role: input.role,
        location: input.location,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({ to: input.applicantEmail, subject, html, text });

      // Update status to rejected
      await updateJobApplication(input.id, { status: "rejected" });

      await notifyOwner({
        title: `Rejection Letter Sent — ${input.applicantName}`,
        content: `Rejection letter sent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}).`,
      });

      return { success: true };
    }),
});
