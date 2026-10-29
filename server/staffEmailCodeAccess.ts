import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { jobApplications, staffEmailAccessCodes, users } from "../drizzle/schema";
import { findActiveTeamMemberByEmail } from "./apyAccess";
import { getDb } from "./db";
import { sendStaffEmailAccessCode } from "./email";
import { withStaffingMutationLock } from "./staffingMutationLock";
import { isActiveTeamMember } from "./teamMembership";

export const STAFF_EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const STAFF_EMAIL_CODE_COOLDOWN_MS = 60 * 1000;
export const STAFF_EMAIL_CODE_MAX_ATTEMPTS = 5;
const GENERIC_RESULT = { success: true } as const;

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type EmailCodeIdentity = {
  kind: "owner" | "staff";
  applicationId: number | null;
  ownerOpenId: string | null;
  email: string;
  name: string;
  openId: string;
  role: "admin" | "staff";
};

export function createStaffEmailCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashStaffEmailCode(email: string, code: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Secure access-code signing is not configured");
  return createHmac("sha256", secret).update(`apy-staff-email-access:${email}:${code}`).digest("hex");
}

export function staffEmailCodeMatches(email: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashStaffEmailCode(email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function findConfiguredOwnerByEmail(db: Database, email: string): Promise<EmailCodeIdentity | null> {
  const ownerOpenId = process.env.OWNER_OPEN_ID?.trim();
  if (!ownerOpenId) return null;
  const [owner] = await db.select({
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
  }).from(users).where(eq(users.openId, ownerOpenId)).limit(1);
  if (!owner || owner.role !== "admin" || owner.email?.trim().toLowerCase() !== email) return null;
  return {
    kind: "owner",
    applicationId: null,
    ownerOpenId: owner.openId,
    email,
    name: owner.name?.trim() || "Ay Bello",
    openId: owner.openId,
    role: "admin",
  };
}

async function findEmailCodeIdentity(db: Database, email: string): Promise<EmailCodeIdentity | null> {
  const member = await findActiveTeamMemberByEmail(email);
  if (member) {
    return {
      kind: "staff",
      applicationId: member.id,
      ownerOpenId: null,
      email,
      name: member.name,
      openId: `staff:${email}`,
      role: "staff",
    };
  }
  return findConfiguredOwnerByEmail(db, email);
}

async function recheckEmailCodeIdentity(tx: Database, identity: EmailCodeIdentity): Promise<EmailCodeIdentity | null> {
  if (identity.kind === "owner") return findConfiguredOwnerByEmail(tx, identity.email);
  const [profile] = await tx.select().from(jobApplications).where(eq(jobApplications.id, identity.applicationId!)).limit(1);
  if (!profile || !isActiveTeamMember(profile) || profile.email?.trim().toLowerCase() !== identity.email) return null;
  return {
    kind: "staff",
    applicationId: profile.id,
    ownerOpenId: null,
    email: identity.email,
    name: profile.name,
    openId: `staff:${identity.email}`,
    role: "staff",
  };
}

/** Sends a code only to an active APY HQ staff email or the configured owner email. */
export async function requestStaffEmailAccessCode(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  if (!db) throw new Error("Access verification is temporarily unavailable.");
  const identity = await findEmailCodeIdentity(db, normalizedEmail);
  if (!identity) return GENERIC_RESULT;

  const code = createStaffEmailCode();
  const now = new Date();
  const issued = await withStaffingMutationLock(db, async (tx) => {
    const currentIdentity = await recheckEmailCodeIdentity(tx as Database, identity);
    if (!currentIdentity || currentIdentity.openId !== identity.openId) return false;
    const [latest] = await tx.select({ createdAt: staffEmailAccessCodes.createdAt }).from(staffEmailAccessCodes)
      .where(eq(staffEmailAccessCodes.email, normalizedEmail))
      .orderBy(desc(staffEmailAccessCodes.createdAt)).limit(1);
    if (latest && latest.createdAt.getTime() > now.getTime() - STAFF_EMAIL_CODE_COOLDOWN_MS) return false;

    await tx.insert(staffEmailAccessCodes).values({
      email: normalizedEmail,
      identityType: identity.kind,
      applicationId: identity.applicationId,
      ownerOpenId: identity.ownerOpenId,
      codeHash: hashStaffEmailCode(normalizedEmail, code),
      expiresAt: new Date(now.getTime() + STAFF_EMAIL_CODE_TTL_MS),
    });
    return true;
  });
  if (!issued) return GENERIC_RESULT;

  try {
    await sendStaffEmailAccessCode({ to: normalizedEmail, name: identity.name, code });
  } catch {
    await db.update(staffEmailAccessCodes).set({ consumedAt: new Date() })
      .where(and(eq(staffEmailAccessCodes.email, normalizedEmail), isNull(staffEmailAccessCodes.consumedAt), gt(staffEmailAccessCodes.expiresAt, now)));
    console.warn("[Staff email code] Email delivery failed; the new verification code was revoked.");
  }
  return GENERIC_RESULT;
}

/** Verifies a single-use six-digit code and returns the authorized APY identity. */
export async function verifyStaffEmailAccessCode(email: string, code: string): Promise<EmailCodeIdentity> {
  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Access verification is temporarily unavailable." });
  return withStaffingMutationLock(db, async (tx) => {
    const identity = await findEmailCodeIdentity(tx as Database, normalizedEmail);
    const invalid = () => new TRPCError({ code: "UNAUTHORIZED", message: "That code is invalid or expired." });
    if (!identity) throw invalid();

    const [record] = await tx.select().from(staffEmailAccessCodes)
      .where(and(eq(staffEmailAccessCodes.email, normalizedEmail), isNull(staffEmailAccessCodes.consumedAt), gt(staffEmailAccessCodes.expiresAt, new Date())))
      .orderBy(desc(staffEmailAccessCodes.createdAt)).limit(1);
    const bindsIdentity = record
      && record.identityType === identity.kind
      && record.applicationId === identity.applicationId
      && record.ownerOpenId === identity.ownerOpenId;
    if (!record || !bindsIdentity || record.attempts >= STAFF_EMAIL_CODE_MAX_ATTEMPTS) throw invalid();
    if (!staffEmailCodeMatches(normalizedEmail, code, record.codeHash)) {
      if (record) await tx.update(staffEmailAccessCodes).set({ attempts: record.attempts + 1 }).where(eq(staffEmailAccessCodes.id, record.id));
      throw invalid();
    }

    const currentIdentity = await recheckEmailCodeIdentity(tx as Database, identity);
    if (!currentIdentity || currentIdentity.openId !== identity.openId) throw invalid();
    const now = new Date();
    await tx.update(staffEmailAccessCodes).set({ consumedAt: now, attempts: record.attempts + 1 }).where(eq(staffEmailAccessCodes.id, record.id));
    return currentIdentity;
  });
}
