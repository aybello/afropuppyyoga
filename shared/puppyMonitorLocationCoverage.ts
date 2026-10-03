/** Advisory roster goal, never a hiring, editing or access prerequisite. */
export const PUPPY_MONITOR_LOCATION_TARGET = 6;

export function getPuppyMonitorLocationCoverage(activeCount: number) {
  const shortfall = Math.max(0, PUPPY_MONITOR_LOCATION_TARGET - activeCount);
  return { activeCount, target: PUPPY_MONITOR_LOCATION_TARGET, shortfall, meetsTarget: shortfall === 0 };
}
