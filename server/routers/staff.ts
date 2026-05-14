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
  upsertUser,
} from "../db";
import { sendStaffInviteEmail } from "../email";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";

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
   * Public: verify a magic link token and set a real session cookie.
   * This upserts a user record with role "staff" so useAuth() recognises them
   * and admin pages that check role === "staff" grant access.
   */
  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
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

      // Use a synthetic openId so staff don't need a Manus OAuth account.
      // Prefix with "staff:" to avoid collisions with real Manus openIds.
      const staffOpenId = `staff:${invite.email}`;

      // Upsert a user record with role "staff" so authenticateRequest returns them.
      await upsertUser({
        openId: staffOpenId,
        name: invite.name,
        email: invite.email,
        loginMethod: "magic_link",
        role: "staff",
        lastSignedIn: now,
      });

      // Create a real session cookie (same mechanism as Manus OAuth).
      const sessionToken = await sdk.createSessionToken(staffOpenId, {
        name: invite.name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return {
        id: invite.id,
        name: invite.name,
        email: invite.email,
      };
    }),

  /**
   * Owner-only: resend a magic link invite to an existing staff member.
   * Regenerates a fresh token and resets the 7-day expiry window.
   */
  resendInvite: protectedProcedure
    .input(z.object({ id: z.number(), origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can resend invites" });
      }

      // Look up the existing invite
      const db = await import("../db");
      const allStaff = await db.getAllActiveStaff();
      const invite = allStaff.find((s) => s.id === input.id);

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found" });
      }

      // Generate a fresh token and reset expiry to 7 days from now
      const newToken = randomBytes(48).toString("hex");
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await updateStaffInvite(invite.id, {
        token: newToken,
        expiresAt: newExpiresAt,
        isActive: 1,
      });

      const magicLink = `${input.origin}/staff-login?token=${newToken}`;

      await sendStaffInviteEmail({
        to: invite.email,
        name: invite.name,
        magicLink,
      });

      return { success: true };
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
