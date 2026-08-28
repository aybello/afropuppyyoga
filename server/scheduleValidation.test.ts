import { describe, expect, it } from "vitest";
import { dayOfWeekForDate, schedulesOverlap, validateScheduleCandidate } from "./scheduleValidation";

describe("schedule validation", () => {
  it("derives the calendar day without depending on the server timezone", () => {
    expect(dayOfWeekForDate("2026-11-14")).toBe("Saturday");
    expect(dayOfWeekForDate("2026-11-15")).toBe("Sunday");
  });

  it("rejects impossible dates, mismatched weekdays, weekday regular classes and reversed times", () => {
    expect(() => dayOfWeekForDate("2026-02-31")).toThrow("valid class date");
    expect(() => validateScheduleCandidate({ classDate: "2026-11-14", dayOfWeek: "Sunday", location: "Kitchener", startTime: "09:00", endTime: "15:00", classType: "regular" })).toThrow("is a Saturday");
    expect(() => validateScheduleCandidate({ classDate: "2026-11-16", dayOfWeek: "Monday", location: "Kitchener", startTime: "09:00", endTime: "15:00", classType: "regular" })).toThrow("Saturday or Sunday");
    expect(() => validateScheduleCandidate({ classDate: "2026-11-16", dayOfWeek: "Monday", location: "Kitchener", startTime: "15:00", endTime: "09:00", classType: "private" })).toThrow("after its start");
  });

  it("detects only genuine same-studio time collisions", () => {
    const base = { classDate: "2026-11-14", location: "Kitchener", startTime: "09:00", endTime: "15:00" };
    expect(schedulesOverlap(base, { ...base, startTime: "14:30", endTime: "16:00" })).toBe(true);
    expect(schedulesOverlap(base, { ...base, startTime: "15:00", endTime: "16:00" })).toBe(false);
    expect(schedulesOverlap(base, { ...base, location: "Hamilton", startTime: "10:00", endTime: "12:00" })).toBe(false);
  });
});
