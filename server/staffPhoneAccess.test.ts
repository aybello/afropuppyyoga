import { afterEach, describe, expect, it } from "vitest";
import { STAFF_PHONE_CODE_MAX_ATTEMPTS, createStaffPhoneCode, hashStaffPhoneCode, isConfiguredOwnerPhone, resolveOwnerPhoneSessionOpenId, resolveOwnerSessionOpenId, resolvePhoneSessionIdentity, staffPhoneCodeMatches } from "./staffPhoneAccess";

const originalSecret = process.env.JWT_SECRET;

afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
});

describe("staff phone access", () => {
  it("creates six-digit codes and validates only the correct signed code", () => {
    process.env.JWT_SECRET = "test-staff-phone-access-secret";
    const code = createStaffPhoneCode();
    const phone = "+12897881885";
    const hash = hashStaffPhoneCode(phone, code);
    expect(code).toMatch(/^\d{6}$/);
    expect(staffPhoneCodeMatches(phone, code, hash)).toBe(true);
    expect(staffPhoneCodeMatches(phone, "000000", hash)).toBe(code === "000000");
  });

  it("keeps brute-force handling bounded to a small number of attempts", () => {
    expect(STAFF_PHONE_CODE_MAX_ATTEMPTS).toBe(5);
  });

  it("recognizes only the configured owner phone after Canadian number normalization", () => {
    expect(isConfiguredOwnerPhone("+12897881885", "(289) 788-1885")).toBe(true);
    expect(isConfiguredOwnerPhone("+12897881886", "(289) 788-1885")).toBe(false);
    expect(isConfiguredOwnerPhone("+12897881885", "not-a-phone")).toBe(false);
  });

  it("has a normalized secure owner phone configured for passwordless APY HQ access", () => {
    const ownerPhone = process.env.OWNER_PHONE_NUMBER;
    expect(ownerPhone).toBeTruthy();
    expect(isConfiguredOwnerPhone("+12897881885", ownerPhone)).toBe(true);
  });

  it("resolves the configured owner identity from the matching existing admin only when no direct identifier is available", () => {
    const candidates = [
      { openId: "legacy-admin", name: "Admin" },
      { openId: "owner-open-id", name: "Ay Bello" },
    ];
    expect(resolveOwnerSessionOpenId("direct-owner", "Ay Bello", candidates)).toBe("direct-owner");
    expect(resolveOwnerSessionOpenId("", "Ay Bello", candidates)).toBe("owner-open-id");
    expect(resolveOwnerSessionOpenId("", "Unknown Owner", candidates)).toBeUndefined();
    expect(resolveOwnerPhoneSessionOpenId("+12897881885", "", "Unknown Owner", candidates)).toBe("owner-phone:+12897881885");
  });

  it("keeps a verified non-owner phone bound to a staff-only identity and its active APY role", () => {
    const staffIdentity = resolvePhoneSessionIdentity({
      phone: "+12265550123",
      isOwner: false,
      ownerCandidates: [],
      member: { name: "Morgan", email: "morgan@example.com", role: "Puppy Monitor" },
    });
    expect(staffIdentity).toEqual({
      openId: "staff-phone:+12265550123",
      name: "Morgan",
      email: "morgan@example.com",
      role: "staff",
      apyRole: "Puppy Monitor",
    });
  });
});
