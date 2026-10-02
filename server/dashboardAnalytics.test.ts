import { describe, expect, it, vi } from "vitest";
import { buildDashboardOverview, dashboardAnalyticsTestUtils, getDashboardOverview } from "./dashboardAnalytics";
import type { StripeDashboardRevenue } from "./stripeDashboardRevenue";

const stripeUnavailable: StripeDashboardRevenue = {
  status: "not_configured",
  source: null,
  refreshedAt: null,
  grossCollectedCents: null,
  refundedCents: null,
  netCollectedCents: null,
  transactions: null,
  eventLinkedTransactions: null,
  unlinkedTransactions: null,
  complete: false,
  monthly: [],
  byEventId: {},
  message: "Stripe revenue reporting is not configured for this server.",
};

const stripeFetcher = async () => stripeUnavailable;

const entries = [
  {
    api_id: "evt-paid",
    event: { api_id: "evt-paid", name: "Puppy Yoga | 🐶 Golden Retrievers", start_at: "2025-09-01T15:00:00Z", geo_address_info: { city: "Kitchener" } },
    ticket_info: { is_free: false, price: { cents: 5600, currency: "cad" } },
    ticket_count: 4,
    guest_count: 3,
    status: "approved",
  },
  {
    api_id: "evt-no-price",
    event: { api_id: "evt-no-price", name: "Puppy Yoga | 🐶 Dachshunds", start_at: "2025-09-08T15:00:00Z", geo_address_info: { city: "Hamilton" } },
    ticket_info: { is_free: false },
    ticket_count: 2,
    guest_count: 2,
    status: "approved",
  },
  {
    api_id: "evt-upcoming",
    event: { api_id: "evt-upcoming", name: "Puppy Yoga | 🐶 Bernese Mountain Dogs", start_at: "2099-09-08T15:00:00Z", geo_address_info: { city: "Oakville" } },
    ticket_info: { is_free: false, price: { cents: 6000, currency: "cad" } },
    ticket_count: 0,
    status: "approved",
  },
  {
    api_id: "evt-private",
    event: { api_id: "evt-private", name: "Private Puppy Yoga", start_at: "2025-09-10T15:00:00Z", geo_address_info: { city: "Kitchener" } },
    ticket_count: 100,
    status: "approved",
  },
] as const;

function emptyLumaResponse() {
  return new Response(JSON.stringify({ entries: [], has_more: false }), { status: 200 });
}

