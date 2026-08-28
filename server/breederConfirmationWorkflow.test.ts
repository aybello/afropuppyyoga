import { describe, expect, it } from "vitest";
import {
  breederConfirmationRequestKey,
  normalizeBreederPhone,
  parseBreederEventTime,
  planBreederConfirmationEvents,
  type BreederConfirmationEvent,
} from "./breederConfirmationWorkflow";

const studioEvent: BreederConfirmationEvent = {
  city: "Kitchener",
  date: "2026-11-14",
  location: "TenC Dance Studio, Kitchener",
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
    expect(plans[0].schedule).toMatchObject({ location: "Kitchener", classType: "regular", startTime: "09:00", endTime: "15:00" });
    expect(plans[1].schedule).toBeNull();
  });

  it("rejects invalid and internally overlapping commitments before any send", () => {
    expect(() => planBreederConfirmationEvents([{ ...studioEvent, pickUpTime: "8:30 AM" }])).toThrow("after its start");
    expect(() => planBreederConfirmationEvents([
      studioEvent,
      { ...studioEvent, dropOffTime: "2:00 PM", pickUpTime: "4:00 PM" },
    ])).toThrow("overlap at the same venue");
  });

  it("creates a stable idempotency key and changes it with the booking details", () => {
    const first = breederConfirmationRequestKey({ breederId: 4, events: [studioEvent] });
    const same = breederConfirmationRequestKey({ breederId: 4, events: [studioEvent] });
    const changed = breederConfirmationRequestKey({ breederId: 4, events: [{ ...studioEvent, compensation: "$550" }] });
    expect(first).toBe(same);
    expect(changed).not.toBe(first);
  });
});
