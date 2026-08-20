import { describe, it, expect } from "vitest";
import Stripe from "stripe";

describe("Stripe API Key Validation", () => {
  it("should connect to Stripe with STRIPE_LIVE_SECRET_KEY", async () => {
    const key = process.env.STRIPE_LIVE_SECRET_KEY;
    expect(key).toBeTruthy();
    const stripe = new Stripe(key!, { apiVersion: "2024-12-18.acacia" as any });
    const balance = await stripe.balance.retrieve();
    expect(balance.object).toBe("balance");
  });
});
