export const PUPPY_MONITOR_LOCATION_MINIMUM = 6;

export function getPuppyMonitorLocationCoverage(activeCount: number) {
  const shortfall = Math.max(0, PUPPY_MONITOR_LOCATION_MINIMUM - activeCount);
  return {
    activeCount,
    minimum: PUPPY_MONITOR_LOCATION_MINIMUM,
    shortfall,
    meetsMinimum: shortfall === 0,
  };
}
