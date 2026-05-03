import { z } from "zod";
import { publicProcedure, protectedProcedure } from "../_core/trpc";
import { router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createPartnershipInquiry,
  getAllPartnershipInquiries,
  updatePartnershipInquiry,
} from "../db";
import { notifyOwner } from "../_core/notification";

const PARTNERSHIP_TYPES = [
  "Corporate Wellness",
  "Brand Collaboration",
  "Media & Production",
  "Local Business",
  "Breeder Partnership",
] as const;

export const partnershipRouter = router({
  submitInquiry: publicProcedure
    .input(
      z.object({
        partnershipType: z.enum(PARTNERSHIP_TYPES),
        organizationName: z.string().min(2).max(255),
        contactName: z.string().min(2).max(255),
        email: z.string().email(),
        phone: z.string().max(50).optional(),
        website: z.string().url().optional().or(z.literal("")),
        proposal: z.string().min(20).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      await createPartnershipInquiry({
        partnershipType: input.partnershipType,
        organizationName: input.organizationName,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone ?? null,
        website: input.website || null,
        proposal: input.proposal,
      });

      // Notify owner
      await notifyOwner({
        title: `New Partnership Inquiry: ${input.partnershipType}`,
        content: `**${input.organizationName}** (${input.contactName}) has submitted a ${input.partnershipType} partnership inquiry.\n\n**Email:** ${input.email}\n**Phone:** ${input.phone ?? "Not provided"}\n**Website:** ${input.website || "Not provided"}\n\n**Proposal:**\n${input.proposal}`,
      });

      return { success: true };
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return getAllPartnershipInquiries();
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "reviewing", "active", "declined"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await updatePartnershipInquiry(input.id, { status: input.status });
      return { success: true };
    }),
});
