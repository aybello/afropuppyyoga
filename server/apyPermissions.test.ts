import { describe, expect, it } from "vitest";
import { canAccessHubTool, canManageOperations, getApyAccessLevel, isOperationsManagerRole } from "../shared/apyPermissions";

describe("APY HQ role permissions", () => {
  it("treats Operations Manager spelling variants as operational administrators", () => {
    expect(isOperationsManagerRole("Operations Manager")).toBe(true);
    expect(isOperationsManagerRole("operations_manager")).toBe(true);
    expect(getApyAccessLevel("Operations Manager")).toBe("operations_manager");
  });

  it("gives Operations Managers every operational tool but no owner-only financial tool", () => {
    expect(canManageOperations("operations_manager")).toBe(true);
    expect(canAccessHubTool("operations_manager", "operations")).toBe(true);
    expect(canAccessHubTool("operations_manager", "team")).toBe(true);
    expect(canAccessHubTool("operations_manager", "owner")).toBe(false);
  });

  it("keeps Yoga Instructors and Puppy Monitors in team-only access", () => {
    expect(getApyAccessLevel("Yoga Instructor")).toBe("team_member");
    expect(getApyAccessLevel("Puppy Monitor")).toBe("team_member");
    expect(canManageOperations("team_member")).toBe(false);
    expect(canAccessHubTool("team_member", "team")).toBe(true);
    expect(canAccessHubTool("team_member", "operations")).toBe(false);
  });
});
