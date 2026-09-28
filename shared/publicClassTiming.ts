import { getTorontoCalendarDate } from "./scheduleVisibility";

export function getTorontoClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

/** True until the exact local Toronto minute when the class ends. */
export function isStillUpcomingPublicClass(classDate: string, endTime: string, now = new Date()) {
  const today = getTorontoCalendarDate(now);
  const normalizedEndTime = endTime.slice(0, 5);
  return classDate > today || (classDate === today && normalizedEndTime > getTorontoClock(now));
}
