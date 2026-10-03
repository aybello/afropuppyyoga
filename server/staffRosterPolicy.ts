import { isOperationsManagerRole, normalizeApyRole } from "../shared/apyPermissions";

export type TeamAssignmentChange = {
  currentRole: string;
  currentLocation: string;
  nextRole: string;
  nextLocation: string;
  hasOperationsManagerAtNextLocation: boolean;
  hasOtherOperationsManagerAtCurrentLocation: boolean;
  hasActivePuppyMonitorsAtCurrentLocation: boolean;
  activePuppyMonitorCountAtCurrentLocation?: number;
  /** Must come from authenticated ctx.apyAccess, never mutation input. */
  isOwner?: boolean;
};

/** Six monitors is a planning target, never a mutation prerequisite. */
export function validateTeamAssignmentChange(input: TeamAssignmentChange) {
  if (input.isOwner) return;
  if (normalizeApyRole(input.nextRole) === "puppy monitor" && !input.hasOperationsManagerAtNextLocation) {
    throw new Error("Add or retain an Operations Manager at this location before assigning Puppy Monitors.");
  }
  const movesOperationsManager = isOperationsManagerRole(input.currentRole)
    && (!isOperationsManagerRole(input.nextRole) || input.nextLocation !== input.currentLocation);
  if (movesOperationsManager && input.hasActivePuppyMonitorsAtCurrentLocation && !input.hasOtherOperationsManagerAtCurrentLocation) {
    throw new Error("Assign another Operations Manager to this Puppy Monitor location before changing this team member.");
  }
}

export function getOperationsManagerDepartureEligibility(input: {
  employeeId: number;
  employeeRole: string;
  activeLocationEmployees: Array<{ id: number; role: string }>;
  isOwner?: boolean;
}) {
  if (input.isOwner || !isOperationsManagerRole(input.employeeRole)) return { eligible: true as const };
  const hasOtherOperationsManager = input.activeLocationEmployees.some((person) => person.id !== input.employeeId && isOperationsManagerRole(person.role));
  const hasActivePuppyMonitor = input.activeLocationEmployees.some((person) => normalizeApyRole(person.role) === "puppy monitor");
  if (hasActivePuppyMonitor && !hasOtherOperationsManager) {
    return { eligible: false as const, reason: "Assign another active Operations Manager before ending employment for this location's sole Operations Manager." };
  }
  return { eligible: true as const };
}

export function canNotifyAssignedEventTeam(input: {
  isOwner: boolean;
  fullyStaffed: boolean;
  recipientCount: number;
}) {
  return input.recipientCount > 0 && (input.isOwner || input.fullyStaffed);
}
