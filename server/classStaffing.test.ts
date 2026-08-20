import { describe, expect, it } from "vitest";
import { isClassFullyStaffed, scheduleLocationToTeamLocation, staffingGaps } from "./classStaffing";

describe("class staffing requirements", () => {
  it("maps breeder calendar studio names to the staff team locations", () => {
    expect(scheduleLocationToTeamLocation("Kitchener")).toBe("KW");
    expect(scheduleLocationToTeamLocation("Hamilton")).toBe("HAM");
    expect(scheduleLocationToTeamLocation("Oakville")).toBe("OAK");
  });

  it("requires exactly two Puppy Monitors alongside leadership coverage", () => {
    expect(staffingGaps({ operationsManager: true, yogaInstructor: true, puppyMonitorCount: 0 })).toEqual({ operationsManager: false, yogaInstructor: false, puppyMonitors: 2 });
    expect(isClassFullyStaffed({ operationsManager: true, yogaInstructor: true, puppyMonitorCount: 1 })).toBe(false);
    expect(isClassFullyStaffed({ operationsManager: true, yogaInstructor: true, puppyMonitorCount: 2 })).toBe(true);
  });
});
