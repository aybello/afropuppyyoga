import { describe, expect, it } from "vitest";
import { filterUpcomingScheduleEntries, getScheduleVisibilityStartDate } from "../shared/scheduleVisibility";

describe("active Puppy Class Schedule visibility", () => {
  it("shows today and future classes while keeping past scheduled records out of the active view", () => {
    const schedule = [
      { id: 1, classDate: "2026-09-09", scheduleStatus: "scheduled" },
      { id: 2, classDate: "2026-09-10", scheduleStatus: "scheduled" },
      { id: 3, classDate: "2026-09-12", scheduleStatus: "scheduled" },
    ];

    expect(filterUpcomingScheduleEntries(schedule, "2026-09-10").map((entry) => entry.id)).toEqual([2, 3]);
  });

  it("does not delete or reinterpret historical records when it filters the active schedule view", () => {
    const schedule = [
      { id: 1, classDate: "2026-09-09", scheduleStatus: "completed" },
      { id: 2, classDate: "2026-09-11", scheduleStatus: "scheduled" },
    ];

    const visible = filterUpcomingScheduleEntries(schedule, "2026-09-10");
    expect(visible).toEqual([{ id: 2, classDate: "2026-09-11", scheduleStatus: "scheduled" }]);
    expect(schedule).toHaveLength(2);
    expect(schedule[0].scheduleStatus).toBe("completed");
  });

  it("never allows a prior calendar-month query to reopen past classes in the active schedule", () => {
    expect(getScheduleVisibilityStartDate("2026-09-01", "2026-09-10")).toBe("2026-09-10");
    expect(getScheduleVisibilityStartDate("2026-10-01", "2026-09-10")).toBe("2026-10-01");
  });
});
