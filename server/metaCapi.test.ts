/**
 * Meta CAPI Unit Tests
 *
 * Tests:
 *  1. hashUserData — correct SHA-256 output for known inputs
 *  2. hashUserData — normalisation (trim, lowercase, E.164 phone)
 *  3. hashUserData — null/empty inputs return null (no-hash fields)
 *  4. hashUserData — phone normalisation strips country code
 *  5. hashUserData — phone too short returns null
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  buildMetaPurchasePayload,
  extractMetaBrowserIds,
  hashUserData,
  resolveMetaCapiRuntimeConfig,
} from "./metaCapi";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("hashUserData", () => {
  it("hashes a lowercase email correctly", () => {
    const result = hashUserData({ email: "test@example.com" });
    expect(result.hashedEmail).toBe(sha256("test@example.com"));
  });

  it("normalises email to lowercase before hashing", () => {
    const result = hashUserData({ email: "  Test@Example.COM  " });
    expect(result.hashedEmail).toBe(sha256("test@example.com"));
  });

  it("hashes first and last name after lowercasing", () => {
    const result = hashUserData({ firstName: "Jane", lastName: "DOE" });
    expect(result.hashedFirstName).toBe(sha256("jane"));
    expect(result.hashedLastName).toBe(sha256("doe"));
  });

  // Meta's matching spec hashes phones WITH the country code.
  // "4165551234" and "14165551234" produce different digests; only the
  // latter matches Meta's stored hashes for North American users.
  it("adds country code 1 to a bare 10-digit NANP number", () => {
    const result = hashUserData({ phone: "416-555-1234" });
    expect(result.hashedPhone).toBe(sha256("14165551234"));
  });

  it("keeps the country code on 11-digit North American numbers", () => {
    const result = hashUserData({ phone: "+1 416 555 1234" });
    expect(result.hashedPhone).toBe(sha256("14165551234"));
  });

  it("hashes 10-digit and +1-prefixed forms of the same number identically", () => {
    const bare = hashUserData({ phone: "4165551234" });
    const prefixed = hashUserData({ phone: "+1 (416) 555-1234" });
    expect(bare.hashedPhone).toBe(prefixed.hashedPhone);
  });

  it("returns null for phone numbers shorter than 7 digits", () => {
    const result = hashUserData({ phone: "12345" });
    expect(result.hashedPhone).toBeNull();
  });

  it("returns null for null email (no-hash field)", () => {
    const result = hashUserData({ email: null });
    expect(result.hashedEmail).toBeNull();
  });

  it("returns null for undefined email (no-hash field)", () => {
    const result = hashUserData({ email: undefined });
    expect(result.hashedEmail).toBeNull();
  });

  it("returns null for empty string email (no-hash field)", () => {
    const result = hashUserData({ email: "   " });
    expect(result.hashedEmail).toBeNull();
  });

  it("returns null for null phone (no-hash field)", () => {
    const result = hashUserData({ phone: null });
    expect(result.hashedPhone).toBeNull();
  });

  it("hashes all four fields when all are provided", () => {
    const result = hashUserData({
      email: "customer@example.com",
      phone: "4165551234",
      firstName: "Sample",
      lastName: "Customer",
    });
    expect(result.hashedEmail).toBe(sha256("customer@example.com"));
    expect(result.hashedPhone).toBe(sha256("14165551234"));
    expect(result.hashedFirstName).toBe(sha256("sample"));
    expect(result.hashedLastName).toBe(sha256("customer"));
  });

  it("produces consistent output for the same input (deterministic)", () => {
    const a = hashUserData({ email: "hello@test.com" });
    const b = hashUserData({ email: "hello@test.com" });
    expect(a.hashedEmail).toBe(b.hashedEmail);
  });

  it("produces different output for different emails", () => {
    const a = hashUserData({ email: "a@test.com" });
    const b = hashUserData({ email: "b@test.com" });
    expect(a.hashedEmail).not.toBe(b.hashedEmail);
  });
});

describe("resolveMetaCapiRuntimeConfig", () => {
  it("sends real events by default even when the retired enable flag is false", () => {
    expect(resolveMetaCapiRuntimeConfig({
      META_CAPI_ENABLED: "false",
      META_TEST_EVENT_CODE: "TEST123",
    })).toEqual({
      paused: false,
      testMode: false,
      testEventCode: undefined,
      graphApiVersion: "v25.0",
    });
  });

  it("supports an explicit production pause", () => {
    expect(resolveMetaCapiRuntimeConfig({ META_CAPI_PAUSED: "true" }).paused).toBe(true);
  });

  it("uses a test event code only when test mode is explicitly enabled", () => {
    const config = resolveMetaCapiRuntimeConfig({
      META_CAPI_TEST_MODE: "true",
      META_TEST_EVENT_CODE: "TEST123",
      META_GRAPH_API_VERSION: "v24.0",
    });
    expect(config.testMode).toBe(true);
    expect(config.testEventCode).toBe("TEST123");
    expect(config.graphApiVersion).toBe("v24.0");
  });
});

describe("buildMetaPurchasePayload", () => {
  const row = {
    lumaGuestId: "gst-123",
    lumaEventId: "evt-456",
    lumaEventName: "Puppy Yoga — Kitchener",
    amountCents: 11865,
    currency: "cad",
    lumaRegisteredAt: 1_800_000_000_000,
    hashedEmail: "email-hash",
    hashedPhone: "phone-hash",
    hashedFirstName: null,
    hashedLastName: null,
    utmSource: "video-a|apy_fbc=fb.1.1800000000.click-123|apy_fbp=fb.1.1800000000.browser-456",
  };

  it("builds a real, deduplicated website Purchase event", () => {
    const payload = buildMetaPurchasePayload(row);
    expect(payload.test_event_code).toBeUndefined();
    expect(payload.data[0]).toMatchObject({
      event_name: "Purchase",
      event_time: 1_800_000_000,
      event_id: "apy_purchase_gst-123",
      action_source: "website",
      event_source_url: "https://afropuppyyoga.ca/kitchener",
      user_data: {
        em: "email-hash",
        ph: "phone-hash",
        fbc: "fb.1.1800000000.click-123",
        fbp: "fb.1.1800000000.browser-456",
      },
      custom_data: {
        currency: "CAD",
        value: 118.65,
        content_name: "Puppy Yoga — Kitchener",
      },
    });
  });

  it("adds the test event code only when supplied by explicit test mode", () => {
    expect(buildMetaPurchasePayload(row, "TEST123").test_event_code).toBe("TEST123");
  });
});

describe("extractMetaBrowserIds", () => {
  it("extracts valid plaintext fbc and fbp values from Luma utm_content", () => {
    expect(extractMetaBrowserIds(
      "creative-a|apy_fbc=fb.1.1800000000.click-123|apy_fbp=fb.1.1800000000.browser-456",
    )).toEqual({
      fbc: "fb.1.1800000000.click-123",
      fbp: "fb.1.1800000000.browser-456",
    });
  });

  it("rejects malformed browser identifiers", () => {
    expect(extractMetaBrowserIds("apy_fbc=not-valid|apy_fbp=<script>"))
      .toEqual({ fbc: null, fbp: null });
  });
});
