import { z } from "zod";
import { randomBytes } from "crypto";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createStaffInvite,
  getStaffInviteByToken,
  getAllActiveStaff,
  revokeStaffInvite,
  updateStaffInvite,
} from "../db";
import { sendStaffInviteEmail } from "../email";
import { ENV } from "../_core/env";

export const staffRouter = router({
  /**
   * Owner-only: invite a staff member by email.
   * Generates a magic link token and sends it via email.
   * The token is valid for 7 days (staff can re-use it to log back in).
   */
  inviteStaff: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can invite staff" });
      }

      // Generate a secure random token
      const token = randomBytes(48).toString("hex");

      // Expires in 7 days — staff can re-use the same link to log in
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await createStaffInvite({
        name: input.name,
        email: input.email,
        token,
        expiresAt,
        isActive: 1,
      });

      const magicLink = `${input.origin}/staff-login?token=${token}`;

      await sendStaffInviteEmail({
        to: input.email,
        name: input.name,
        magicLink,
      });

      return { success: true };
    }),

  /**
   * Public: verify a magic link token and return staff info.
   * The frontend uses this to establish a staff session via a cookie.
   * Token must be active and not expired.
   */
  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const invite = await getStaffInviteByToken(input.token);

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired link" });
      }

      if (!invite.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This access link has been revoked" });
      }

      if (invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This link has expired. Please ask for a new invite." });
      }

      // Update last used timestamp and first used timestamp
      const now = new Date();
      await updateStaffInvite(invite.id, {
        lastUsedAt: now,
        firstUsedAt: invite.firstUsedAt ?? now,
      });

      return {
        id: invite.id,
        name: invite.name,
        email: invite.email,
        token: invite.token,
      };
    }),

  /**
   * Owner-only: list all active staff members.
   */
  listStaff: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return getAllActiveStaff();
  }),

  /**
   * Owner-only: revoke a staff member's access.
   */
  revokeStaff: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await revokeStaffInvite(input.id);
      return { success: true };
    }),
});
