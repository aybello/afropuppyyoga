import { afterEach, describe, expect, it, vi } from "vitest";

const originalStripeKey = process.env.STRIPE_LIVE_SECRET_KEY;

afterEach(() => {
  vi.resetModules();
  if (originalStripeKey === undefined) {
    delete process.env.STRIPE_LIVE_SECRET_KEY;
  } else {
    process.env.STRIPE_LIVE_SECRET_KEY = originalStripeKey;
  }
});

describe("revenue router startup", () => {
  it("loads without Stripe credentials so the server can start", async () => {
    delete process.env.STRIPE_LIVE_SECRET_KEY;
    await expect(import("./revenue")).resolves.toHaveProperty("revenueRouter");
  });
});
