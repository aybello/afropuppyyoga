import { describe, expect, it } from "vitest";
import { publicCalendarTestUtils } from "./publicCalendar";

describe("public calendar admission pricing", () => {
  it("uses the lowest visible paid CAD admission ticket and excludes optional mat rentals", () => {
    expect(publicCalendarTestUtils.lowestAdmissionCents([
      { name: "Mat Rental 🧘‍♀️", cents: 250, currency: "cad", type: "paid", is_hidden: false },
      { name: "Early Bird 🐣❤️", cents: 4900, currency: "cad", type: "paid", is_hidden: false },
      { name: "Regular", cents: 5500, currency: "cad", type: "paid", is_hidden: false },
    ])).toBe(4900);
  });

  it("does not treat hidden, free, foreign-currency, or non-admission tickets as public admission", () => {
    expect(publicCalendarTestUtils.lowestAdmissionCents([
      { name: "Mat Rental 🧘‍♀️", cents: 250, currency: "cad", type: "paid", is_hidden: false },
      { name: "Hidden Early Bird", cents: 1, currency: "cad", type: "paid", is_hidden: true },
      { name: "Complimentary", cents: 0, currency: "cad", type: "free", is_hidden: false },
      { name: "USD Admission", cents: 1, currency: "usd", type: "paid", is_hidden: false },
    ])).toBeNull();
  });

  it("normalizes Luma ticket casing and rejects zero-value paid placeholders", () => {
    expect(publicCalendarTestUtils.lowestAdmissionCents([
      { name: "Early Bird", cents: 4900, currency: "CAD", type: "PAID", is_hidden: false },
      { name: "Paid placeholder", cents: 0, currency: "cad", type: "paid", is_hidden: false },
    ])).toBe(4900);
  });

  it("omits a class once its Toronto-local end time has passed", () => {
    const beforeEnd = new Date("2026-10-03T17:29:00.000Z"); // 1:29 PM EDT
    const afterEnd = new Date("2026-10-03T17:30:00.000Z"); // 1:30 PM EDT
    expect(publicCalendarTestUtils.isStillUpcomingClass("2026-10-03", "13:30", beforeEnd)).toBe(true);
    expect(publicCalendarTestUtils.isStillUpcomingClass("2026-10-03", "13:30", afterEnd)).toBe(false);
    expect(publicCalendarTestUtils.isStillUpcomingClass("2026-10-04", "10:00", afterEnd)).toBe(true);
  });
});
