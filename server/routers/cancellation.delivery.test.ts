import { describe, expect, it } from "vitest";
import { createCancellationCode, isInFlightTwilioStatus } from "./cancellation";

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
  it("generates unique, Luma-safe codes", () => {
    const codes = new Set(Array.from({ length: 50 }, () => createCancellationCode()));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(code).toMatch(/^APY-[A-F0-9]{14}$/);
  });
});
