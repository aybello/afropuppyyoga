export type WeekendDate = {
  date: string;
  dayLabel: "Saturday" | "Sunday";
  shortLabel: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Returns upcoming Saturday/Sunday pairs, using calendar dates in Toronto-facing ISO form. */
export function getUpcomingWeekendDates(reference = new Date(), weekends = 6): WeekendDate[] {
  const cursor = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 12));
  const daysUntilSaturday = (6 - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + daysUntilSaturday);
  const formatter = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
  const result: WeekendDate[] = [];

  for (let index = 0; index < weekends; index += 1) {
    const saturday = new Date(cursor);
    saturday.setUTCDate(cursor.getUTCDate() + index * 7);
    const sunday = new Date(saturday);
    sunday.setUTCDate(saturday.getUTCDate() + 1);
    result.push({ date: isoDate(saturday), dayLabel: "Saturday", shortLabel: formatter.format(saturday) });
    result.push({ date: isoDate(sunday), dayLabel: "Sunday", shortLabel: formatter.format(sunday) });
  }
  return result;
}

export function isWeekendDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const day = date.getUTCDay();
  return !Number.isNaN(date.getTime()) && (day === 0 || day === 6);
}

export function isAwayOnDate(leave: { startDate: string; endDate: string } | undefined, date: string) {
  return Boolean(leave && leave.startDate <= date && leave.endDate >= date);
}
