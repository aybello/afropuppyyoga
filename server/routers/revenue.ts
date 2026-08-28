import { z } from "zod";
import Stripe from "stripe";
import { ownerProcedure, router } from "../_core/trpc";
import { getLumaAttendance } from "../lumaAnalytics";

/**
 * Stripe is optional until the Revenue Dashboard is configured. Creating the
 * client lazily keeps the public site and all non-Stripe admin tools available
 * when no production Stripe secret has been supplied yet.
 */
function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_LIVE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Stripe revenue reporting is not configured");
  }

  return new Stripe(apiKey, {
    apiVersion: "2024-12-18.acacia" as any,
  });
}

function normalizeCity(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes("kitchener") || desc.includes("waterloo")) return "Kitchener";
  if (desc.includes("hamilton")) return "Hamilton";
  if (desc.includes("oakville")) return "Oakville";
  if (desc.includes("cambridge")) return "Cambridge";
  if (desc.includes("milton")) return "Milton";
  if (desc.includes("mississauga")) return "Mississauga";
  return "Other";
}

function classifyEvent(description: string): "public" | "private" {
  const desc = description.toLowerCase();
  if (desc.includes("private") || desc.includes("corporate") || desc.includes("team")) return "private";
  return "public";
}

function extractBreed(description: string): string | null {
  const match = description.match(/🐶\s*([^|]+)/);
  if (match) return match[1].trim();
  return null;
}

function extractTimeSlot(description: string): string | null {
  // Stripe descriptions from Luma include ticket names like "10AM Early Bird", "11:30AM Regular"
  const match = description.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i);
  if (match) return match[1].toUpperCase();
  return null;
}

function extractTicketType(description: string): string | null {
  const desc = description.toLowerCase();
  if (desc.includes("early bird")) return "Early Bird 🐣";
  if (desc.includes("bring a friend")) return "Bring a Friend 👯‍♀️";
  if (desc.includes("group of 3")) return "Group of 3 👯‍♀️";
  if (desc.includes("mat rental")) return "Mat Rental 🧘‍♀️";
  if (desc.includes("regular")) return "Regular";
  return null;
}

