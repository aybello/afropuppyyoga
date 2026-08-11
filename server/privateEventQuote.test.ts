import { describe, expect, it } from "vitest";
import { buildPrivateEventQuoteDraft } from "./privateEventQuote";

describe("buildPrivateEventQuoteDraft", () => {
  it("creates a payment-ready corporate offer with the chosen studio and correct HST", () => {
    const draft = buildPrivateEventQuoteDraft({
      customerName: "Taylor Stanbury",
      organization: "Grantek",
      eventType: "Corporate Wellness",
      guests: 20,
      packageType: "classic",
      eventDate: "2026-10-22",
      startTime: "14:30",
      venue: "oakville",
      basePriceCents: 160000,
      hstCents: 20800,
      pricingType: "plus_hst",
      eventUrl: "https://luma.com/afropu-example",
      puppyBreed: "Bernese Mountain Dog",
    });

    expect(draft.subject).toContain("Grantek");
    expect(draft.body).toContain("Hi Taylor,");
    expect(draft.body).toContain("Thursday, October 22, 2026 at 2:30 PM");
    expect(draft.body).toContain("Oakville studio, 1670 North Service Road East, Oakville, ON");
    expect(draft.body).toContain("$1,600.00 + HST ($208.00) = $1,808.00");
    expect(draft.body).toContain("https://luma.com/afropu-example");
    expect(draft.body).toContain("once payment has been completed");
  });

  it("handles all-in pricing without adding HST a second time", () => {
    const draft = buildPrivateEventQuoteDraft({
      customerName: "Avery Chen",
      eventType: "Birthday Party",
      guests: 12,
      packageType: "classic",
      eventDate: "2026-11-07",
      startTime: "11:00",
      venue: "Hamilton Community Centre",
      basePriceCents: 150000,
      hstCents: 17257,
      pricingType: "all_in",
      eventUrl: "https://luma.com/afropu-other",
    });

    expect(draft.body).toContain("$1,500.00 CAD, HST included");
    expect(draft.body).not.toContain("$1,672.57");
    expect(draft.body).toContain("Hamilton Community Centre");
  });
});
