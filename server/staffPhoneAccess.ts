import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { normalizeCanadianPhoneNumber } from "../shared/phone";

export const STAFF_PHONE_CODE_TTL_MS = 10 * 60 * 1000;
export const STAFF_PHONE_CODE_COOLDOWN_MS = 60 * 1000;
export const STAFF_PHONE_CODE_MAX_ATTEMPTS = 5;

export function createStaffPhoneCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashStaffPhoneCode(phone: string, code: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Secure access-code signing is not configured");
  return createHmac("sha256", secret).update(`apy-staff-access:${phone}:${code}`).digest("hex");
}

export function staffPhoneCodeMatches(phone: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashStaffPhoneCode(phone, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Matches only a configured Canadian owner phone after normalization. */
export function isConfiguredOwnerPhone(phone: string, configuredOwnerPhone = process.env.OWNER_PHONE_NUMBER): boolean {
  const ownerPhone = normalizeCanadianPhoneNumber(configuredOwnerPhone ?? "");
  return Boolean(ownerPhone && phone === ownerPhone);
}

type OwnerSessionCandidate = { openId: string; name: string | null };
type StaffSessionMember = { name: string; email: string | null; role: string };

export type PhoneSessionIdentity = {
  openId: string;
  name: string;
  email: string | null;
  role: "admin" | "staff";
  apyRole: string;
};

/**
 * Prefers the configured owner identifier and otherwise resolves the configured
 * owner name from existing admin records. The phone gate is enforced separately.
 */
export function resolveOwnerSessionOpenId(
  configuredOwnerOpenId: string | undefined,
  configuredOwnerName: string | undefined,
  candidates: OwnerSessionCandidate[],
): string | undefined {
  const directOpenId = configuredOwnerOpenId?.trim();
  if (directOpenId) return directOpenId;

  const ownerName = configuredOwnerName?.trim().toLowerCase();
  if (!ownerName) return undefined;
  return candidates.find((candidate) => candidate.name?.trim().toLowerCase() === ownerName)?.openId;
}

/**
 * A verified configured owner phone is sufficient to bootstrap its own stable
 * APY HQ owner session if legacy owner metadata is unavailable at runtime.
 */
export function resolveOwnerPhoneSessionOpenId(
  phone: string,
  configuredOwnerOpenId: string | undefined,
  configuredOwnerName: string | undefined,
  candidates: OwnerSessionCandidate[],
): string {
  return resolveOwnerSessionOpenId(configuredOwnerOpenId, configuredOwnerName, candidates) ?? `owner-phone:${phone}`;
}

/**
 * Produces an owner session only after the caller has passed the exact owner
 * phone gate. Every other verified number stays bound to its APY staff role.
 */
export function resolvePhoneSessionIdentity(input: {
  phone: string;
  isOwner: boolean;
  ownerOpenId?: string;
  ownerName?: string;
  ownerCandidates: OwnerSessionCandidate[];
  member?: StaffSessionMember;
}): PhoneSessionIdentity {
  if (input.isOwner) {
    return {
      openId: resolveOwnerPhoneSessionOpenId(input.phone, input.ownerOpenId, input.ownerName, input.ownerCandidates),
      name: input.ownerName?.trim() || "Ay Bello",
      email: null,
      role: "admin",
      apyRole: "Owner",
    };
  }
  if (!input.member) throw new Error("Active APY HQ team member is required for staff phone access");
  return {
    openId: `staff-phone:${input.phone}`,
    name: input.member.name,
    email: input.member.email,
    role: "staff",
    apyRole: input.member.role,
  };
}
