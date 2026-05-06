import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";

export const privateEventsRouter = router({
  submitInquiry: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        eventType: z.string().min(1),
        guests: z.number().min(1),
        location: z.string().min(1),
        packageType: z.enum(["base", "deluxe", "vip"]),
        preferredDate: z.string().optional().default(""),
        notes: z.string().optional().default(""),
        estimatedMin: z.number(),
        estimatedMax: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const packageLabel =
        input.packageType === "base"
          ? "Base ($1,200–$1,500)"
          : input.packageType === "deluxe"
          ? "Deluxe ($1,950–$2,250)"
          : "VIP ($3,000+)";

      const estimateStr =
        input.estimatedMin > 0
          ? `$${input.estimatedMin.toLocaleString()} – $${input.estimatedMax.toLocaleString()} CAD`
          : "Custom VIP quote";

      const notifContent = [
        `📋 NEW PRIVATE EVENT INQUIRY`,
        ``,
        `👤 Name: ${input.name}`,
        `📧 Email: ${input.email}`,
        `📞 Phone: ${input.phone || "Not provided"}`,
        ``,
        `🎉 Event Type: ${input.eventType}`,
        `👥 Guests: ${input.guests}`,
        `📍 Location: ${input.location}`,
        `📦 Package: ${packageLabel}`,
        `📅 Preferred Date: ${input.preferredDate || "Not specified"}`,
        ``,
        `💰 Estimated Quote: ${estimateStr}`,
        ``,
        `📝 Notes: ${input.notes || "None"}`,
      ].join("\n");

      await notifyOwner({
        title: `Private Event Inquiry — ${input.name} (${input.guests} guests, ${input.location})`,
        content: notifContent,
      });

      return { success: true };
    }),
});
