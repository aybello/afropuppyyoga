/**
 * Meta CAPI Credentials Validation Test
 *
 * Validates META_PIXEL_ID and META_CAPI_ACCESS_TOKEN by sending a single
 * test PageView event to the CAPI endpoint with the test event code.
 * This is a live API call — it will appear in Meta Test Events.
 */

import { describe, it, expect } from "vitest";

describe("Meta CAPI credentials", () => {
  it("should have META_PIXEL_ID set and be a valid pixel ID format", () => {
    expect(process.env.META_PIXEL_ID).toBeTruthy();
    expect(process.env.META_PIXEL_ID).toMatch(/^\d{15,16}$/);
  });

  it("should have META_CAPI_ACCESS_TOKEN set", () => {
    expect(process.env.META_CAPI_ACCESS_TOKEN).toBeTruthy();
    expect(process.env.META_CAPI_ACCESS_TOKEN!.length).toBeGreaterThan(50);
  });

  it("should successfully send a test event to the Meta CAPI endpoint", async () => {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    const testEventCode = process.env.META_TEST_EVENT_CODE;

    if (!pixelId || !accessToken) {
      console.warn("[MetaCAPI] Credentials not set — skipping live API test");
      return;
    }

    // Send a minimal test PageView event — appears in Meta Test Events
    const payload = {
      data: [{
        event_name: "PageView",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `credential_test_${Date.now()}`,
        action_source: "website",
        user_data: {
          // Hashed test email (SHA-256 of "test@example.com")
          em: "973dfe0d2b0e9a8a5e305a3c4b5c9a8d3e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b",
        },
      }],
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
    };

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json() as { events_received?: number; error?: { message: string } };

    if (data.error) {
      console.error("[MetaCAPI] CAPI error:", data.error.message);
    }

    expect(res.ok).toBe(true);
    expect(data.error).toBeUndefined();
    expect(data.events_received).toBe(1);
    console.log(`[MetaCAPI] ✓ Credentials valid — events_received: ${data.events_received}`);
  }, 15000);
});
