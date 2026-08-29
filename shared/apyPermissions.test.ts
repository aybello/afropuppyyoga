import { describe, expect, it } from "vitest";
import { canManageOperations, getApyAccessLevel } from "./apyPermissions";

describe("APY operational access policy", () => {
  it("permits team-management operations only to the owner and Operations Managers", () => {
    expect(canManageOperations(getApyAccessLevel("Puppy Monitor"))).toBe(false);
    expect(canManageOperations(getApyAccessLevel("Yoga Instructor"))).toBe(false);
    expect(canManageOperations(getApyAccessLevel("Operations Manager"))).toBe(true);
    expect(canManageOperations(getApyAccessLevel("Puppy Monitor", true))).toBe(true);
  });
});
