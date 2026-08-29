import { describe, expect, it } from "vitest";
import { individualScheduleDeliveryFeedback } from "./individualNotification";

describe("individual schedule delivery feedback", () => {
  it("shows success only when a delivery channel sent the schedule", () => {
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "sent", name: "Maya", errors: [] })).toEqual({ kind: "success", message: "Schedule sent to Maya" });
  });

  it("shows warning or error feedback for suppressed, unavailable, and failed delivery", () => {
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "sms_suppressed", name: "Maya", errors: [] }).kind).toBe("warning");
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "not_configured", name: "Maya", errors: [] }).message).toContain("not delivered");
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "failed", name: "Maya", errors: ["Email: timeout"] }).message).toContain("Email: timeout");
  });
});
