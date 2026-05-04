import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { createJobApplication, getAllJobApplications, updateJobApplication } from "../db";
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
        videoUrl: z.string().url().optional(), // S3 URL from /api/upload-video
        videoKey: z.string().optional(),
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
        videoUrl: input.videoUrl ?? null,
        videoKey: input.videoKey ?? null,
        status: "new",
      });

      // Send email notification to owner
      const videoLine = input.videoUrl
        ? `\n\nVideo Application: ${input.videoUrl}`
        : "\n\nNo video submitted.";

      await notifyOwner({
        title: `New Application: ${input.role} (${input.location})`,
        content: `New job application received!\n\nRole: ${input.role}\nLocation: ${input.location}\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone ?? "Not provided"}\n\nWhy APY:\n${input.whyAPY ?? "Not provided"}\n\nExperience:\n${input.experience ?? "Not provided"}${videoLine}`,
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
        interviewDate: z.string(),
        interviewTime: z.string(),
        interviewFormat: z.string(),
        interviewLink: z.string().optional(),
        additionalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { subject, html, text } = buildInterviewInviteEmail({
        applicantName: input.applicantName,
        role: input.role,
        location: input.location,
        interviewDate: input.interviewDate,
        interviewTime: input.interviewTime,
        interviewFormat: input.interviewFormat,
        interviewLink: input.interviewLink,
        additionalNotes: input.additionalNotes,
      });

      await sendEmail({ to: input.applicantEmail, subject, html, text });

      // Update status to interview_scheduled
      await updateJobApplication(input.id, { status: "interview_scheduled" });

      await notifyOwner({
        title: `Interview Invite Sent — ${input.applicantName}`,
        content: `Interview invitation sent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}).\n\nDate: ${input.interviewDate} at ${input.interviewTime}\nFormat: ${input.interviewFormat}`,
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

      await sendEmail({ to: input.applicantEmail, subject, html, text });

      // Update status to accepted
      await updateJobApplication(input.id, { status: "accepted" });

      await notifyOwner({
        title: `Offer Letter Sent — ${input.applicantName}`,
        content: `Offer letter sent to ${input.applicantName} (${input.applicantEmail}) for ${input.role} (${input.location}).${input.startDate ? `\n\nProposed start date: ${input.startDate}` : ""}`,
      });

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
