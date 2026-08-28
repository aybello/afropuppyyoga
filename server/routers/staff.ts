import { z } from "zod";
import { randomBytes } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import twilio from "twilio";
import { adminProcedure, router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createStaffInvite,
  getStaffInviteByToken,
  getAllActiveStaff,
  revokeStaffInvite,
  updateStaffInvite,
  upsertUser,
  getUserByOpenId,
  getDb,
} from "../db";
import { sendStaffInviteEmail } from "../email";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, SEVEN_DAYS_MS } from "../../shared/const";
import { normalizeCanadianPhoneNumber } from "../../shared/phone";
import { staffPhoneAccessCodes } from "../../drizzle/schema";
import { findActiveTeamMemberByEmail, findActiveTeamMemberByPhone, resolveApyAccess } from "../apyAccess";
import { STAFF_PHONE_CODE_COOLDOWN_MS, STAFF_PHONE_CODE_MAX_ATTEMPTS, STAFF_PHONE_CODE_TTL_MS, createStaffPhoneCode, hashStaffPhoneCode, isConfiguredOwnerPhone, staffPhoneCodeMatches } from "../staffPhoneAccess";
import { getTrustedAppOrigin } from "../_core/trustedOrigin";

export const staffRouter = router({
  /**
   * Public: sends a short-lived verification code only to an active APY HQ team
   * member's saved phone. The generic response avoids revealing who is on staff.
   */
  requestPhoneAccessCode: publicProcedure
    .input(z.object({ phone: z.string().min(7).max(50) }))
    .mutation(async ({ input }) => {
      const phone = normalizeCanadianPhoneNumber(input.phone);
      if (!phone) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid Canadian mobile number." });
      const isOwner = isConfiguredOwnerPhone(phone);
      const member = isOwner ? null : await findActiveTeamMemberByPhone(phone);
      if (!isOwner && !member) return { success: true };

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Access verification is temporarily unavailable." });
      const [latest] = await db.select().from(staffPhoneAccessCodes)
        .where(eq(staffPhoneAccessCodes.phone, phone))
        .orderBy(desc(staffPhoneAccessCodes.createdAt)).limit(1);
      if (latest && latest.createdAt.getTime() > Date.now() - STAFF_PHONE_CODE_COOLDOWN_MS) return { success: true };

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_PHONE_NUMBER;
      if (!accountSid || !authToken || !from) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Phone access is not configured." });
      const code = createStaffPhoneCode();
      await db.insert(staffPhoneAccessCodes).values({ phone, codeHash: hashStaffPhoneCode(phone, code), expiresAt: new Date(Date.now() + STAFF_PHONE_CODE_TTL_MS) });
      await twilio(accountSid, authToken).messages.create({ to: phone, from, body: `Your AfroPuppyYoga APY HQ verification code is ${code}. It expires in 10 minutes. Do not share this code.` });
      return { success: true };
    }),

  /** Public: validates a single-use staff phone code and issues a seven-day session. */
  verifyPhoneAccessCode: publicProcedure
    .input(z.object({ phone: z.string().min(7).max(50), code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") }))
    .mutation(async ({ input, ctx }) => {
      const phone = normalizeCanadianPhoneNumber(input.phone);
      if (!phone) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid Canadian mobile number." });
      const isOwner = isConfiguredOwnerPhone(phone);
      const member = isOwner ? null : await findActiveTeamMemberByPhone(phone);
      if (!isOwner && !member) throw new TRPCError({ code: "UNAUTHORIZED", message: "That code is invalid or expired." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Access verification is temporarily unavailable." });
      const [record] = await db.select().from(staffPhoneAccessCodes).where(and(eq(staffPhoneAccessCodes.phone, phone), isNull(staffPhoneAccessCodes.consumedAt), gt(staffPhoneAccessCodes.expiresAt, new Date()))).orderBy(desc(staffPhoneAccessCodes.createdAt)).limit(1);
      if (!record || record.attempts >= STAFF_PHONE_CODE_MAX_ATTEMPTS || !staffPhoneCodeMatches(phone, input.code, record.codeHash)) {
        if (record) await db.update(staffPhoneAccessCodes).set({ attempts: record.attempts + 1 }).where(eq(staffPhoneAccessCodes.id, record.id));
        throw new TRPCError({ code: "UNAUTHORIZED", message: "That code is invalid or expired." });
      }
      const now = new Date();
      await db.update(staffPhoneAccessCodes).set({ consumedAt: now, attempts: record.attempts + 1 }).where(eq(staffPhoneAccessCodes.id, record.id));
      const identity = isOwner
        ? { openId: `owner-phone:${phone}`, name: "APY Owner", email: null, role: "admin" as const }
        : { openId: `staff-phone:${phone}`, name: member!.name, email: member!.email, role: "staff" as const };
      await upsertUser({ ...identity, loginMethod: "phone_otp", lastSignedIn: now });
      const sessionToken = await sdk.createSessionToken(identity.openId, { name: identity.name, expiresInMs: SEVEN_DAYS_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: SEVEN_DAYS_MS });
      return { success: true, name: identity.name, role: isOwner ? "Owner" : member!.role };
    }),

  /** Active APY HQ identity and operational authority for role-aware navigation. */
  myAccess: protectedProcedure.query(async ({ ctx }) => resolveApyAccess(ctx.user)),
  /**
   * Owner-only: invite a staff member by email.
   * Generates a magic link token and sends it via email.
   * The token is valid for 7 days (staff can re-use it to log back in).
   */
  inviteStaff: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const member = await findActiveTeamMemberByEmail(input.email);
      if (!member) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Add this person to the active APY HQ Team with this email before sending an access link." });
      }

      // Generate a secure random token
      const token = randomBytes(48).toString("hex");

      // Expires in 7 days — staff can re-use the same link to log in
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await createStaffInvite({
        name: member.name,
        email: input.email,
        token,
        expiresAt,
        isActive: 1,
      });

      const magicLink = `${getTrustedAppOrigin(input.origin)}/staff-login?token=${token}`;

      await sendStaffInviteEmail({
        to: input.email,
        name: member.name,
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
      // Staff sessions expire after 7 days — shorter TTL limits exposure if access is revoked.
      const sessionToken = await sdk.createSessionToken(staffOpenId, {
        name: invite.name,
        expiresInMs: SEVEN_DAYS_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });

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
  resendInvite: adminProcedure
    .input(z.object({ id: z.number(), origin: z.string().url() }))
    .mutation(async ({ input }) => {

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

      const magicLink = `${getTrustedAppOrigin(input.origin)}/staff-login?token=${newToken}`;

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
  listStaff: adminProcedure.query(async () => {
    return getAllActiveStaff();
  }),

  /**
   * Owner-only: revoke a staff member's access.
   *
   * Phase 4 (security hardening): also demotes the user row from role='staff' to role='user'
   * so existing session cookies are rejected on the next authenticateRequest call.
   * The session token itself is still valid in the JWT sense, but getUserByOpenId will
   * return a user with role='user', causing staffProcedure/requireStaffOrAdmin to reject them.
   */
  revokeStaff: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {

      // 1. Mark the invite as inactive (prevents future magic link logins)
      await revokeStaffInvite(input.id);

      // 2. Look up the revoked invite's email to find the associated user row
      const drizzleDb = await getDb();
      if (drizzleDb) {
        const { staffInvites } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await drizzleDb
          .select({ email: staffInvites.email })
          .from(staffInvites)
          .where(eq(staffInvites.id, input.id))
          .limit(1);

        if (rows.length > 0) {
          const staffOpenId = `staff:${rows[0].email}`;
          const existingUser = await getUserByOpenId(staffOpenId);
          if (existingUser && existingUser.role === "staff") {
            // Demote to 'user' — existing session cookies will fail staffProcedure checks
            await upsertUser({ openId: staffOpenId, role: "user" });
          }
        }
      }

      return { success: true };
    }),

});
