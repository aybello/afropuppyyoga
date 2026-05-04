import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { createJobApplication, getAllJobApplications, updateJobApplication } from "../db";
import { notifyOwner } from "../_core/notification";

export const careersRouter = router({
  /**
   * Public: submit a job application.
   * Video is uploaded separately via /api/upload-video and the URL is passed here.
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
        videoUrl: z.string().url().optional(),  // S3 URL from /api/upload-video
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
        status: z.enum(["new", "reviewed", "shortlisted", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateJobApplication(input.id, { status: input.status });
      return { success: true };
    }),
});
