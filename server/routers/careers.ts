import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { createJobApplication, getAllJobApplications, updateJobApplication } from "../db";
import { notifyOwner } from "../_core/notification";

function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

export const careersRouter = router({
  /**
   * Public: submit a job application with optional video upload.
   * Video is base64-encoded and uploaded to S3.
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
        videoBase64: z.string().optional(), // base64-encoded video
        videoFilename: z.string().optional(),
        videoMimeType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      let videoUrl: string | undefined;
      let videoKey: string | undefined;

      // Upload video to S3 if provided
      if (input.videoBase64 && input.videoFilename) {
        const buffer = Buffer.from(input.videoBase64, "base64");
        const ext = input.videoFilename.split(".").pop() ?? "mp4";
        videoKey = `applications/${Date.now()}-${randomSuffix()}.${ext}`;
        const mimeType = input.videoMimeType ?? "video/mp4";
        const result = await storagePut(videoKey, buffer, mimeType);
        videoUrl = result.url;
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
        videoUrl: videoUrl ?? null,
        videoKey: videoKey ?? null,
        status: "new",
      });

      // Send email notification to owner
      const videoLine = videoUrl
        ? `\n\nVideo Application: ${videoUrl}`
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
