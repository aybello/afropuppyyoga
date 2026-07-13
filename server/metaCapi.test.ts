/**
 * Meta CAPI Unit Tests
 *
 * Tests:
 *  1. hashUserData — correct SHA-256 output for known inputs
 *  2. hashUserData — normalisation (trim, lowercase, E.164 phone)
 *  3. hashUserData — null/empty inputs return null (no-hash fields)
 *  4. hashUserData — phone normalisation strips country code
 *  5. hashUserData — phone too short returns null
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { hashUserData } from "./metaCapi";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("hashUserData", () => {
  it("hashes a lowercase email correctly", () => {
    const result = hashUserData({ email: "test@example.com" });
    expect(result.hashedEmail).toBe(sha256("test@example.com"));
  });

  it("normalises email to lowercase before hashing", () => {
    const result = hashUserData({ email: "  Test@Example.COM  " });
    expect(result.hashedEmail).toBe(sha256("test@example.com"));
  });

  it("hashes first and last name after lowercasing", () => {
    const result = hashUserData({ firstName: "Jane", lastName: "DOE" });
    expect(result.hashedFirstName).toBe(sha256("jane"));
    expect(result.hashedLastName).toBe(sha256("doe"));
  });

  // Meta's matching spec hashes phones WITH the country code.
  // "4165551234" and "14165551234" produce different digests; only the
  // latter matches Meta's stored hashes for North American users.
  it("adds country code 1 to a bare 10-digit NANP number", () => {
    const result = hashUserData({ phone: "416-555-1234" });
    expect(result.hashedPhone).toBe(sha256("14165551234"));
  });

  it("keeps the country code on 11-digit North American numbers", () => {
    const result = hashUserData({ phone: "+1 416 555 1234" });
    expect(result.hashedPhone).toBe(sha256("14165551234"));
  });

  it("hashes 10-digit and +1-prefixed forms of the same number identically", () => {
    const bare = hashUserData({ phone: "4165551234" });
    const prefixed = hashUserData({ phone: "+1 (416) 555-1234" });
    expect(bare.hashedPhone).toBe(prefixed.hashedPhone);
  });

  it("returns null for phone numbers shorter than 7 digits", () => {
    const result = hashUserData({ phone: "12345" });
    expect(result.hashedPhone).toBeNull();
  });

  it("returns null for null email (no-hash field)", () => {
    const result = hashUserData({ email: null });
    expect(result.hashedEmail).toBeNull();
  });

  it("returns null for undefined email (no-hash field)", () => {
    const result = hashUserData({ email: undefined });
    expect(result.hashedEmail).toBeNull();
  });

  it("returns null for empty string email (no-hash field)", () => {
    const result = hashUserData({ email: "   " });
    expect(result.hashedEmail).toBeNull();
  });

  it("returns null for null phone (no-hash field)", () => {
    const result = hashUserData({ phone: null });
    expect(result.hashedPhone).toBeNull();
  });

  it("hashes all four fields when all are provided", () => {
    const result = hashUserData({
      email: "ay@afropuppyyoga.ca",
      phone: "2895551234",
      firstName: "Ay",
      lastName: "Bello",
    });
    expect(result.hashedEmail).toBe(sha256("ay@afropuppyyoga.ca"));
    expect(result.hashedPhone).toBe(sha256("12895551234"));
    expect(result.hashedFirstName).toBe(sha256("ay"));
    expect(result.hashedLastName).toBe(sha256("bello"));
  });

  it("produces consistent output for the same input (deterministic)", () => {
    const a = hashUserData({ email: "hello@test.com" });
    const b = hashUserData({ email: "hello@test.com" });
    expect(a.hashedEmail).toBe(b.hashedEmail);
  });

  it("produces different output for different emails", () => {
    const a = hashUserData({ email: "a@test.com" });
    const b = hashUserData({ email: "b@test.com" });
    expect(a.hashedEmail).not.toBe(b.hashedEmail);
  });
});
