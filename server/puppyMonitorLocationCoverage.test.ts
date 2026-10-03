import { describe, expect, it } from "vitest";
import { getPuppyMonitorLocationCoverage, PUPPY_MONITOR_LOCATION_TARGET } from "../shared/puppyMonitorLocationCoverage";
import { canNotifyAssignedEventTeam, getOperationsManagerDepartureEligibility, validateTeamAssignmentChange } from "./staffRosterPolicy";

describe("advisory Puppy Monitor roster target", () => {
  it("keeps six as a visible target, not a cap or mutation prerequisite", () => {
    expect(PUPPY_MONITOR_LOCATION_TARGET).toBe(6);
    expect(getPuppyMonitorLocationCoverage(5)).toEqual({ activeCount: 5, target: 6, shortfall: 1, meetsTarget: false });
    expect(getPuppyMonitorLocationCoverage(6)).toEqual({ activeCount: 6, target: 6, shortfall: 0, meetsTarget: true });
    expect(getPuppyMonitorLocationCoverage(7)).toEqual({ activeCount: 7, target: 6, shortfall: 0, meetsTarget: true });
  });

  it.each([0, 1, 5, 6, 7])("allows owner moves, role changes and deactivation with %i monitors", (count) => {
    for (const nextRole of ["Puppy Monitor", "Yoga Instructor", "Inactive"]) {
      expect(() => validateTeamAssignmentChange({
        currentRole: "Puppy Monitor", currentLocation: "KW", nextRole, nextLocation: "OAK",
        hasOperationsManagerAtNextLocation: false, hasOtherOperationsManagerAtCurrentLocation: false,
        hasActivePuppyMonitorsAtCurrentLocation: count > 0, activePuppyMonitorCountAtCurrentLocation: count, isOwner: true,
      })).not.toThrow();
    }
  });

  it("does not enforce six even for operational managers", () => {
    expect(() => validateTeamAssignmentChange({ currentRole: "Puppy Monitor", currentLocation: "KW", nextRole: "Inactive", nextLocation: "KW",
      hasOperationsManagerAtNextLocation: true, hasOtherOperationsManagerAtCurrentLocation: true,
      hasActivePuppyMonitorsAtCurrentLocation: true, activePuppyMonitorCountAtCurrentLocation: 1 })).not.toThrow();
  });

  it("lets the owner move or deactivate the sole manager", () => {
    expect(() => validateTeamAssignmentChange({ currentRole: "Operations Manager", currentLocation: "KW", nextRole: "Inactive", nextLocation: "KW",
      hasOperationsManagerAtNextLocation: false, hasOtherOperationsManagerAtCurrentLocation: false,
      hasActivePuppyMonitorsAtCurrentLocation: true, isOwner: true })).not.toThrow();
    expect(getOperationsManagerDepartureEligibility({ employeeId: 1, employeeRole: "Operations Manager", activeLocationEmployees: [{ id: 1, role: "Operations Manager" }, { id: 2, role: "Puppy Monitor" }], isOwner: true })).toEqual({ eligible: true });
  });

  it("lets owners notify assigned staff without a manager but does not send to an empty team", () => {
    expect(canNotifyAssignedEventTeam({ isOwner: true, fullyStaffed: false, recipientCount: 2 })).toBe(true);
    expect(canNotifyAssignedEventTeam({ isOwner: true, fullyStaffed: false, recipientCount: 0 })).toBe(false);
    expect(canNotifyAssignedEventTeam({ isOwner: false, fullyStaffed: false, recipientCount: 2 })).toBe(false);
  });
});
