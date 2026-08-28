import { describe, expect, it } from "vitest";
import { calculatePrivateEventPrice, privateEventQuoteNeedsApproval } from "./routers/privateEvents";

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
      basePriceCents: 113000,
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
});
