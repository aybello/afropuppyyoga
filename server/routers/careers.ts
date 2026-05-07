import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { createJobApplication, getAllJobApplications, updateJobApplication, deleteJobApplication } from "../db";
import { notifyOwner } from "../_core/notification";
import {
  sendEmail,
  buildInterviewInviteEmail,
  buildOfferLetterEmail,
  buildRejectionLetterEmail,
} from "../email";

const APP_STATUS = ["new", "reviewed", "shortlisted", "interview_scheduled", "accepted", "rejected"] as const;
type AppStatus = (typeof APP_STATUS)[number];

export const careersRouter = router({
  /**
   * Public: submit a job application.
   * Video is uploaded separately via /api/upload-video and the S3 URL is passed here.
   */
  submitApplication: publicProcedure
    .input(
      z.object({
        role: z.string(),
        location: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        whyAPY: z.string().optional(),
        experience: z.string().optional(),
        videoUrl: z.string().url(), // Required: S3 URL from /api/upload-video
        videoKey: z.string().optional(),
        resumeUrl: z.string().url(), // Required: S3 URL from /api/upload-resume
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
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Role</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;">${input.role} — ${input.location}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;">${input.name}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;"><a href="mailto:${input.email}" style="color: #C2185B;">${input.email}</a></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase;">Phone</td><td style="padding: 8px 0; border-bottom: 1px solid #F0D0DC; color: #1A0A12; font-size: 14px;">${input.phone ?? "Not provided"}</td></tr>
          </table>
          ${input.whyAPY ? `<div style="margin-bottom: 16px;"><p style="color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0 0 6px;">Why APY</p><p style="color: #5A3040; font-size: 14px; line-height: 1.6; margin: 0; background: white; padding: 12px; border-radius: 8px; border: 1px solid #F0D0DC;">${input.whyAPY}</p></div>` : ""}
          ${input.experience ? `<div style="margin-bottom: 16px;"><p style="color: #8B2252; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0 0 6px;">Experience</p><p style="color: #5A3040; font-size: 14px; line-height: 1.6; margin: 0; background: white; padding: 12px; border-radius: 8px; border: 1px solid #F0D0DC;">${input.experience}</p></div>` : ""}
          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <a href="${input.videoUrl}" style="flex: 1; display: block; text-align: center; background: #C2185B; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold;">▶ Watch Video</a>
            <a href="${input.resumeUrl}" style="flex: 1; display: block; text-align: center; background: #3D1A2E; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold;">📄 View Resume</a>
          </div>
          <p style="color: #C4A0B0; font-size: 11px; text-align: center; margin-top: 24px;">Manage applications at afropuppyyoga.ca/admin/applications</p>
        </div>
      `;

      await sendEmail({
        to: "afropuppyyogaofficial@gmail.com",
        subject: `New Application: ${input.name} — ${input.role} (${input.location})`,
        html: emailHtml,
        text: `New job application received!\n\nRole: ${input.role} — ${input.location}\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone ?? "Not provided"}\n\nWhy APY:\n${input.whyAPY ?? "Not provided"}\n\nExperience:\n${input.experience ?? "Not provided"}\n\nVideo: ${input.videoUrl}\nResume: ${input.resumeUrl}`,
      });

      // Also send Manus owner notification as backup
      await notifyOwner({
        title: `New Application: ${input.role} (${input.location})`,
        content: `${input.name} (${input.email}) applied for ${input.role} — ${input.location}.\n\nVideo: ${input.videoUrl}\nResume: ${input.resumeUrl}`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: list all applications
   */
  list: adminProcedure.query(async () => {
    return getAllJobApplications();
  }),

  /**
   * Admin-only: update application status
   */
  updateStatus: adminProcedure
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
  sendInterviewInvite: adminProcedure
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
  sendOfferLetter: adminProcedure
    .input(
      z.object({
        id: z.number(),
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
        startDate: z.string().optional(),
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { subject, html, text } = buildOfferLetterEmail({
        applicantName: input.applicantName,
        role: input.role,
        location: input.location,
        startDate: input.startDate,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({
        to: input.applicantEmail,
        subject,
        html,
        text,
        attachments: [
          {
            filename: "AfroPuppyYoga_Volunteer_Offer_Letter.pdf",
            path: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/OfferLetter_Volunteer_Kitchener_V2_4a8a6867.pdf",
            contentType: "application/pdf",
          },
          {
            filename: "AfroPuppyYoga_NDA.pdf",
            path: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/NDA_Updated_e2dcb73f.pdf",
            contentType: "application/pdf",
          },
        ],
      });

      // Update status to accepted
      await updateJobApplication(input.id, { status: "accepted" });

      await notifyOwner({
        title: `Offer Letter Sent — ${input.applicantName}`,
        content: `Offer letter sent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}).${input.startDate ? `\n\nProposed start date: ${input.startDate}` : ""}`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: delete an application
   */
  deleteApplication: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteJobApplication(input.id);
      return { success: true };
    }),

  /**
   * Admin-only: send rejection letter email to applicant
   */
  sendRejectionLetter: adminProcedure
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
