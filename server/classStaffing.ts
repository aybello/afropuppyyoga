export const TWO_PUPPY_MONITORS_REQUIRED = 2;

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
