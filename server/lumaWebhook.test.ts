import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyLumaWebhookSignature } from "./lumaWebhook";

function signature(secret: string, timestamp: number, rawBody: string): string {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("verifyLumaWebhookSignature", () => {
  const secret = "whsec_test";
  const timestamp = 1_800_000_000;
  const rawBody = JSON.stringify({ type: "guest.registered", data: { id: "gst-1" } });

  it("accepts Luma's timestamped signature format", () => {
    expect(verifyLumaWebhookSignature({
      secret,
      signatureHeader: signature(secret, timestamp, rawBody),
      rawBody,
      nowSeconds: timestamp,
    })).toBe(true);
  });

  it("rejects a modified body", () => {
    expect(verifyLumaWebhookSignature({
      secret,
      signatureHeader: signature(secret, timestamp, rawBody),
      rawBody: `${rawBody} `,
      nowSeconds: timestamp,
    })).toBe(false);
  });

  it("rejects stale replayed deliveries", () => {
    expect(verifyLumaWebhookSignature({
      secret,
      signatureHeader: signature(secret, timestamp, rawBody),
      rawBody,
      nowSeconds: timestamp + 301,
    })).toBe(false);
  });

  it("rejects missing and malformed signatures without throwing", () => {
    expect(verifyLumaWebhookSignature({ secret, rawBody, nowSeconds: timestamp })).toBe(false);
    expect(verifyLumaWebhookSignature({
      secret,
      signatureHeader: "not-a-signature",
      rawBody,
      nowSeconds: timestamp,
    })).toBe(false);
  });
});
