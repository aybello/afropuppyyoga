import { describe, expect, it } from "vitest";
import { getUpcomingWeekendDates, isAwayOnDate, isWeekendDate } from "./weekendCoverage";

describe("weekend leadership coverage dates", () => {
  it("returns paired Saturdays and Sundays from the next weekend", () => {
    const weekends = getUpcomingWeekendDates(new Date("2026-08-13T12:00:00Z"), 2);
    expect(weekends.map((weekend) => weekend.date)).toEqual(["2026-08-15", "2026-08-16", "2026-08-22", "2026-08-23"]);
  });

  it("only accepts Saturday and Sunday dates", () => {
    expect(isWeekendDate("2026-08-15")).toBe(true);
    expect(isWeekendDate("2026-08-16")).toBe(true);
    expect(isWeekendDate("2026-08-17")).toBe(false);
  });

  it("recognizes leave that covers a weekend date", () => {
    expect(isAwayOnDate({ startDate: "2026-08-15", endDate: "2026-08-17" }, "2026-08-16")).toBe(true);
    expect(isAwayOnDate({ startDate: "2026-08-20", endDate: "2026-08-22" }, "2026-08-16")).toBe(false);
  });
});
