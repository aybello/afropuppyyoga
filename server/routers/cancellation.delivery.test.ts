import { describe, expect, it } from "vitest";
import { isInFlightTwilioStatus } from "./cancellation";

describe("cancellation delivery reconciliation", () => {
  it("reconciles only active Twilio delivery statuses", () => {
    expect(isInFlightTwilioStatus("queued")).toBe(true);
    expect(isInFlightTwilioStatus("sending")).toBe(true);
    expect(isInFlightTwilioStatus("in-progress")).toBe(true);
    expect(isInFlightTwilioStatus("delivered")).toBe(false);
    expect(isInFlightTwilioStatus("completed")).toBe(false);
    expect(isInFlightTwilioStatus("failed")).toBe(false);
    expect(isInFlightTwilioStatus(null)).toBe(false);
  });
});
