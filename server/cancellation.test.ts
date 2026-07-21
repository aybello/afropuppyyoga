/**
 * Cancellation Router — Twilio Credentials Test
 *
 * Validates that the Twilio environment variables are set and that the
 * Twilio client can be instantiated without throwing.
 */
import { describe, it, expect } from "vitest";

describe("Twilio credentials", () => {
  it("should have TWILIO_ACCOUNT_SID set", () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    expect(sid, "TWILIO_ACCOUNT_SID must be set").toBeTruthy();
    expect(sid!.startsWith("AC"), "TWILIO_ACCOUNT_SID should start with 'AC'").toBe(true);
  });

  it("should have TWILIO_AUTH_TOKEN set", () => {
    const token = process.env.TWILIO_AUTH_TOKEN;
    expect(token, "TWILIO_AUTH_TOKEN must be set").toBeTruthy();
    expect(token!.length, "TWILIO_AUTH_TOKEN should be at least 20 chars").toBeGreaterThanOrEqual(20);
  });

  it("should have TWILIO_PHONE_NUMBER set in E.164 format", () => {
    const phone = process.env.TWILIO_PHONE_NUMBER;
    expect(phone, "TWILIO_PHONE_NUMBER must be set").toBeTruthy();
    expect(phone!.startsWith("+"), "TWILIO_PHONE_NUMBER should start with '+'").toBe(true);
  });

  it("should be able to instantiate a Twilio client", async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      console.warn("Twilio credentials not set — skipping client instantiation test");
      return;
    }
    const { default: twilio } = await import("twilio");
    const client = twilio(sid, token);
    expect(client).toBeTruthy();
    // client.calls and client.messages are function/objects in Twilio SDK — just check they exist
    expect(client.calls).toBeTruthy();
    expect(client.messages).toBeTruthy();
  });

  it("should have callLogs schema with smsSid and smsStatus columns", async () => {
    const { callLogs } = await import("../drizzle/schema");
    const columns = Object.keys(callLogs);
    expect(columns).toContain("smsSid");
    expect(columns).toContain("smsStatus");
  });
});
