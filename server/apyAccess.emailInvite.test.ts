import { describe, expect, it } from "vitest";
import { findActiveTeamEmailCandidate } from "./apyAccess";

describe("APY HQ email invite eligibility", () => {
  it("selects only the active manually managed team member matching the invite email", () => {
    const candidates = [
      { isTeamMember: false, status: "onboarded", deletedAt: null, email: "applicant@example.com", role: "Puppy Monitor" },
      { isTeamMember: true, status: "new", deletedAt: null, email: "pending@example.com", role: "Yoga Instructor" },
      { isTeamMember: true, status: "accepted", deletedAt: null, email: "ops@example.com", role: "Operations Manager" },
    ];

    expect(findActiveTeamEmailCandidate(candidates, "OPS@example.com")).toEqual(candidates[2]);
    expect(findActiveTeamEmailCandidate(candidates, "applicant@example.com")).toBeNull();
    expect(findActiveTeamEmailCandidate(candidates, "pending@example.com")).toBeNull();
  });
});
