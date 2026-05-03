import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { createBirthdayInquiry, getAllBirthdayInquiries, updateBirthdayInquiry } from "../db";
import { notifyOwner } from "../_core/notification";

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
    .mutation(async ({ input }) => {
      // Save to DB
      await createBirthdayInquiry({
        name: input.name,
        email: input.email,
        phone: input.phone,
        preferredDate: input.preferredDate,
        location: input.location,
        tier: input.tier,
        groupSize: input.groupSize,
        message: input.message,
      });

      // Notify owner
      const tierPrices = { Basic: "$600", Premium: "$900", Deluxe: "$1,200" };
      await notifyOwner({
        title: `🎂 New Birthday Package Inquiry — ${input.tier} (${tierPrices[input.tier]})`,
        content: `**Name:** ${input.name}
**Email:** ${input.email}
**Phone:** ${input.phone ?? "Not provided"}
**Package:** ${input.tier} — ${tierPrices[input.tier]}
**Location:** ${input.location}
**Preferred Date:** ${input.preferredDate}
**Group Size:** ${input.groupSize} people
**Message:** ${input.message ?? "None"}

Please confirm availability and follow up within 24 hours.`,
      });

      return { success: true };
    }),

  /**
   * Admin only: get all birthday inquiries.
   */
  getAll: adminProcedure.query(async () => {
    return getAllBirthdayInquiries();
  }),

  /**
   * Admin only: update inquiry status.
   */
  updateStatus: adminProcedure
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
