import { describe, expect, it } from "vitest";
import { createCancellationCode, isCancellationCommunicationEnabled, isInFlightTwilioStatus } from "./cancellation";

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

describe("cancellation credit codes", () => {
  it("uses the Ontario class date in the owner-required Luma-safe code format", () => {
    expect(createCancellationCode("2026-08-05T18:00:00.000Z")).toBe("AUG5");
  });

  it("uses the preview-key gate rather than the retired global communications pause", () => {
    expect(isCancellationCommunicationEnabled()).toBe(true);
  });
});