describe("private dashboard aggregation", () => {
  it("withholds total estimated revenue when public pricing coverage is incomplete", () => {
    const overview = buildDashboardOverview([...entries], "2026-10-01T12:00:00.000Z");

    expect(overview.source.revenueStatus).toBe("estimated");
    expect(overview.source.name).toBe("Luma public calendar API");
    expect(overview.summary.totalTickets).toBe(6);
    expect(overview.summary.estimatedRevenueCents).toBeNull();
    expect(overview.summary.estimatedRevenueEvents).toBe(1);
    expect(overview.source.note).toContain("Not Stripe-confirmed sales");
  });

  it("counts confirmed free classes as zero revenue instead of unknown revenue", () => {
    const freeEntry = {
      api_id: "evt-free",
      event: { api_id: "evt-free", name: "Puppy Yoga | 🐶 Pugs", start_at: "2025-10-01T15:00:00Z", geo_address_info: { city: "Kitchener" } },
      ticket_info: { is_free: true },
      ticket_count: 5,
      status: "approved",
    };
    const overview = buildDashboardOverview([freeEntry], "2026-10-01T12:00:00.000Z");

    expect(overview.summary.estimatedRevenueCents).toBe(0);
    expect(overview.recentEvents[0]?.estimatedRevenueCents).toBe(0);
  });

  it("withholds estimates for ambiguous public prices", () => {
    const noCurrency = { ...entries[0], ticket_info: { is_free: false, price: { cents: 5600 } } };
    const tieredOnly = { ...entries[0], api_id: "evt-tiered", event: { ...entries[0].event, api_id: "evt-tiered" }, ticket_info: { is_free: false, max_price: { cents: 5600, currency: "cad" } } };
    const differentRange = { ...entries[0], api_id: "evt-range", event: { ...entries[0].event, api_id: "evt-range" }, ticket_info: { is_free: false, price: { cents: 4900, currency: "cad" }, max_price: { cents: 5600, currency: "cad" } } };
    const contradictoryFree = { ...entries[0], api_id: "evt-contradictory", event: { ...entries[0].event, api_id: "evt-contradictory" }, ticket_info: { is_free: true, price: { cents: 5600, currency: "cad" } } };
    const nonCad = { ...entries[0], api_id: "evt-usd", event: { ...entries[0].event, api_id: "evt-usd" }, ticket_info: { is_free: false, price: { cents: 5600, currency: "usd" } } };

    expect(() => buildDashboardOverview([noCurrency])).toThrow("invalid ticket pricing");
    expect(buildDashboardOverview([tieredOnly]).summary.estimatedRevenueCents).toBeNull();
    expect(buildDashboardOverview([differentRange]).summary.estimatedRevenueCents).toBeNull();
    expect(buildDashboardOverview([contradictoryFree]).summary.estimatedRevenueCents).toBeNull();
    expect(buildDashboardOverview([nonCad]).summary.estimatedRevenueCents).toBeNull();
  });

  it("separates future demand from past performance and excludes non-class records", () => {
    const overview = buildDashboardOverview([...entries]);

    expect(overview.summary.pastEvents).toBe(2);
    expect(overview.summary.upcomingEvents).toBe(1);
    expect(overview.upcomingEvents).toEqual([{ id: "evt-upcoming", name: "Puppy Yoga | 🐶 Bernese Mountain Dogs", date: "2099-09-08", location: "Oakville", breed: "Bernese Mountain Dogs" }]);
    expect(overview.recentEvents.every(event => !event.name.toLowerCase().includes("private"))).toBe(true);
  });

  it("excludes cancelled data and withholds ticket totals when a count is unknown", () => {
    const cancelled = { ...entries[0], api_id: "evt-cancelled", event: { ...entries[0].event, api_id: "evt-cancelled" }, status: "cancelled" };
    const missingTicketCount = { ...entries[0], api_id: "evt-unknown-tickets", event: { ...entries[0].event, api_id: "evt-unknown-tickets" }, ticket_count: null };
    const overview = buildDashboardOverview([entries[0], cancelled, missingTicketCount]);

    expect(overview.summary.pastEvents).toBe(2);
    expect(overview.summary.totalTickets).toBeNull();
    expect(overview.summary.eventsWithTicketCount).toBe(1);
    expect(overview.summary.estimatedRevenueCents).toBeNull();
    expect(overview.byLocation[0]?.tickets).toBeNull();
  });

  it("fails closed when Luma returns malformed data or an unfamiliar status", async () => {
    dashboardAnalyticsTestUtils.resetCache();
    const malformedFetch = vi.fn().mockImplementation(() => new Response(JSON.stringify({ has_more: false }), { status: 200 }));
    await expect(getDashboardOverview(malformedFetch as typeof fetch, 1_000, stripeFetcher)).rejects.toThrow("incomplete");

    const unknownStatus = { ...entries[0], status: "mystery_state" };
    expect(() => buildDashboardOverview([unknownStatus])).toThrow("unrecognized status");

    const invalidTimestamp = { ...entries[0], event: { ...entries[0].event, start_at: "not-a-date" } };
    const timezoneLessTimestamp = { ...entries[0], event: { ...entries[0].event, start_at: "2025-09-01T15:00:00" } };
    const normalizedTimestamp = { ...entries[0], event: { ...entries[0].event, start_at: "2025-02-30T15:00:00Z" } };
    const invalidOffsetTimestamp = { ...entries[0], event: { ...entries[0].event, start_at: "2025-09-01T15:00:00+99:99" } };
    const fractionalTickets = { ...entries[0], ticket_count: 2.5 };
    expect(() => buildDashboardOverview([invalidTimestamp])).toThrow("incomplete");
    expect(() => buildDashboardOverview([timezoneLessTimestamp])).toThrow("incomplete");
    expect(() => buildDashboardOverview([normalizedTimestamp])).toThrow("incomplete");
    expect(() => buildDashboardOverview([invalidOffsetTimestamp])).toThrow("incomplete");
    expect(() => buildDashboardOverview([fractionalTickets])).toThrow("invalid ticket count");
  });

  it("withholds financial estimates when arithmetic would exceed safe precision", () => {
    const overflow = { ...entries[0], ticket_count: Number.MAX_SAFE_INTEGER, ticket_info: { is_free: false, price: { cents: 2, currency: "cad" } } };
    expect(buildDashboardOverview([overflow]).summary.estimatedRevenueCents).toBeNull();
  });

  it("always returns twelve contiguous Toronto month buckets, including quiet months", () => {
    const overview = buildDashboardOverview([...entries]);
    const keys = overview.monthly.map(row => row.month);

    expect(keys).toHaveLength(12);
    expect(overview.monthly.some(row => row.events === 0 && row.tickets === 0 && row.estimatedRevenueCents === 0)).toBe(true);
    for (let index = 1; index < keys.length; index += 1) {
      const previous = new Date(`${keys[index - 1]}-01T00:00:00Z`);
      const current = new Date(`${keys[index]}-01T00:00:00Z`);
      expect((current.getUTCFullYear() - previous.getUTCFullYear()) * 12 + current.getUTCMonth() - previous.getUTCMonth()).toBe(1);
    }
  });

  it("coalesces concurrent cache misses into one Luma request sequence", async () => {
    dashboardAnalyticsTestUtils.resetCache();
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fetchImpl = vi.fn().mockImplementation(async () => {
      await gate;
      return emptyLumaResponse();
    });

    const first = getDashboardOverview(fetchImpl as typeof fetch, 10_000, stripeFetcher);
    const second = getDashboardOverview(fetchImpl as typeof fetch, 10_001, stripeFetcher);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    release?.();
    await Promise.all([first, second]);
  });

  it("uses the short aggregate cache after a successful refresh", async () => {
    dashboardAnalyticsTestUtils.resetCache();
    const fetchImpl = vi.fn().mockImplementation(emptyLumaResponse);

    await getDashboardOverview(fetchImpl as typeof fetch, 1_000, stripeFetcher);
    await getDashboardOverview(fetchImpl as typeof fetch, 2_000, stripeFetcher);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns only aggregate internal reporting fields", () => {
    const overview = buildDashboardOverview([...entries]);
    const serialized = JSON.stringify(overview);

    expect(serialized).not.toContain("guest_count");
    expect(serialized).not.toContain("customerEmail");
    expect(serialized).not.toContain("customerName");
    expect(serialized).not.toContain("payment_intent");
    expect(serialized).not.toContain("sk_live");
    expect(overview.instagram.status).toBe("verified_snapshot");
    expect(overview.instagram.followers).toBeGreaterThan(0);
  });

  it("keeps Stripe actual collections separate from Luma estimates", () => {
    const stripe: StripeDashboardRevenue = {
      ...stripeUnavailable,
      status: "connected",
      source: "Stripe live charges",
      refreshedAt: "2026-10-02T00:00:00.000Z",
      grossCollectedCents: 5600,
      refundedCents: 0,
      netCollectedCents: 5600,
      transactions: 1,
      eventLinkedTransactions: 1,
      unlinkedTransactions: 0,
      complete: true,
      monthly: [{ month: "2025-09", grossCollectedCents: 5600, refundedCents: 0, netCollectedCents: 5600, transactions: 1 }],
      byEventId: { "evt-paid": { grossCollectedCents: 5600, refundedCents: 0, netCollectedCents: 5600, transactions: 1 } },
      message: "Successful captured CAD Stripe charges.",
    };
    const overview = buildDashboardOverview([...entries], "2026-10-01T12:00:00.000Z", stripe);

    expect(overview.stripe.netCollectedCents).toBe(5600);
    expect(overview.summary.estimatedRevenueCents).toBeNull();
    expect(overview.recentEvents.find(event => event.id === "evt-paid")?.stripeNetCollectedCents).toBe(5600);
  });

  it("withholds Stripe totals, months, and class matches when history is incomplete", () => {
    const incompleteStripe: StripeDashboardRevenue = {
      ...stripeUnavailable,
      status: "connected",
      source: "Stripe live charges",
      refreshedAt: "2026-10-02T00:00:00.000Z",
      grossCollectedCents: 5600,
      refundedCents: 0,
      netCollectedCents: 5600,
      transactions: 1,
      eventLinkedTransactions: 1,
      unlinkedTransactions: 0,
      complete: false,
      monthly: [{ month: "2025-09", grossCollectedCents: 5600, refundedCents: 0, netCollectedCents: 5600, transactions: 1 }],
      byEventId: { "evt-paid": { grossCollectedCents: 5600, refundedCents: 0, netCollectedCents: 5600, transactions: 1 } },
      message: "Stripe history is incomplete.",
    };
    const overview = buildDashboardOverview([...entries], "2026-10-01T12:00:00.000Z", incompleteStripe);

    expect(overview.stripe.complete).toBe(false);
    expect(overview.stripe.netCollectedCents).toBeNull();
    expect(overview.monthly.every(row => row.stripeNetCollectedCents === null)).toBe(true);
    expect(overview.recentEvents.find(event => event.id === "evt-paid")?.stripeNetCollectedCents).toBeNull();
  });
});
