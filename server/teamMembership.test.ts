import { describe, expect, it } from "vitest";
import { isActiveTeamMember } from "./teamMembership";

describe("isActiveTeamMember", () => {
  it("does not treat onboarding as APY HQ membership without the explicit team flag", () => {
    expect(isActiveTeamMember({ isTeamMember: false, status: "onboarded" })).toBe(false);
    expect(isActiveTeamMember({ isTeamMember: true, status: "onboarded" })).toBe(true);
    expect(isActiveTeamMember({ isTeamMember: true, status: "accepted" })).toBe(true);
  });

  it("excludes archived or non-active records from staffing tools", () => {
    expect(isActiveTeamMember({ isTeamMember: true, status: "new" })).toBe(false);
    expect(isActiveTeamMember({ isTeamMember: true, status: "onboarded", deletedAt: new Date() })).toBe(false);
  });
});
