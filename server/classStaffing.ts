export const TWO_PUPPY_MONITORS_REQUIRED = 2;
export const MAX_PUPPY_MONITORS_PER_CLASS = 3;

export function getPuppyMonitorAssignmentEligibility(input: { assignedCount: number; alreadyAssigned: boolean }) {
  if (input.alreadyAssigned) {
    return { eligible: false as const, reason: "This Puppy Monitor is already assigned to this class." };
  }
  if (input.assignedCount >= MAX_PUPPY_MONITORS_PER_CLASS) {
    return { eligible: false as const, reason: `This class already has the maximum ${MAX_PUPPY_MONITORS_PER_CLASS} Puppy Monitors.` };
  }
  return { eligible: true as const };
}

export function scheduleLocationToTeamLocation(location: "Kitchener" | "Hamilton" | "Oakville") {
  return location === "Kitchener" ? "KW" : location === "Hamilton" ? "HAM" : "OAK";
}

export function staffingGaps(input: { operationsManager: boolean; yogaInstructor: boolean; puppyMonitorCount: number }) {
  return {
    operationsManager: !input.operationsManager,
    yogaInstructor: !input.yogaInstructor,
    puppyMonitors: Math.max(0, TWO_PUPPY_MONITORS_REQUIRED - input.puppyMonitorCount),
  };
}

export function isClassFullyStaffed(input: { operationsManager: boolean; yogaInstructor: boolean; puppyMonitorCount: number }) {
  const gaps = staffingGaps(input);
  return !gaps.operationsManager && !gaps.yogaInstructor && gaps.puppyMonitors === 0;
}
