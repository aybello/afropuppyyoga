import { describe, expect, it } from "vitest";
import { isClassFullyStaffed, scheduleLocationToTeamLocation, staffingGaps } from "./classStaffing";
import { getEventNotificationRecipient, prepareIndividualEventNotification, type EventNotificationRecipient } from "./routers/puppySchedule";

describe("class staffing requirements", () => {
  it("maps breeder calendar studio names to the staff team locations", () => {
    expect(scheduleLocationToTeamLocation("Kitchener")).toBe("KW");
    expect(scheduleLocationToTeamLocation("Hamilton")).toBe("HAM");
    expect(scheduleLocationToTeamLocation("Oakville")).toBe("OAK");
  });

  it("requires exactly two Puppy Monitors alongside leadership coverage", () => {
    expect(staffingGaps({ operationsManager: true, yogaInstructor: true, puppyMonitorCount: 0 })).toEqual({ operationsManager: false, yogaInstructor: false, puppyMonitors: 2 });
    expect(isClassFullyStaffed({ operationsManager: true, yogaInstructor: true, puppyMonitorCount: 1 })).toBe(false);
    expect(isClassFullyStaffed({ operationsManager: true, yogaInstructor: true, puppyMonitorCount: 2 })).toBe(true);
  });

  it("limits individual schedule messages to a current class recipient with a contact channel", () => {
    const recipients: EventNotificationRecipient[] = [
      { id: 10, name: "Maya Monitor", email: "maya@example.com", phone: null, role: "Puppy Monitor", lastSentAt: null },
    ];
    expect(getEventNotificationRecipient(recipients, 10).name).toBe("Maya Monitor");
    expect(() => getEventNotificationRecipient(recipients, 99)).toThrow("not currently assigned");
    expect(() => getEventNotificationRecipient([{ ...recipients[0], email: null }], 10)).toThrow("email address or phone number");
  });

  it("requires an explicit resend for a recipient with a recorded delivery", () => {
    const recipients: EventNotificationRecipient[] = [
      { id: 10, name: "Maya Monitor", email: "maya@example.com", phone: null, role: "Puppy Monitor", lastSentAt: new Date("2026-08-29T10:00:00Z") },
    ];
    expect(() => prepareIndividualEventNotification(recipients, { staffId: 10, resend: false })).toThrow("Choose Resend");
    expect(prepareIndividualEventNotification(recipients, { staffId: 10, resend: true }).id).toBe(10);
    expect(() => prepareIndividualEventNotification(recipients, { staffId: 99, resend: false })).toThrow("not currently assigned");
  });
});
