import { afterEach, describe, expect, it } from "vitest";
import { buildInboundSmsOwnerForward, getTwilioWebhookBaseUrl, getTwilioWebhookUrl } from "./twilioWebhook";

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

describe("inbound SMS owner forwarding", () => {
  it("always includes a matched breeder's number in the forwarded text", () => {
    expect(buildInboundSmsOwnerForward("+14165551234", "What time is drop-off?", "Indigo Bay Kennels")).toBe(
      "📩 Reply from Indigo Bay Kennels (+14165551234):\n\"What time is drop-off?\""
    );
  });

  it("uses the sender number when no breeder record matches", () => {
    expect(buildInboundSmsOwnerForward("+14165551234", "Please call me.", null)).toBe(
      "📩 Reply from +14165551234:\n\"Please call me.\""
    );
  });
});
