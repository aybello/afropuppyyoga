export type ScheduleDateEntry = { classDate: string };

export function filterUpcomingScheduleEntries<T extends ScheduleDateEntry>(entries: readonly T[], today: string): T[] {
  return entries.filter((entry) => entry.classDate >= today);
}

export function getScheduleVisibilityStartDate(requestedStartDate: string, today: string): string {
  return requestedStartDate >= today ? requestedStartDate : today;
}

export function getTorontoCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
