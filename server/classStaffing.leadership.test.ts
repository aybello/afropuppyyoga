import { describe, expect, it } from "vitest";
import { getLeadershipAssignmentEligibility } from "./classStaffing";

describe("class leadership assignment eligibility", () => {
  it("permits an active Operations Manager from the class studio who is available on the class date", () => {
    expect(getLeadershipAssignmentEligibility({
      role: "Operations Manager",
      staffRole: "Operations Manager",
      staffLocation: "KW",
      scheduleLocation: "Kitchener",
      isAway: false,
    })).toEqual({ eligible: true });
  });

  it("permits active, available Operations Managers and Yoga Instructors from another APY location", () => {
    expect(getLeadershipAssignmentEligibility({
      role: "Operations Manager",
      staffRole: "Operations Manager",
      staffLocation: "HAM",
      scheduleLocation: "Kitchener",
      isAway: false,
    })).toEqual({ eligible: true });

    expect(getLeadershipAssignmentEligibility({
      role: "Yoga Instructor",
      staffRole: "yoga_instructor",
      staffLocation: "OAK",
      scheduleLocation: "Hamilton",
      isAway: false,
    })).toEqual({ eligible: true });
  });

  it("rejects role and availability mismatches before a leader is assigned to a class", () => {
    expect(getLeadershipAssignmentEligibility({
      role: "Yoga Instructor",
      staffRole: "Operations Manager",
      staffLocation: "KW",
      scheduleLocation: "Kitchener",
      isAway: false,
    })).toEqual({ eligible: false, reason: "Choose an active Yoga Instructor for this class." });

    expect(getLeadershipAssignmentEligibility({
      role: "Yoga Instructor",
      staffRole: "Yoga Instructor",
      staffLocation: "KW",
      scheduleLocation: "Kitchener",
      isAway: true,
    })).toEqual({ eligible: false, reason: "This Yoga Instructor is unavailable on this class date." });
  });
});
