import { describe, expect, it } from "vitest";
import { getEventNotificationRecipient, prepareIndividualEventNotification, resolveIndividualNotificationDelivery, type EventNotificationRecipient } from "./puppySchedule";

const recipients: EventNotificationRecipient[] = [
  { id: 1, name: "Opal Operations", email: "opal@example.com", phone: "+15555550100", role: "Operations Manager", lastSentAt: null },
];

describe("notifyIndividualEventStaff route safeguards", () => {
  it("accepts only an assigned current class recipient", () => {
    expect(getEventNotificationRecipient(recipients, 1).name).toBe("Opal Operations");
    expect(() => getEventNotificationRecipient(recipients, 2)).toThrow("not currently assigned");
  });

  it("requires explicit resend after a prior delivery", () => {
    const notified = [{ ...recipients[0], lastSentAt: new Date("2026-08-29T10:00:00Z") }];
    expect(() => prepareIndividualEventNotification(notified, { staffId: 1, resend: false })).toThrow("Choose Resend");
    expect(prepareIndividualEventNotification(notified, { staffId: 1, resend: true }).id).toBe(1);
  });

  it("returns precise delivery state for success, suppression, unavailable channels, and failures", () => {
    expect(resolveIndividualNotificationDelivery({ emailStatus: "sent", smsStatus: "suppressed" })).toBe("sent");
    expect(resolveIndividualNotificationDelivery({ emailStatus: "missing", smsStatus: "suppressed" })).toBe("sms_suppressed");
    expect(resolveIndividualNotificationDelivery({ emailStatus: "missing", smsStatus: "not_configured" })).toBe("not_configured");
    expect(resolveIndividualNotificationDelivery({ emailStatus: "failed", smsStatus: "failed" })).toBe("failed");
  });
});
