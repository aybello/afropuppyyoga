export const SCHEDULE_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type ScheduleDay = typeof SCHEDULE_DAYS[number];
export type ScheduleCandidate = {
  classDate: string;
  dayOfWeek: ScheduleDay;
  location: string;
  startTime: string;
  endTime: string;
  classType: "regular" | "private";
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function minutesFromMidnight(value: string) {
  if (!TIME_PATTERN.test(value)) throw new Error("Class times must use HH:MM in 24-hour time.");
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function dayOfWeekForDate(value: string): ScheduleDay {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Class date must use YYYY-MM-DD.");
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Choose a valid class date.");
  return SCHEDULE_DAYS[date.getUTCDay()];
}

export function validateScheduleCandidate(candidate: ScheduleCandidate) {
  const actualDay = dayOfWeekForDate(candidate.classDate);
  if (candidate.dayOfWeek !== actualDay) throw new Error(`${candidate.classDate} is a ${actualDay}, not a ${candidate.dayOfWeek}.`);
  if (candidate.classType === "regular" && actualDay !== "Saturday" && actualDay !== "Sunday") {
    throw new Error("Regular APY classes must be scheduled on Saturday or Sunday. Use Private Event for a weekday booking.");
  }
  const start = minutesFromMidnight(candidate.startTime);
  const end = minutesFromMidnight(candidate.endTime);
  if (end <= start) throw new Error("Class end time must be after its start time.");
}

export function schedulesOverlap(
  first: Pick<ScheduleCandidate, "classDate" | "location" | "startTime" | "endTime">,
  second: Pick<ScheduleCandidate, "classDate" | "location" | "startTime" | "endTime">,
) {
  if (first.classDate !== second.classDate || first.location !== second.location) return false;
  return minutesFromMidnight(first.startTime) < minutesFromMidnight(second.endTime)
    && minutesFromMidnight(second.startTime) < minutesFromMidnight(first.endTime);
}
