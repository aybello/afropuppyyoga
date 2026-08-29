import { describe, expect, it } from "vitest";
import { individualScheduleDeliveryFeedback } from "../shared/individualNotification";

describe("individual schedule message feedback", () => {
  it("uses a success message only for a successful delivery", () => {
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "sent", name: "Maya", errors: [] })).toEqual({ kind: "success", message: "Schedule sent to Maya" });
  });

  it("uses warning or error feedback for suppressed, unavailable, and failed delivery", () => {
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "sms_suppressed", name: "Maya", errors: [] }).kind).toBe("warning");
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "not_configured", name: "Maya", errors: [] })).toMatchObject({ kind: "error" });
    expect(individualScheduleDeliveryFeedback({ deliveryStatus: "failed", name: "Maya", errors: ["Email: timeout"] }).message).toContain("Email: timeout");
  });
});