export const revenueRouter = router({
  getSummary: ownerProcedure
    .input(
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const stripe = getStripeClient();

      // Default to last 30 days instead of all time for faster loads
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const fromTs = input.fromDate
        ? Math.floor(new Date(`${input.fromDate}T00:00:00.000Z`).getTime() / 1000)
        : Math.floor(defaultFrom.getTime() / 1000);
      const toTs = input.toDate
        ? Math.floor(new Date(`${input.toDate}T23:59:59.999Z`).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      // Fetch charges in the date range (cap at 300 to prevent timeout)
      const charges: Stripe.Charge[] = [];
      let hasMore = true;
      let startingAfter: string | undefined;
      const MAX_CHARGES = 300;

      while (hasMore && charges.length < MAX_CHARGES) {
        const params: Stripe.ChargeListParams = {
          limit: 100,
          created: { gte: fromTs, lte: toTs },
        };
        if (startingAfter) params.starting_after = startingAfter;

        const batch = await stripe.charges.list(params);
        charges.push(...batch.data);
        hasMore = batch.has_more;
        if (batch.data.length > 0) {
          startingAfter = batch.data[batch.data.length - 1].id;
        }
      }

      // Filter to successful charges only
      const successfulCharges = charges.filter(c => c.status === "succeeded" && !c.refunded);

      // Aggregate metrics
      let totalRevenueCents = 0;
      let totalFeeCents = 0;
      let totalRefundedCents = 0;
      let totalTransactions = 0;
      const byLocation: Record<string, { revenue: number; transactions: number }> = {};
      const byMonth: Record<string, { revenue: number; transactions: number }> = {};
      const byEventType: Record<string, { revenue: number; transactions: number }> = {};
      const byTicketType: Record<string, { revenue: number; count: number }> = {};
      const byTimeSlot: Record<string, { revenue: number; count: number }> = {};
      const eventRows: Array<{
        id: string;
        description: string;
        amount: number;
        fee: number;
        net: number;
        location: string;
        eventType: string;
        breed: string | null;
        date: string;
        customerEmail: string | null;
        customerName: string | null;
      }> = [];

      for (const charge of successfulCharges) {
        const amount = charge.amount;
        const fee = charge.application_fee_amount || 0;
        const net = amount - fee;
        const description = charge.description || "Unknown";
        const location = normalizeCity(description);
        const eventType = classifyEvent(description);
        const breed = extractBreed(description);
        const timeSlot = extractTimeSlot(description);
        const ticketType = extractTicketType(description);
        const date = new Date(charge.created * 1000).toISOString().split("T")[0];
        const month = date.slice(0, 7); // YYYY-MM

        totalRevenueCents += amount;
        totalFeeCents += fee;
        totalTransactions += 1;

        // By location
        if (!byLocation[location]) byLocation[location] = { revenue: 0, transactions: 0 };
        byLocation[location].revenue += amount;
        byLocation[location].transactions += 1;

        // By month
        if (!byMonth[month]) byMonth[month] = { revenue: 0, transactions: 0 };
        byMonth[month].revenue += amount;
        byMonth[month].transactions += 1;

        // By event type
        if (!byEventType[eventType]) byEventType[eventType] = { revenue: 0, transactions: 0 };
        byEventType[eventType].revenue += amount;
        byEventType[eventType].transactions += 1;

        // By ticket type
        if (ticketType) {
          if (!byTicketType[ticketType]) byTicketType[ticketType] = { revenue: 0, count: 0 };
          byTicketType[ticketType].revenue += amount;
          byTicketType[ticketType].count += 1;
        }

        // By time slot
        if (timeSlot) {
          if (!byTimeSlot[timeSlot]) byTimeSlot[timeSlot] = { revenue: 0, count: 0 };
          byTimeSlot[timeSlot].revenue += amount;
          byTimeSlot[timeSlot].count += 1;
        }

        eventRows.push({
          id: charge.id,
          description,
          amount,
          fee,
          net,
          location,
          eventType,
          breed,
          date,
          customerEmail: charge.billing_details?.email || null,
          customerName: charge.billing_details?.name || null,
        });
      }

      // Get refunds
      const refunds = charges.filter(c => c.refunded || (c.amount_refunded && c.amount_refunded > 0));
      for (const r of refunds) {
        totalRefundedCents += r.amount_refunded || 0;
      }

      // Get balance
      const balance = await stripe.balance.retrieve();
      const availableBalance = balance.available.reduce<number>((sum, b) => sum + b.amount, 0);
      const pendingBalance = balance.pending.reduce<number>((sum, b) => sum + b.amount, 0);

      return {
        summary: {
          totalRevenueCents,
          totalFeeCents,
          totalNetCents: totalRevenueCents - totalFeeCents,
          totalRefundedCents,
          totalTransactions,
          avgTransactionCents: totalTransactions > 0 ? Math.round(totalRevenueCents / totalTransactions) : 0,
          availableBalanceCents: availableBalance,
          pendingBalanceCents: pendingBalance,
        },
        byLocation: Object.entries(byLocation).map(([location, data]) => ({
          location,
          revenueCents: data.revenue,
          transactions: data.transactions,
        })).sort((a, b) => b.revenueCents - a.revenueCents),
        byMonth: Object.entries(byMonth).map(([month, data]) => ({
          month,
          revenueCents: data.revenue,
          transactions: data.transactions,
        })).sort((a, b) => a.month.localeCompare(b.month)),
        byEventType: Object.entries(byEventType).map(([type, data]) => ({
          type,
          revenueCents: data.revenue,
          transactions: data.transactions,
        })),
        recentTransactions: eventRows.slice(0, 50),
        byTicketType: Object.entries(byTicketType).map(([name, data]) => ({
          name,
          revenueCents: data.revenue,
          count: data.count,
        })).sort((a, b) => b.revenueCents - a.revenueCents),
        byTimeSlot: Object.entries(byTimeSlot).map(([slot, data]) => ({
          slot,
          revenueCents: data.revenue,
          count: data.count,
        })).sort((a, b) => b.revenueCents - a.revenueCents),
        dataSource: "stripe",
        chargesAnalyzed: charges.length,
      };
    }),

  getLumaAttendance: ownerProcedure
    .input(z.object({ fromDate: z.string().optional() }))
    .query(async ({ input }) => {
      const apiKey = process.env.LUMA_API_KEY;
      if (!apiKey) throw new Error("LUMA_API_KEY not configured");

      const after = input.fromDate
        ? new Date(`${input.fromDate}T00:00:00.000Z`).toISOString()
        : new Date("2024-08-22T00:00:00.000Z").toISOString();

      return getLumaAttendance(apiKey, after);
    }),
});
