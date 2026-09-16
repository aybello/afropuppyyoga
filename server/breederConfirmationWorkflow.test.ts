import { describe, expect, it } from "vitest";
import {
  breederConfirmationRequestKey,
  normalizeBreederPhone,
  parseBreederEventTime,
  planBreederConfirmationEvents,
  prepareExistingCalendarConfirmation,
  type BreederConfirmationEvent,
} from "./breederConfirmationWorkflow";
import { generateConfirmationEmail } from "./routers/breeders";

const studioEvent: BreederConfirmationEvent = {
  city: "Kitchener",
  date: "2026-11-14",
  location: "TenC Dance Studio, Kitchener",
  classSlot: "10:00",
  apyTransport: false,
  dropOffTime: "9:00 AM",
  pickUpTime: "3:00 PM",
  compensation: "$500",
};

describe("breeder confirmation workflow", () => {
  it("strictly parses confirmation times and phone numbers", () => {
    expect(parseBreederEventTime("12:30 AM", "Pickup time")).toBe("00:30");
    expect(parseBreederEventTime("3:00 PM", "Return time")).toBe("15:00");
    expect(() => parseBreederEventTime(undefined, "Pickup time")).toThrow("required");
    expect(normalizeBreederPhone("(289) 788-1885")).toBe("+12897881885");
    expect(() => normalizeBreederPhone("1234")).toThrow("saved phone number is invalid");
  });

  it("plans studio classes and validates custom private venue commitments", () => {
    const privateEvent = {
      ...studioEvent,
      city: "",
      date: "2026-11-16",
      location: "25 King Street, Toronto",
      isPrivateEvent: true,
    };
    const plans = planBreederConfirmationEvents([studioEvent, privateEvent]);
    expect(plans[0].schedule).toMatchObject({ location: "Kitchener", classType: "regular", startTime: "10:00", endTime: "11:00" });
    expect(plans[1].schedule).toBeNull();
  });

  it("rejects invalid and internally overlapping commitments before any send", () => {
    expect(() => planBreederConfirmationEvents([{ ...studioEvent, pickUpTime: "8:30 AM" }])).toThrow("window must end after it starts");
    expect(() => planBreederConfirmationEvents([
      studioEvent,
      { ...studioEvent, dropOffTime: "2:00 PM", pickUpTime: "4:00 PM" },
    ])).toThrow("overlap at the same venue");
  });

  it("requires a supported public APY class slot instead of deriving the class window from breeder logistics", () => {
    expect(() => planBreederConfirmationEvents([{ ...studioEvent, classSlot: undefined }])).toThrow("choose the APY public class slot");
    const plan = planBreederConfirmationEvents([{ ...studioEvent, dropOffTime: "8:00 AM", pickUpTime: "3:00 PM", classSlot: "13:30" }]);
    expect(plan[0].schedule).toMatchObject({ startTime: "13:30", endTime: "14:30" });
  });

  it("uses APY's approved Warmly sign-off in both confirmation formats", () => {
    const confirmation = generateConfirmationEmail({ breederFirstName: "Nicole", events: [studioEvent] });
    expect(confirmation.html).toContain("Warmly,");
    expect(confirmation.text).toContain("Warmly,\nThe AfroPuppyYoga Team");
    expect(confirmation.text).not.toContain("\nBest,\n");
  });

  it("creates a stable idempotency key and changes it with the booking details", () => {
    const first = breederConfirmationRequestKey({ breederId: 4, events: [studioEvent] });
    const same = breederConfirmationRequestKey({ breederId: 4, events: [studioEvent] });
    const changed = breederConfirmationRequestKey({ breederId: 4, events: [{ ...studioEvent, compensation: "$550" }] });
    expect(first).toBe(same);
    expect(changed).not.toBe(first);
  });

  it("anchors a calendar-originated confirmation to its saved class and blocks an unsafe selection", () => {
    const [prepared] = prepareExistingCalendarConfirmation({
      schedule: { id: 88, breederId: 4, classDate: "2026-11-15", location: "Oakville", classType: "regular", scheduleStatus: "scheduled" },
      breederId: 4,
      events: [{ ...studioEvent, city: "Hamilton", date: "2026-11-14" }],
    });
    expect(prepared).toMatchObject({ city: "Oakville", date: "2026-11-15", isPrivateEvent: false });

    expect(() => prepareExistingCalendarConfirmation({
      schedule: { id: 88, breederId: 4, classDate: "2026-11-15", location: "Oakville", classType: "regular", scheduleStatus: "cancelled" },
      breederId: 4,
      events: [studioEvent],
    })).toThrow("active scheduled class");
    expect(() => prepareExistingCalendarConfirmation({
      schedule: { id: 88, breederId: 4, classDate: "2026-11-15", location: "Oakville", classType: "regular", scheduleStatus: "scheduled" },
      breederId: 5,
      events: [studioEvent],
    })).toThrow("different breeder");
  });

  it("keeps a calendar confirmation idempotency key distinct from a new booking confirmation", () => {
    const standard = breederConfirmationRequestKey({ breederId: 4, events: [studioEvent] });
    const fromCalendar = breederConfirmationRequestKey({ breederId: 4, events: [studioEvent], sourceScheduleId: 88 });
    expect(fromCalendar).not.toBe(standard);
  });
});
