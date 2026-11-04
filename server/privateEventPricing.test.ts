import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  PRIVATE_EVENT_PACKAGE_BANDS, PRIVATE_EVENT_PRICE_NOTE,
  PRIVATE_EVENT_TRAVEL_NOTE, estimatePrivateEventPackage,
  privateEventBandLabel, formatStoredPrivateEventEstimate, isCustomPrivateEventEstimate,
  type PrivateEventPackageType,
} from "@shared/privateEventPricing";

vi.mock("@/lib/trpc", () => ({
  trpc: { privateEvents: { submitInquiry: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } },
}));
import PrivateEventQuote from "../client/src/pages/PrivateEventQuote";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const packages: PrivateEventPackageType[] = ["classic", "signature", "luxury"];

describe("approved private-event pricing test bands", () => {
  it("keeps the exact approved ranges and no margin or optimality guarantee", () => {
    expect(PRIVATE_EVENT_PACKAGE_BANDS.classic).toEqual({ name: "Classic Experience", min: 1500, max: 1750 });
    expect(PRIVATE_EVENT_PACKAGE_BANDS.signature).toEqual({ name: "Signature Experience", min: 2000, max: 2250 });
    expect(PRIVATE_EVENT_PACKAGE_BANDS.luxury).toEqual({ name: "Luxury Experience", min: 2500, max: 3500 });
    expect(PRIVATE_EVENT_PRICE_NOTE).toContain("confirmed scope, date and delivery costs");
    expect(PRIVATE_EVENT_PRICE_NOTE).toContain("plus HST");
    expect(PRIVATE_EVENT_PRICE_NOTE).not.toMatch(/optimal|guaranteed margin/i);
  });

  it.each(packages)("shows the complete %s band before HST for a standard 20-guest scope", packageType => {
    const estimate = estimatePrivateEventPackage({ packageType, guests: 20 });
    const band = PRIVATE_EVENT_PACKAGE_BANDS[packageType];
    expect(estimate).toMatchObject({ min: band.min, max: band.max, requiresCustomQuote: false });
    expect(estimate).not.toHaveProperty("sessions");
  });

  it.each(packages)("preserves the selected %s package while requiring a custom larger-event quote", packageType => {
    for (const guests of [21, 40, 41, 200]) {
      const estimate = estimatePrivateEventPackage({ packageType, guests });
      expect(estimate.requiresCustomQuote).toBe(true);
      expect(estimate.min).toBe(PRIVATE_EVENT_PACKAGE_BANDS[packageType].min);
      expect(estimate.max).toBe(PRIVATE_EVENT_PACKAGE_BANDS[packageType].max);
      expect(estimate.breakdown.join(" ")).toContain("may exceed");
      expect(estimate.breakdown.join(" ")).not.toMatch(/\+\$\d/);
    }
  });

  it("states that travel is separate rather than guessing a city fee", () => {
    for (const packageType of packages) {
      const estimate = estimatePrivateEventPackage({ packageType, guests: 10 });
      expect(estimate.breakdown).toContain(PRIVATE_EVENT_TRAVEL_NOTE);
      expect(privateEventBandLabel(packageType)).toMatch(/\+ HST$/);
    }
    const client = read("client/src/pages/PrivateEventQuote.tsx");
    expect(client).toContain("estimatePrivateEventPackage({ guests: guestCount, packageType })");
    expect(client).not.toContain("TRAVEL_FEES");
    expect(client).not.toContain("SIGNATURE_UPGRADE");
    expect(client).not.toContain("SECOND_SESSION_MIN");
  });

  it("renders all package ranges plus HST above the same editable form", () => {
    const html = renderToStaticMarkup(createElement(PrivateEventQuote));
    for (const packageType of packages) expect(html).toContain(privateEventBandLabel(packageType));
    expect(html).toContain(PRIVATE_EVENT_PRICE_NOTE);
    expect(html).not.toContain("$1,200");
    expect(html.indexOf('id="private-event-packages"')).toBeLessThan(html.indexOf('id="quote-form"'));
    expect(html.match(/<form\b/g)).toHaveLength(1);
    expect(html).toContain("Professional event photography");
    expect(html).toContain("Curated gift bag &amp; branded add-on options");
  });

  it("displays a custom estimate as non-numeric and does not reprice historic stored values", () => {
    expect(formatStoredPrivateEventEstimate(0, 0)).toBe("Custom quote required");
    expect(formatStoredPrivateEventEstimate(1200, 1500)).toBe("$1,200-$1,500 CAD");
    expect(isCustomPrivateEventEstimate(1200, 1500)).toBe(false);
    for (const [min, max] of [[0, 1500], [1500, 0], [-1, 1500]]) {
      expect(isCustomPrivateEventEstimate(min, max)).toBe(true);
      expect(formatStoredPrivateEventEstimate(min, max)).toBe("Custom quote required");
    }
    const admin = read("client/src/pages/PrivateEventsDashboard.tsx");
    expect(admin).toContain("formatStoredPrivateEventEstimate(inq.estimatedMin, inq.estimatedMax)");
    expect(admin).toContain("formatStoredPrivateEventEstimate(selectedInquiry.estimatedMin, selectedInquiry.estimatedMax)");
    expect(admin).toContain('isCustomPrivateEventEstimate(inq.estimatedMin, inq.estimatedMax) ? "" : String(inq.estimatedMax)');
    expect(admin).toContain("isCustomPrivateEventEstimate(selectedInquiry.estimatedMin, selectedInquiry.estimatedMax)");
    expect(admin).toContain('String(inq.finalPriceCents / 100)');
    expect(admin).toContain("combinedQuoteInput > 3000");
  });
});
