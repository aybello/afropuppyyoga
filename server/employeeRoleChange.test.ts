import { describe, expect, it } from "vitest";
import {
  APY_TEAM_LOCATIONS,
  APY_TEAM_ROLES,
  getApyAccessLevel,
  isCentralApyTeamRole,
  resolveLocationForRole,
} from "../shared/apyPermissions";
import { canHoldClassAssignment, canHoldLeadershipRole } from "./employeeRoleChange";

describe("moving staff between positions", () => {
  it("offers every APY position as a destination", () => {
    expect(APY_TEAM_ROLES).toContain("Puppy Monitor");
    expect(APY_TEAM_ROLES).toContain("Operations Specialist");
    expect(APY_TEAM_ROLES).toContain("Operations Manager");
    expect(APY_TEAM_ROLES).toContain("Movement Instructor");
    expect(APY_TEAM_ROLES).toContain("Yoga Instructor");
    expect(APY_TEAM_ROLES).toContain("Puppy Specialist");
    expect(APY_TEAM_ROLES).toContain("BDR");
    expect(APY_TEAM_ROLES).toContain("Social Media Specialist");
  });

  it("keeps an APY-wide position centrally assigned", () => {
    for (const role of ["BDR", "Social Media Specialist"]) {
      expect(resolveLocationForRole(role, "KW")).toBe("CENTRAL");
      expect(resolveLocationForRole(role, "GUE")).toBe("CENTRAL");
    }
  });

  it("moves a site position off CENTRAL instead of leaving an invalid pairing", () => {
    // Regression: moving away from an APY-wide role previously kept CENTRAL,
    // producing records such as "Puppy Monitor at CENTRAL".
    for (const role of APY_TEAM_ROLES.filter((value) => !isCentralApyTeamRole(value))) {
      expect(resolveLocationForRole(role, "CENTRAL")).toBe("KW");
    }
  });

  it("preserves an existing site when the new position also works on site", () => {
    expect(resolveLocationForRole("Operations Specialist", "GUE")).toBe("GUE");
    expect(resolveLocationForRole("Puppy Monitor", "HAM")).toBe("HAM");
    expect(resolveLocationForRole("Yoga Instructor", "OAK")).toBe("OAK");
  });

  it("falls back to a real site for an unrecognized saved location", () => {
    expect(APY_TEAM_LOCATIONS).toContain(resolveLocationForRole("Puppy Monitor", "ZZZ"));
  });

  it("grants operations access on promotion and withdraws it on a move away", () => {
    expect(getApyAccessLevel("Puppy Monitor")).toBe("team_member");
    expect(getApyAccessLevel("Operations Manager")).toBe("operations_manager");
    // A move out of Operations Manager drops operations permission immediately
    // because access is resolved from the saved position on each request.
    expect(getApyAccessLevel("Operations Specialist")).toBe("team_member");
  });
});

describe("upcoming duties after a position change", () => {
  it("allows class assignments only for Puppy Monitors", () => {
    expect(canHoldClassAssignment("Puppy Monitor")).toBe(true);
    expect(canHoldClassAssignment("puppy_monitor")).toBe(true);
    for (const role of ["Operations Specialist", "Operations Manager", "Yoga Instructor", "Movement Instructor", "BDR"]) {
      expect(canHoldClassAssignment(role)).toBe(false);
    }
    expect(canHoldClassAssignment(null)).toBe(false);
  });

  it("matches weekend leadership coverage to the saved position", () => {
    expect(canHoldLeadershipRole("Operations Manager", "Operations Manager")).toBe(true);
    expect(canHoldLeadershipRole("Yoga Instructor", "Yoga Instructor")).toBe(true);
    expect(canHoldLeadershipRole("Yoga Instructor", "Operations Manager")).toBe(false);
    expect(canHoldLeadershipRole("Puppy Monitor", "Operations Manager")).toBe(false);
    expect(canHoldLeadershipRole("Operations Specialist", "Yoga Instructor")).toBe(false);
  });

  it("treats stored role spellings consistently", () => {
    expect(canHoldLeadershipRole("operations manager", "Operations Manager")).toBe(true);
    expect(canHoldLeadershipRole("Operations_Manager", "Operations Manager")).toBe(true);
  });
});
