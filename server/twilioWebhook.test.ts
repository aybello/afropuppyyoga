import { afterEach, describe, expect, it } from "vitest";
import { getTwilioWebhookBaseUrl, getTwilioWebhookUrl } from "./twilioWebhook";

const originalWebhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;

afterEach(() => {
  if (originalWebhookBaseUrl === undefined) {
    delete process.env.TWILIO_WEBHOOK_BASE_URL;
  } else {
    process.env.TWILIO_WEBHOOK_BASE_URL = originalWebhookBaseUrl;
  }
});

describe("Twilio cancellation webhook URLs", () => {
  it("uses the canonical production domain by default", () => {
    delete process.env.TWILIO_WEBHOOK_BASE_URL;
    expect(getTwilioWebhookBaseUrl()).toBe("https://afropuppyyoga.ca");
    expect(getTwilioWebhookUrl("/api/twilio/call-status")).toBe("https://afropuppyyoga.ca/api/twilio/call-status");
  });

  it("normalizes an explicitly configured callback base URL", () => {
    process.env.TWILIO_WEBHOOK_BASE_URL = "https://callbacks.example.test///";
    expect(getTwilioWebhookUrl("api/twilio/sms-status")).toBe("https://callbacks.example.test/api/twilio/sms-status");
  });
});
