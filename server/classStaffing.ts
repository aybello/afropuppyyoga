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

export type LeadershipRole = "Operations Manager" | "Yoga Instructor";

export function getLeadershipAssignmentEligibility(input: {
  role: LeadershipRole;
  staffRole: string;
  staffLocation: string;
  scheduleLocation: "Kitchener" | "Hamilton" | "Oakville";
  isAway: boolean;
  isActive?: boolean;
}) {
  const normalizedRole = input.role.toLowerCase().replaceAll(" ", "_");
  if (input.isActive === false) {
    return { eligible: false as const, reason: "Choose an active APY HQ team member for this class." };
  }
  if (input.staffRole !== input.role && input.staffRole !== normalizedRole) {
    return { eligible: false as const, reason: `Choose an active ${input.role} for this class.` };
  }
  if (input.staffLocation !== scheduleLocationToTeamLocation(input.scheduleLocation)) {
    return { eligible: false as const, reason: `Choose an ${input.role} assigned to this studio.` };
  }
  if (input.isAway) {
    return { eligible: false as const, reason: `This ${input.role} is unavailable on this class date.` };
  }
  return { eligible: true as const };
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
