import Stripe from "stripe";

const PAGE_SIZE = 100;
const MAX_CHARGE_PAGES = 100;

export type StripeEventRevenue = {
  grossCollectedCents: number;
  refundedCents: number;
  netCollectedCents: number;
  transactions: number;
};

export type StripeDashboardRevenue = {
  status: "connected" | "not_configured" | "unavailable";
  source: "Stripe live charges" | null;
  refreshedAt: string | null;
  grossCollectedCents: number | null;
  refundedCents: number | null;
  netCollectedCents: number | null;
  transactions: number | null;
  eventLinkedTransactions: number | null;
  unlinkedTransactions: number | null;
  complete: boolean;
  monthly: Array<{
    month: string;
    grossCollectedCents: number;
    refundedCents: number;
    netCollectedCents: number;
    transactions: number;
  }>;
  byEventId: Record<string, StripeEventRevenue>;
  message: string;
};

function unavailableRevenue(status: "not_configured" | "unavailable", message: string): StripeDashboardRevenue {
  return {
    status,
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
    message,
  };
}

function getStripeClient() {
  const apiKey = process.env.STRIPE_LIVE_SECRET_KEY;
  if (!apiKey) return null;
  return new Stripe(apiKey, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });
}

function addSafe(left: number, right: number) {
  const result = left + right;
  return Number.isSafeInteger(result) ? result : null;
}

function validCents(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function chargeMonth(charge: Stripe.Charge) {
  return new Date(charge.created * 1000).toISOString().slice(0, 7);
}

function isEligibleCharge(charge: Stripe.Charge) {
  return charge.livemode
    && charge.status === "succeeded"
    && charge.paid === true
    && charge.captured === true
    && charge.currency?.toLowerCase() === "cad"
    && validCents(charge.amount)
    && validCents(charge.amount_refunded)
    && charge.amount_refunded <= charge.amount;
}

export function summarizeStripeCharges(
  charges: Stripe.Charge[],
  refreshedAt = new Date().toISOString(),
  complete = true,
): StripeDashboardRevenue {
  let grossCollectedCents = 0;
  let refundedCents = 0;
  let transactions = 0;
  let eventLinkedTransactions = 0;
  const byEventId: Record<string, StripeEventRevenue> = {};
  const monthly = new Map<string, StripeDashboardRevenue["monthly"][number]>();

  for (const charge of charges) {
    if (!isEligibleCharge(charge)) continue;
    const amount = charge.amount;
    const refunded = charge.amount_refunded;
    const net = amount - refunded;
    const nextGross = addSafe(grossCollectedCents, amount);
    const nextRefunds = addSafe(refundedCents, refunded);
    if (nextGross === null || nextRefunds === null) {
      return unavailableRevenue("unavailable", "Stripe revenue could not be calculated safely.");
    }
    grossCollectedCents = nextGross;
    refundedCents = nextRefunds;
    transactions += 1;

    const month = chargeMonth(charge);
    const monthRow = monthly.get(month) ?? { month, grossCollectedCents: 0, refundedCents: 0, netCollectedCents: 0, transactions: 0 };
    const nextMonthGross = addSafe(monthRow.grossCollectedCents, amount);
    const nextMonthRefunds = addSafe(monthRow.refundedCents, refunded);
    const nextMonthNet = addSafe(monthRow.netCollectedCents, net);
    if (nextMonthGross === null || nextMonthRefunds === null || nextMonthNet === null) {
      return unavailableRevenue("unavailable", "Stripe revenue could not be calculated safely.");
    }
    monthly.set(month, {
      month,
      grossCollectedCents: nextMonthGross,
      refundedCents: nextMonthRefunds,
      netCollectedCents: nextMonthNet,
      transactions: monthRow.transactions + 1,
    });

    const eventId = typeof charge.metadata?.event_api_id === "string" ? charge.metadata.event_api_id.trim() : "";
    if (!eventId) continue;
    eventLinkedTransactions += 1;
    const eventRow = byEventId[eventId] ?? { grossCollectedCents: 0, refundedCents: 0, netCollectedCents: 0, transactions: 0 };
    const nextEventGross = addSafe(eventRow.grossCollectedCents, amount);
    const nextEventRefunds = addSafe(eventRow.refundedCents, refunded);
    const nextEventNet = addSafe(eventRow.netCollectedCents, net);
    if (nextEventGross === null || nextEventRefunds === null || nextEventNet === null) {
      return unavailableRevenue("unavailable", "Stripe revenue could not be calculated safely.");
    }
    byEventId[eventId] = {
      grossCollectedCents: nextEventGross,
      refundedCents: nextEventRefunds,
      netCollectedCents: nextEventNet,
      transactions: eventRow.transactions + 1,
    };
  }

  return {
    status: "connected",
    source: "Stripe live charges",
    refreshedAt,
    grossCollectedCents,
    refundedCents,
    netCollectedCents: grossCollectedCents - refundedCents,
    transactions,
    eventLinkedTransactions,
    unlinkedTransactions: transactions - eventLinkedTransactions,
    complete,
    monthly: Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month)),
    byEventId,
    message: complete
      ? "Successful captured CAD Stripe charges. Gross collected is shown before refunds; net collected deducts recorded refunds."
      : "Successful captured CAD Stripe charges up to the dashboard safety limit. The result is incomplete because the account has more historical charges than this dashboard can safely load in one refresh.",
  };
}

export async function getStripeDashboardRevenue(stripeClient: Pick<Stripe, "charges"> | null = getStripeClient()): Promise<StripeDashboardRevenue> {
  const stripe = stripeClient;
  if (!stripe) return unavailableRevenue("not_configured", "Stripe revenue reporting is not configured for this server.");

  try {
    const charges: Stripe.Charge[] = [];
    let startingAfter: string | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore && pages < MAX_CHARGE_PAGES) {
      const page = await stripe.charges.list({ limit: PAGE_SIZE, ...(startingAfter ? { starting_after: startingAfter } : {}) });
      charges.push(...page.data);
      hasMore = page.has_more;
      startingAfter = page.data.at(-1)?.id;
      pages += 1;
      if (!startingAfter && hasMore) throw new Error("Stripe charge pagination stopped unexpectedly.");
    }

    return summarizeStripeCharges(charges, new Date().toISOString(), !hasMore);
  } catch {
    return unavailableRevenue("unavailable", "Stripe revenue could not be refreshed. Try again shortly.");
  }
}
