import { describe, expect, it } from "vitest";
import { appendCampaignAttribution, calculateMaximumSpendCents, campaignDraftSchema, validateCampaignDates, validateCampaignSafety } from "../shared/metaCampaigns";

const base = {
  source: { type: "regular_class" as const, id: 4 },
  campaignName: "APY | Kitchener | Golden Retriever | 2026-11-01",
  primaryText: "Meet the puppies.",
  headline: "Book puppy yoga",
  description: "",
  callToAction: "BOOK_NOW" as const,
  placements: ["instagram" as const],
  budgetType: "daily" as const,
  budgetCents: 2500,
  startDate: "2026-11-01",
  endDate: "2026-11-03",
};

describe("campaign draft contract", () => {
  it("calculates daily maximum spend inclusively", () => {
    expect(calculateMaximumSpendCents(base)).toBe(7500);
  });

  it("rejects an empty placement selection", () => {
    expect(campaignDraftSchema.safeParse({ ...base, placements: [] }).success).toBe(false);
  });

  it("rejects past-only and inverted date ranges", () => {
    expect(validateCampaignDates({ startDate: "2026-01-01", endDate: "2026-01-02" }, new Date("2026-10-01T16:00:00Z"))).toContain("past");
    expect(validateCampaignDates({ startDate: "2026-11-03", endDate: "2026-11-01" }, new Date("2026-10-01T16:00:00Z"))).toContain("end date");
  });

  it("enforces event-date, duration, daily and total planned-spend limits server-side", () => {
    const today = new Date("2026-10-01T16:00:00Z");
    expect(validateCampaignSafety({ ...base, startDate: "2026-10-01", endDate: "2026-11-02" }, "2026-11-01", undefined, today)).toContain("end on or before");
    expect(validateCampaignSafety({ ...base, startDate: "2026-10-01", endDate: "2026-11-01" }, "2026-11-01", undefined, today)).toContain("31 days");
    expect(validateCampaignSafety({ ...base, startDate: "2026-10-30", endDate: "2026-11-01", budgetCents: 50_001 }, "2026-11-01", undefined, today)).toContain("daily budget");
    expect(validateCampaignSafety({ ...base, budgetType: "total", startDate: "2026-10-30", endDate: "2026-11-01", budgetCents: 500_001 }, "2026-11-01", undefined, today)).toContain("maximum spend");
  });

  it("sets canonical paid-social attribution without losing existing Luma parameters", () => {
    const url = appendCampaignAttribution("https://lu.ma/example?existing=1", "apy-kitchener-2026-11-01", "creative-1");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("existing")).toBe("1");
    expect(parsed.searchParams.get("utm_source")).toBe("meta");
    expect(parsed.searchParams.get("utm_medium")).toBe("paid_social");
    expect(parsed.searchParams.get("utm_campaign")).toBe("apy-kitchener-2026-11-01");
    expect(parsed.searchParams.get("utm_content")).toBe("creative-1");
  });
});
