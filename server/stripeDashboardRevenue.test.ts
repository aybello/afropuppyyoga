import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { getStripeDashboardRevenue, summarizeStripeCharges } from "./stripeDashboardRevenue";

function charge(overrides: Partial<Stripe.Charge> = {}) {
  return {
    id: "ch_test",
    object: "charge",
    livemode: true,
    status: "succeeded",
    paid: true,
    captured: true,
    currency: "cad",
    amount: 5600,
    amount_refunded: 0,
    created: 1_759_276_800,
    metadata: { event_api_id: "evt_luma" },
    ...overrides,
  } as Stripe.Charge;
}

function stripePage(data: Stripe.Charge[], hasMore = false) {
  return { data, has_more: hasMore, object: "list", url: "/v1/charges" } as Stripe.ApiList<Stripe.Charge>;
}

describe("Stripe dashboard revenue", () => {
  it("returns aggregate-only exact Stripe revenue and Luma event matches", () => {
    const summary = summarizeStripeCharges([
      charge(),
      charge({ id: "ch_refund", amount: 12000, amount_refunded: 2000, metadata: { event_api_id: "evt_other" } }),
      charge({ id: "ch_unlinked", amount: 5000, metadata: {} }),
      charge({ id: "ch_failed", status: "failed", paid: false, amount: 9000 }),
    ], "2026-10-02T00:00:00.000Z");

    expect(summary.status).toBe("connected");
    expect(summary.complete).toBe(true);
    expect(summary.grossCollectedCents).toBe(22600);
    expect(summary.refundedCents).toBe(2000);
    expect(summary.netCollectedCents).toBe(20600);
    expect(summary.transactions).toBe(3);
    expect(summary.eventLinkedTransactions).toBe(2);
    expect(summary.unlinkedTransactions).toBe(1);
    expect(summary.byEventId.evt_luma).toMatchObject({ grossCollectedCents: 5600, netCollectedCents: 5600, transactions: 1 });
    expect(summary.byEventId.evt_other).toMatchObject({ grossCollectedCents: 12000, refundedCents: 2000, netCollectedCents: 10000 });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toMatch(/customer|email|name|payment_intent|payment_method|secret|sk_/i);
  });

  it("deducts partial and full refunds from event and account net collections", () => {
    const summary = summarizeStripeCharges([
      charge({ id: "ch_partial", amount: 10000, amount_refunded: 2500, metadata: { event_api_id: "evt_refunds" } }),
      charge({ id: "ch_full", amount: 5000, amount_refunded: 5000, metadata: { event_api_id: "evt_refunds" } }),
    ]);

    expect(summary.grossCollectedCents).toBe(15000);
    expect(summary.refundedCents).toBe(7500);
    expect(summary.netCollectedCents).toBe(7500);
    expect(summary.byEventId.evt_refunds).toEqual({ grossCollectedCents: 15000, refundedCents: 7500, netCollectedCents: 7500, transactions: 2 });
  });

  it("excludes non-CAD, uncaptured, failed, and test-mode charges", () => {
    const summary = summarizeStripeCharges([
      charge({ currency: "usd" }),
      charge({ id: "ch_uncaptured", captured: false }),
      charge({ id: "ch_failed", status: "failed", paid: false }),
      charge({ id: "ch_test_mode", livemode: false }),
    ]);

    expect(summary.grossCollectedCents).toBe(0);
    expect(summary.transactions).toBe(0);
  });

  it("follows Stripe pagination and marks a safety-limited response incomplete", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce(stripePage([charge({ id: "ch_first" })], true))
      .mockResolvedValueOnce(stripePage([charge({ id: "ch_second", amount: 6600 })], false));
    const result = await getStripeDashboardRevenue({ charges: { list } } as unknown as Pick<Stripe, "charges">);

    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1]?.[0]).toMatchObject({ starting_after: "ch_first" });
    expect(result.complete).toBe(true);
    expect(result.grossCollectedCents).toBe(12200);

    const partial = summarizeStripeCharges([charge()], "2026-10-02T00:00:00.000Z", false);
    expect(partial.complete).toBe(false);
    expect(partial.message).toContain("incomplete");
  });

  it("fails closed when Stripe refresh fails", async () => {
    const result = await getStripeDashboardRevenue({ charges: { list: vi.fn().mockRejectedValue(new Error("Stripe unavailable")) } } as unknown as Pick<Stripe, "charges">);
    expect(result.status).toBe("unavailable");
    expect(result.grossCollectedCents).toBeNull();
    expect(result.byEventId).toEqual({});
  });
});
