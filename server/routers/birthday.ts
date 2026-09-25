import { z } from "zod";
import { staffProcedure, publicProcedure, router } from "../_core/trpc";
import { getAllBirthdayInquiries, updateBirthdayInquiry } from "../db";

export const birthdayRouter = router({
  /**
   * Public: submit a birthday package inquiry.
   */
  submitInquiry: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().optional(),
        preferredDate: z.string().min(1, "Preferred date is required"),
        location: z.enum(["KW", "Hamilton"]),
        tier: z.enum(["Basic", "Premium", "Deluxe"]),
        groupSize: z.number().int().min(6, "Minimum group size is 6").max(20, "Maximum group size is 20"),
        message: z.string().optional(),
      })
    )
    .mutation(() => {
      // The public birthday page now uses privateEvents.submitInquiry. Keep the
      // old procedure only as an explicit tombstone so stale tabs and scripts
      // cannot create a record outside the current quote, approval, and
      // booking lifecycle.
      throw new Error("Birthday intake has moved to the private event quote workflow. Refresh the page and submit your request there.");
    }),

  /**
   * Admin only: get all birthday inquiries.
   */
  getAll: staffProcedure.query(async () => {
    return getAllBirthdayInquiries();
  }),

  /**
   * Admin only: update inquiry status.
   */
  updateStatus: staffProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "confirmed", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateBirthdayInquiry(input.id, { status: input.status });
      return { success: true };
    }),
});
