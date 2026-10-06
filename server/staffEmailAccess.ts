import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { jobApplications, staffInvites } from "../drizzle/schema";
import { getDb } from "./db";
import { findActiveTeamMemberByEmail } from "./apyAccess";
import { sendStaffSignInEmail } from "./email";
import { getTrustedAppOrigin } from "./_core/trustedOrigin";
import { withStaffingMutationLock } from "./staffingMutationLock";
import { isActiveTeamMember } from "./teamMembership";

export const STAFF_EMAIL_SIGN_IN_PREFIX = "signin_";
export const STAFF_EMAIL_SIGN_IN_TTL_MS = 15 * 60 * 1000;
export const STAFF_EMAIL_REQUEST_COOLDOWN_MS = 60 * 1000;
const GENERIC_RESULT = { success: true } as const;

/** Only an existing active staff identity can receive a sign-in link. Never falls back to the owner. */
export async function requestStaffEmailAccess(email: string, origin?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const member = await findActiveTeamMemberByEmail(normalizedEmail);
  if (!member) return GENERIC_RESULT;
  const db = await getDb();
  if (!db) throw new Error("Sign-in is temporarily unavailable.");
  const token = `${STAFF_EMAIL_SIGN_IN_PREFIX}${randomBytes(48).toString("hex")}`;
  const now = new Date();
  const issued = await withStaffingMutationLock(db, async (tx) => {
    const [profile] = await tx.select().from(jobApplications).where(eq(jobApplications.id, member.id)).limit(1);
    if (!profile || !isActiveTeamMember(profile) || profile.email?.trim().toLowerCase() !== normalizedEmail) return false;
    const recent = await tx.select({ createdAt: staffInvites.createdAt }).from(staffInvites)
      .where(and(eq(staffInvites.applicationId, member.id), eq(staffInvites.email, normalizedEmail)))
      .orderBy(desc(staffInvites.createdAt)).limit(5);
    if (recent[0] && recent[0].createdAt.getTime() > now.getTime() - STAFF_EMAIL_REQUEST_COOLDOWN_MS) return false;
    if (recent.length >= 5 && recent[4].createdAt.getTime() > now.getTime() - STAFF_EMAIL_SIGN_IN_TTL_MS) return false;
    await tx.insert(staffInvites).values({ applicationId: member.id, name: profile.name, email: normalizedEmail, token, isActive: 1, expiresAt: new Date(now.getTime() + STAFF_EMAIL_SIGN_IN_TTL_MS) });
    return true;
  });
  if (!issued) return GENERIC_RESULT;
  try {
    await sendStaffSignInEmail({ to: normalizedEmail, name: member.name, magicLink: `${getTrustedAppOrigin(origin)}/staff-login?token=${token}` });
  } catch {
    await db.update(staffInvites).set({ isActive: 0 }).where(eq(staffInvites.token, token));
    // A generic response prevents this public endpoint from revealing staff membership.
    console.warn("[Staff sign-in] Email delivery failed; the new sign-in link was revoked.");
  }
  return GENERIC_RESULT;
}

/** Consumes only new self-service sign-in links. Existing seven-day staff invitations retain their contract. */
export async function consumeStaffEmailSignIn(token: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sign-in is temporarily unavailable." });
  return withStaffingMutationLock(db, async (tx) => {
    const [invite] = await tx.select().from(staffInvites).where(eq(staffInvites.token, token)).limit(1);
    const invalid = () => new TRPCError({ code: "UNAUTHORIZED", message: "This sign-in link is invalid or expired. Request a new link with your own staff email." });
    if (!invite || !invite.isActive || invite.firstUsedAt || invite.expiresAt <= new Date() || invite.applicationId === null) throw invalid();
    const [profile] = await tx.select().from(jobApplications).where(eq(jobApplications.id, invite.applicationId)).limit(1);
    if (!profile || !isActiveTeamMember(profile) || profile.email?.trim().toLowerCase() !== invite.email) throw invalid();
    const now = new Date();
    await tx.update(staffInvites).set({ isActive: 0, firstUsedAt: now, lastUsedAt: now }).where(eq(staffInvites.id, invite.id));
    return { name: profile.name as string, email: invite.email as string };
  });
}
