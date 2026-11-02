import { createHash, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import type { getDb } from "./db";
import { ENV } from "./_core/env";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

// SHA-256 of the independently verified owner OAuth subject. This is an
// identifier, not a secret; changing it requires a reviewed code deployment.
const OWNER_SUBJECT_SHA256_ALLOWLIST = Object.freeze([
  "48a298ad24d31a86dfdaf645ab845f97499dfad52b4250b9bf666182b7c5d2e3",
] as const);

// Independently authorized recovery address; a DB email change alone must not
// redirect owner codes. Updating this pin requires a reviewed code deployment.
const OWNER_RECOVERY_EMAIL = "belllo.ayoola@gmail.com";

function isPinnedSubject(openId: string): boolean {
  const digest = createHash("sha256").update(openId, "utf8").digest("hex");
  return (OWNER_SUBJECT_SHA256_ALLOWLIST as readonly string[]).includes(digest);
}

/** Require the pinned subject, admin role and independently pinned recovery address. */
export async function resolveTrustedOwner(db: Database) {
  const configuredId = process.env.OWNER_OPEN_ID;
  const hasConfiguredId = configuredId !== undefined && configuredId !== "";
  if (hasConfiguredId && !isPinnedSubject(configuredId)) return null;

  const selection = { openId: users.openId, name: users.name, email: users.email, role: users.role };
  // A database collation may make subject equality case-insensitive. Verify the
  // exact returned bytes and role in JavaScript, rather than trusting equality.
  const candidates = hasConfiguredId
    ? await db.select(selection).from(users).where(eq(users.openId, configuredId))
    : await db.select(selection).from(users).where(eq(users.role, "admin"));
  const matches = candidates.filter((candidate) =>
    candidate.role === "admin" &&
    typeof candidate.openId === "string" &&
    (!hasConfiguredId || candidate.openId === configuredId) &&
    isPinnedSubject(candidate.openId)
  );
  if (matches.length !== 1 || typeof matches[0].email !== "string" ||
      matches[0].email.trim().toLowerCase() !== OWNER_RECOVERY_EMAIL) return null;
  return matches[0];
}

/** JWTs are readable: use a domain-separated keyed digest, never the recovery email. */
export function ownerEmailFingerprint(openId: string, email: string): string {
  if (!ENV.cookieSecret) throw new Error("Secure session signing is not configured");
  return createHmac("sha256", ENV.cookieSecret)
    .update("apy-owner-email-session-v1\0").update(openId).update("\0")
    .update(email.trim().toLowerCase()).digest("hex");
}
