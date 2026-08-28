import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { normalizeCanadianPhoneNumber } from "../shared/phone";

export const STAFF_PHONE_CODE_TTL_MS = 10 * 60 * 1000;
export const STAFF_PHONE_CODE_COOLDOWN_MS = 60 * 1000;
export const STAFF_PHONE_CODE_MAX_ATTEMPTS = 5;

/**
 * The owner may use the same short-lived SMS flow as staff without depending on
 * Manus OAuth. OWNER_PHONE_NUMBER is server-controlled and is never returned to
 * the browser, so entering an arbitrary team-member number cannot grant owner
 * privileges.
 */
export function isConfiguredOwnerPhone(phone: string, configuredOwnerPhone = process.env.OWNER_PHONE_NUMBER): boolean {
  const normalizedPhone = normalizeCanadianPhoneNumber(phone);
  const normalizedOwnerPhone = normalizeCanadianPhoneNumber(configuredOwnerPhone ?? "");
  return Boolean(normalizedPhone && normalizedOwnerPhone && normalizedPhone === normalizedOwnerPhone);
}

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
