import twilio from "twilio";
import { describe, expect, it } from "vitest";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const sender = process.env.TWILIO_PHONE_NUMBER;

describe("Twilio staff-code configuration", () => {
  it("authenticates the configured account and has an SMS sender number", async () => {
    expect(accountSid, "TWILIO_ACCOUNT_SID must be configured").toBeTruthy();
    expect(authToken, "TWILIO_AUTH_TOKEN must be configured").toBeTruthy();
    expect(sender, "TWILIO_PHONE_NUMBER must be configured").toMatch(/^\+[1-9]\d{7,14}$/);

    const client = twilio(accountSid!, authToken!);
    const account = await client.api.accounts(accountSid!).fetch();

    expect(account.sid).toBe(accountSid);
    expect(account.status).toBeTruthy();
  }, 20_000);
});
