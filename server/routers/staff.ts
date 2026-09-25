import { z } from "zod";
import { randomBytes } from "crypto";
import { and, desc, eq, gte, gt, isNull } from "drizzle-orm";
import twilio from "twilio";
import { adminProcedure, router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createStaffInvite,
  getStaffInviteByToken,
  getAllActiveStaff,
  updateStaffInvite,
  upsertUser,
  getDb,
} from "../db";
import { sendStaffInviteEmail } from "../email";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, SEVEN_DAYS_MS } from "../../shared/const";
import { normalizeCanadianPhoneNumber } from "../../shared/phone";
import { classStaffAssignments, employees, jobApplications, puppySchedule, staffInvites, staffPhoneAccessCodes, users, weekendLeadershipCoverage } from "../../drizzle/schema";
import { findActiveTeamMemberByEmail, findActiveTeamMemberByPhone, resolveApyAccess } from "../apyAccess";
import { STAFF_PHONE_CODE_COOLDOWN_MS, STAFF_PHONE_CODE_MAX_ATTEMPTS, STAFF_PHONE_CODE_TTL_MS, createStaffPhoneCode, hashStaffPhoneCode, isConfiguredOwnerPhone, resolvePhoneSessionIdentity, staffPhoneCodeMatches } from "../staffPhoneAccess";
import { getTrustedAppOrigin } from "../_core/trustedOrigin";
import { getTeamRemovalUpdate, validateTeamAssignmentChange } from "./staffAvailability";
import { isActiveTeamMember } from "../teamMembership";
import { getTorontoCalendarDate } from "../../shared/scheduleVisibility";
import { withStaffingMutationLock } from "../staffingMutationLock";

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
      const member = await findActiveTeamMemberByPhone(phone);
      const isOwner = isConfiguredOwnerPhone(phone);
      if (!member && !isOwner) return { success: true };

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
      const member = await findActiveTeamMemberByPhone(phone);
      const isOwner = isConfiguredOwnerPhone(phone);
      if (!member && !isOwner) throw new TRPCError({ code: "UNAUTHORIZED", message: "That code is invalid or expired." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Access verification is temporarily unavailable." });
      const [record] = await db.select().from(staffPhoneAccessCodes).where(and(eq(staffPhoneAccessCodes.phone, phone), isNull(staffPhoneAccessCodes.consumedAt), gt(staffPhoneAccessCodes.expiresAt, new Date()))).orderBy(desc(staffPhoneAccessCodes.createdAt)).limit(1);
      if (!record || record.attempts >= STAFF_PHONE_CODE_MAX_ATTEMPTS || !staffPhoneCodeMatches(phone, input.code, record.codeHash)) {
        if (record) await db.update(staffPhoneAccessCodes).set({ attempts: record.attempts + 1 }).where(eq(staffPhoneAccessCodes.id, record.id));
        throw new TRPCError({ code: "UNAUTHORIZED", message: "That code is invalid or expired." });
      }
      const now = new Date();
      await db.update(staffPhoneAccessCodes).set({ consumedAt: now, attempts: record.attempts + 1 }).where(eq(staffPhoneAccessCodes.id, record.id));
      const ownerCandidates = isOwner
        ? await db.select({ openId: users.openId, name: users.name }).from(users).where(eq(users.role, "admin")).orderBy(desc(users.lastSignedIn))
        : [];
      const identity = resolvePhoneSessionIdentity({
        phone,
        isOwner,
        ownerOpenId: process.env.OWNER_OPEN_ID,
        ownerName: process.env.OWNER_NAME,
        ownerCandidates,
        member: member ?? undefined,
      });
      await upsertUser({
        openId: identity.openId,
        name: identity.name,
        email: identity.email,
        loginMethod: "phone_otp",
        role: identity.role,
        lastSignedIn: now,
      });
      const sessionToken = await sdk.createSessionToken(identity.openId, { name: identity.name, expiresInMs: SEVEN_DAYS_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: SEVEN_DAYS_MS });
      return { success: true, name: identity.name, role: identity.apyRole };
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
        applicationId: member.id,
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

      if (invite.applicationId === null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This legacy access link needs to be reissued by an administrator." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Access verification is temporarily unavailable." });
      const [profile] = await db.select({
        id: jobApplications.id,
        isTeamMember: jobApplications.isTeamMember,
        status: jobApplications.status,
        deletedAt: jobApplications.deletedAt,
      }).from(jobApplications).where(eq(jobApplications.id, invite.applicationId)).limit(1);
      if (!profile || !isActiveTeamMember(profile)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This APY HQ access link has been revoked." });
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

  /** Owner-only: remove this person from APY HQ and revoke portal access safely. */
  revokeStaff: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return withStaffingMutationLock(drizzleDb, async (tx: typeof drizzleDb) => {

      const [invite] = await tx.select({ email: staffInvites.email, applicationId: staffInvites.applicationId, isActive: staffInvites.isActive }).from(staffInvites)
        .where(eq(staffInvites.id, input.id)).limit(1);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Staff invite not found" });

      const normalizedEmail = invite.email.trim().toLowerCase();
      if (invite.applicationId === null) {
        // A legacy invite has no safe profile relationship to mutate. Its
        // capability can still be revoked without touching employment history.
        await tx.update(staffInvites).set({ isActive: 0 }).where(eq(staffInvites.id, input.id));
        await tx.update(users).set({ role: "user" }).where(and(eq(users.openId, `staff:${normalizedEmail}`), eq(users.role, "staff")));
        await tx.update(users).set({ role: "user" }).where(and(eq(users.email, normalizedEmail), eq(users.role, "staff")));
        return { success: true, portalAccessRevoked: true, legacyInviteOnly: true };
      }
      const profiles = await tx.select({
        id: jobApplications.id,
        email: jobApplications.email,
        phone: jobApplications.phone,
        role: jobApplications.role,
        location: jobApplications.location,
        status: jobApplications.status,
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      }).from(jobApplications);
      const member = invite.applicationId === null ? undefined : profiles.find((profile) => (
        isActiveTeamMember(profile) && profile.id === invite.applicationId
      ));
      const historicalProfile = invite.applicationId === null ? undefined : profiles.find((profile) => profile.id === invite.applicationId);
      const profileInvites = invite.applicationId === null
        ? [{ email: invite.email }]
        : await tx.select({ email: staffInvites.email }).from(staffInvites)
          .where(eq(staffInvites.applicationId, invite.applicationId));
      const profileInviteEmails = Array.from(new Set(profileInvites.map((entry) => entry.email.trim().toLowerCase())));
      const profileIdentityEmails = Array.from(new Set(profileInviteEmails.concat(
        historicalProfile?.email ? [historicalProfile.email.trim().toLowerCase()] : [],
      )));
      if (!member) {
        if ((!historicalProfile || invite.applicationId === null) && invite.isActive) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This active access invite is not linked to one immutable APY HQ profile. Remove the actual team profile in Team & Availability, then use a newly issued invite for future access.",
          });
        }
        // No active APY HQ profile means this is only an unused or stale email
        // invite. Disable every matching capability so a stale identity cannot
        // later be mistaken for an active staff account.
        if (invite.applicationId !== null) {
          await tx.update(staffInvites).set({ isActive: 0 }).where(eq(staffInvites.applicationId, invite.applicationId));
        } else {
          await tx.update(staffInvites).set({ isActive: 0 }).where(eq(staffInvites.id, input.id));
        }
        for (const email of profileIdentityEmails) {
          await tx.update(users).set({ role: "user" }).where(and(eq(users.openId, `staff:${email}`), eq(users.role, "staff")));
          await tx.update(users).set({ role: "user" }).where(and(eq(users.email, email), eq(users.role, "staff")));
        }
        const normalizedPhone = historicalProfile?.phone ? normalizeCanadianPhoneNumber(historicalProfile.phone) : null;
        const phoneBelongsToAnotherActiveMember = normalizedPhone && profiles.some((profile) => (
          profile.id !== historicalProfile?.id
          && isActiveTeamMember(profile)
          && normalizeCanadianPhoneNumber(profile.phone ?? "") === normalizedPhone
        ));
        if (normalizedPhone && !phoneBelongsToAnotherActiveMember) {
          await tx.delete(staffPhoneAccessCodes).where(eq(staffPhoneAccessCodes.phone, normalizedPhone));
          await tx.update(users).set({ role: "user" }).where(and(eq(users.openId, `staff-phone:${normalizedPhone}`), eq(users.role, "staff")));
        }
        return { success: true, portalAccessRevoked: false };
      }

      const [operationsManagers, activePuppyMonitors] = await Promise.all([
        tx.select({ id: jobApplications.id, status: jobApplications.status, isTeamMember: jobApplications.isTeamMember, deletedAt: jobApplications.deletedAt }).from(jobApplications).where(and(
          isNull(jobApplications.deletedAt),
          eq(jobApplications.isTeamMember, true),
          eq(jobApplications.role, "Operations Manager"),
          eq(jobApplications.location, member.location),
        )),
        tx.select({ id: jobApplications.id, status: jobApplications.status, isTeamMember: jobApplications.isTeamMember, deletedAt: jobApplications.deletedAt }).from(jobApplications).where(and(
          isNull(jobApplications.deletedAt),
          eq(jobApplications.isTeamMember, true),
          eq(jobApplications.role, "Puppy Monitor"),
          eq(jobApplications.location, member.location),
        )),
      ]);
      validateTeamAssignmentChange({
        currentRole: member.role,
        currentLocation: member.location,
        nextRole: "Inactive",
        nextLocation: member.location,
        hasOperationsManagerAtNextLocation: operationsManagers.some((manager) => manager.id !== member.id && isActiveTeamMember(manager)),
        hasOtherOperationsManagerAtCurrentLocation: operationsManagers.some((manager) => manager.id !== member.id && isActiveTeamMember(manager)),
        hasActivePuppyMonitorsAtCurrentLocation: activePuppyMonitors.some(isActiveTeamMember),
        activePuppyMonitorCountAtCurrentLocation: activePuppyMonitors.filter(isActiveTeamMember).length,
      });

      const today = getTorontoCalendarDate();
      const [upcomingAssignments, upcomingLeadershipCoverage] = await Promise.all([
        tx.select({ id: classStaffAssignments.id, scheduleId: classStaffAssignments.scheduleId, classDate: puppySchedule.classDate })
          .from(classStaffAssignments)
          .innerJoin(puppySchedule, eq(classStaffAssignments.scheduleId, puppySchedule.id))
          .where(and(
            eq(classStaffAssignments.staffId, member.id),
            eq(puppySchedule.scheduleStatus, "scheduled"),
            gte(puppySchedule.classDate, today),
          )),
        tx.select({ id: weekendLeadershipCoverage.id, coverageDate: weekendLeadershipCoverage.coverageDate })
          .from(weekendLeadershipCoverage)
          .where(and(eq(weekendLeadershipCoverage.coverageStaffId, member.id), gte(weekendLeadershipCoverage.coverageDate, today))),
      ]);
      if (upcomingAssignments.length || upcomingLeadershipCoverage.length) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Reassign this person's upcoming class or weekend-coverage duties before removing APY HQ access. Historical assignments will be retained.",
        });
      }

      const removedAt = new Date();
      await tx.update(jobApplications).set(getTeamRemovalUpdate(removedAt)).where(eq(jobApplications.id, member.id));
      await tx.update(employees).set({ employmentStatus: "inactive", endedAt: removedAt }).where(eq(employees.sourceApplicationId, member.id));
      await tx.update(staffInvites).set({ isActive: 0 }).where(eq(staffInvites.applicationId, member.id));
      for (const email of profileIdentityEmails) {
        await tx.update(users).set({ role: "user" }).where(and(eq(users.openId, `staff:${email}`), eq(users.role, "staff")));
        await tx.update(users).set({ role: "user" }).where(and(eq(users.email, email), eq(users.role, "staff")));
      }
      if (member.phone) {
        const normalizedPhone = normalizeCanadianPhoneNumber(member.phone);
        const phoneBelongsToAnotherActiveMember = normalizedPhone && profiles.some((profile) => (
          profile.id !== member.id
          && isActiveTeamMember(profile)
          && normalizeCanadianPhoneNumber(profile.phone ?? "") === normalizedPhone
        ));
        if (normalizedPhone && !phoneBelongsToAnotherActiveMember) {
          await tx.delete(staffPhoneAccessCodes).where(eq(staffPhoneAccessCodes.phone, normalizedPhone));
          await tx.update(users).set({ role: "user" }).where(and(eq(users.openId, `staff-phone:${normalizedPhone}`), eq(users.role, "staff")));
        }
      }

      return { success: true, portalAccessRevoked: true };
      });
    }),

});
