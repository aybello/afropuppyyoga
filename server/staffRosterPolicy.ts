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
export function validateTeamAssignmentChange(_input: TeamAssignmentChange) {
  // Roles and locations are validated by the mutation schema. Coverage is an
  // advisory planning view, never a prerequisite for authorised roster edits.
}

export function getOperationsManagerDepartureEligibility(_input: {
  employeeId: number; employeeRole: string; activeLocationEmployees: Array<{ id: number; role: string }>; isOwner?: boolean;
}) {
  return { eligible: true as const };
}

export function canNotifyAssignedEventTeam(input: {
  isOwner: boolean;
  fullyStaffed: boolean;
  recipientCount: number;
}) {
  return input.recipientCount > 0 && (input.isOwner || input.fullyStaffed);
}
