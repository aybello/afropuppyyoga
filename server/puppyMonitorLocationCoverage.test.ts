import { describe, expect, it } from "vitest";
import { getPuppyMonitorLocationCoverage, PUPPY_MONITOR_LOCATION_MINIMUM } from "../shared/puppyMonitorLocationCoverage";

describe("Puppy Monitor location coverage", () => {
  it("treats six active Puppy Monitors as a minimum rather than a maximum", () => {
    expect(PUPPY_MONITOR_LOCATION_MINIMUM).toBe(6);
    expect(getPuppyMonitorLocationCoverage(5)).toEqual({
      activeCount: 5,
      minimum: 6,
      shortfall: 1,
      meetsMinimum: false,
    });
    expect(getPuppyMonitorLocationCoverage(6)).toEqual({
      activeCount: 6,
      minimum: 6,
      shortfall: 0,
      meetsMinimum: true,
    });
    expect(getPuppyMonitorLocationCoverage(7)).toEqual({
      activeCount: 7,
      minimum: 6,
      shortfall: 0,
      meetsMinimum: true,
    });
  });
});
