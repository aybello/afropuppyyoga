import { describe, expect, it } from "vitest";
import { calculateLumaTicketPricing } from "./privateEvents";

describe("private-event Luma ticket pricing", () => {
  it("sends the pre-tax quote to Luma when the quote is plus HST", () => {
    expect(calculateLumaTicketPricing(2250, "plus_hst")).toEqual({
      lumaTicketCents: 225000,
      hstCents: 29250,
      totalCents: 254250,
    });
  });

  it("backs an all-in quote into a pre-tax Luma ticket so the final checkout total stays unchanged", () => {
    expect(calculateLumaTicketPricing(2250, "all_in")).toEqual({
      lumaTicketCents: 199115,
      hstCents: 25885,
      totalCents: 225000,
    });
  });
});
