import { describe, expect, it } from "vitest";
import { calculateLumaTicketPricing, calculatePrivateEventPrice, privateEventQuoteNeedsApproval } from "./routers/privateEvents";
import { buildPrivateEventSessionSchedule } from "./privateEventMultiSession";
import { buildPrivateEventQuoteDraft } from "./privateEventQuote";

describe("private event commercial controls", () => {
  it("calculates plus-HST quotes in integer cents", () => {
    expect(calculatePrivateEventPrice(1000, "plus_hst")).toEqual({
      basePriceCents: 100000,
      hstCents: 13000,
      totalCents: 113000,
    });
  });

  it("extracts the HST portion from an all-in price", () => {
    expect(calculatePrivateEventPrice(1130, "all_in")).toEqual({
      basePriceCents: 100000,
      hstCents: 13000,
      totalCents: 113000,
    });
  });

  it("requires owner approval for discounts below the estimate and quotes above $3,000", () => {
    expect(privateEventQuoteNeedsApproval(899, 900)).toBe(true);
    expect(privateEventQuoteNeedsApproval(3000.01, 900)).toBe(true);
    expect(privateEventQuoteNeedsApproval(900, 900)).toBe(false);
    expect(privateEventQuoteNeedsApproval(3000, 900)).toBe(false);
  });

  it("doubles a two-session combined checkout before calculating HST", () => {
    expect(calculatePrivateEventPrice(1200, "plus_hst", 2)).toEqual({
      basePriceCents: 240000,
      hstCents: 31200,
      totalCents: 271200,
    });
  });

  it("derives one combined pre-tax Luma ticket for an all-in two-session price", () => {
    expect(calculateLumaTicketPricing(1130, "all_in", 2)).toEqual({
      lumaTicketCents: 200000,
      hstCents: 26000,
      totalCents: 226000,
    });
  });

  it("creates a second 90-minute class 30 minutes after the first class ends", () => {
    expect(buildPrivateEventSessionSchedule({
      startTime: "14:00",
      endTime: "15:30",
      sessions: 2,
    })).toEqual([
      { startTime: "14:00", endTime: "15:30" },
      { startTime: "16:00", endTime: "17:30" },
    ]);
  });

  it("states both time slots and one combined booking link in the client quote", () => {
    const quote = buildPrivateEventQuoteDraft({
      customerName: "Taylor Example",
      eventType: "Corporate",
      guests: 20,
      packageType: "classic",
      eventDate: "2026-09-19",
      startTime: "14:00",
      sessionSchedule: [
        { startTime: "14:00", endTime: "15:30" },
        { startTime: "16:00", endTime: "17:30" },
      ],
      venue: "kitchener",
      basePriceCents: 240000,
      hstCents: 31200,
      pricingType: "plus_hst",
      eventUrl: "https://example.com/private-booking",
    });

    expect(quote.body).toContain("Session 1: 2:00 PM–3:30 PM");
    expect(quote.body).toContain("Session 2: 4:00 PM–5:30 PM");
    expect(quote.body).toContain("30-minute break");
    expect(quote.body).toContain("this one private booking link");
  });
});
