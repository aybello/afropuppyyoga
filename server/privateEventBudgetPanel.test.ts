import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { estimatePrivateEventBudget, privateEventBudgetRange } from "@shared/privateEventBudget";
import type { PrivateEventPreferences } from "@shared/privateEventExperience";
import type { PrivateEventPackageType } from "@shared/privateEventPricing";
import { PrivateEventBudgetPanel } from "../client/src/components/PrivateEventBudgetPanel";

vi.mock("@/hooks/useSeoMeta", () => ({ useSeoMeta: vi.fn() }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/lib/trpc", () => ({
  trpc: { privateEvents: { submitInquiry: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } } },
}));

import PrivateEventQuote from "../client/src/pages/PrivateEventQuote";

const base: PrivateEventPreferences = {
  experience: "puppy_yoga",
  schedule: "single",
  venue: "studio",
  packagePreference: "classic",
  durationMinutes: 60,
  scheduleNotes: "",
  venueDetails: "",
};
const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function render(changes: Partial<PrivateEventPreferences> = {}, guests = 20, packageType: PrivateEventPackageType = "classic") {
  return renderToStaticMarkup(createElement(PrivateEventBudgetPanel, {
    guests,
    packageType,
    eventPreferences: { ...base, ...changes },
  }));
}

function text(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
}

function liveMessage(html: string) {
  return html.match(/<p[^>]*role="status"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
}

describe("private event planning budget panel", () => {
  it("is visible in the initial form without event type, city or contact details", () => {
    const html = renderToStaticMarkup(createElement(PrivateEventQuote));
    expect(html.match(/id="private-event-budget-title"/g)).toHaveLength(1);
    expect(html).toContain('data-budget-kind="incomplete"');
    expect(html).toContain("Enter total expected attendance");
    expect(html.indexOf('id="private-event-budget-title"')).toBeLessThan(html.indexOf("Your Contact Info"));
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it.each(["classic", "signature", "luxury"] as const)("uses the shared %s package budget and exact tax cents for standard studio yoga", packageType => {
    const preferences = { ...base, packagePreference: packageType };
    const budget = estimatePrivateEventBudget({ guests: 20, packageType, eventPreferences: preferences });
    const html = render({ packagePreference: packageType }, 20, packageType);
    const content = text(html);
    expect(html).toContain('data-budget-kind="estimate"');
    expect(content).toContain(privateEventBudgetRange(budget.min!, budget.max!));
    for (const line of budget.lines) {
      expect(content).toContain(line.label);
      expect(content).toContain(privateEventBudgetRange(line.min, line.max));
    }
    for (const cents of [budget.hstMinCents, budget.hstMaxCents, budget.totalMinCents, budget.totalMaxCents]) {
      expect(content).toContain(currency.format(cents! / 100));
    }
    expect(content).toContain("CAD before HST");
    expect(content).toContain("HST (13%)");
    expect(content).toContain("Subtotal incl. HST");
    expect(content).toContain("Travel and any separately quoted extras are excluded from this subtotal");
    expect(content).not.toContain("Your selected Signature upgrades are excluded");
    expect(content).not.toContain("Your selected Luxury upgrades are excluded");
  });

  it.each(["signature", "luxury"] as const)("identifies custom %s as core-only, not an included premium bundle", packageType => {
    const html = render({ experience: "puppy_lounge", packagePreference: packageType }, 20, packageType);
    const content = text(html);
    expect(content).toContain("Core experience estimate");
    expect(content).toContain(`Your selected ${packageType === "signature" ? "Signature" : "Luxury"} upgrades are excluded`);
    expect(content).toContain("Not included in this budget");
    expect(content).toContain("Photography, branding, catering");
    expect(liveMessage(html)).toContain("Package upgrades excluded");
  });

  it("does not pretend a Classic package is selected when help choosing is requested", () => {
    const content = text(render({ packagePreference: "help_me_choose" }));
    expect(content).toContain("Core experience estimate");
    expect(content).toContain("not a Classic package selection");
    expect(content).toContain("Preferred package level: Help me choose");
    expect(content).not.toContain("Preferred package level: Classic");
  });

  it("shows session count, full duration and both attendance measures for multiple sessions", () => {
    const content = text(render({ schedule: "multiple", durationMinutes: 150, sessionCount: 2, guestsPerSession: 20 }, 40));
    expect(content).toContain("Multiple sessions for separate groups");
    expect(content).toContain("Full event window 150 minutes");
    expect(content).toContain("Scheduled sessions 2");
    expect(content).toContain("Guests per session 20");
    expect(content).toContain("Total attendance 40 guests");
    expect(content).toContain("room resets and puppy rest");
  });

  it("shows lounge operating time, simultaneous attendance, venue and travel exclusion", () => {
    const content = text(render({ experience: "puppy_lounge", schedule: "drop_in", venue: "client_venue", durationMinutes: 180, concurrentGuests: 20 }, 60));
    expect(content).toContain("Puppy Play & Wellness Lounge");
    expect(content).toContain("Drop-in or short rotations");
    expect(content).toContain("At your venue");
    expect(content).toContain("Lounge operating time 180 minutes");
    expect(content).toContain("Guests at once 20");
    expect(content).toContain("Total attendance 60 guests");
    expect(content).toContain("off-site delivery/travel fee");
    expect(content).toContain("No guided yoga is included");
  });

  it.each([
    { changes: {}, guests: 0 },
    { changes: { durationMinutes: 0 }, guests: 20 },
    { changes: { schedule: "multiple", sessionCount: 0, guestsPerSession: 0, durationMinutes: 150 }, guests: 40 },
  ] as Array<{ changes: Partial<PrivateEventPreferences>; guests: number }>)("explains incomplete inputs without a zero-price estimate (%j)", ({ changes, guests }) => {
    const html = render(changes, guests);
    expect(html).toContain('data-budget-kind="incomplete"');
    expect(text(html)).toContain("Complete your event details");
    expect(html).not.toContain("$");
    expect(liveMessage(html)).toContain("Complete your event details");
  });

  it.each([
    { changes: {}, guests: 21, reason: "More than 20 guests" },
    { changes: { schedule: "drop_in", durationMinutes: 120, concurrentGuests: 10 }, guests: 20, reason: "Short guided-yoga rotations" },
  ] as Array<{ changes: Partial<PrivateEventPreferences>; guests: number; reason: string }>)("explains manual review without inventing a price (%j)", ({ changes, guests, reason }) => {
    const html = render(changes, guests);
    expect(html).toContain('data-budget-kind="manual"');
    expect(text(html)).toContain("Review needed");
    expect(text(html)).toContain(reason);
    expect(html).not.toContain("$");
    expect(liveMessage(html)).toContain(reason);
  });

  it("uses one concise polite atomic announcement and hides its decorative icon", () => {
    const html = render({ schedule: "multiple", durationMinutes: 150, sessionCount: 2, guestsPerSession: 20 }, 40);
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toMatch(/<p[^>]*role="status"[^>]*aria-atomic="true"[^>]*class="sr-only"/);
    expect(html).not.toMatch(/<section[^>]*aria-live/);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*focusable="false"/);
    expect(liveMessage(html)).not.toContain("Your event at a glance");
    expect(liveMessage(html)).not.toContain("Guests per session");
    expect(liveMessage(html).length).toBeLessThan(300);
    expect(text(html)).toContain("APY must review and approve your final scope and quote");
    expect(text(html)).toContain("not a booking or payable total");
  });

  it("keeps the original estimator, zero sentinel and submit guards out of the planning panel", () => {
    const source = readFileSync(new URL("../client/src/pages/PrivateEventQuote.tsx", import.meta.url), "utf8");
    expect(source).toContain("const quote = quoteReady");
    expect(source).toContain("estimatePrivateEventPackage({ guests: guestCount, packageType, eventPreferences })");
    expect(source).toContain("if (!quoteReady || !parsedPreferences.success || attendanceError)");
    expect(source).toContain("!preferencesReady ||");
    expect(source).toContain("estimatedMin: quote?.requiresCustomQuote ? 0 : quote?.min ?? 0");
    expect(source).toContain("estimatedMax: quote?.requiresCustomQuote ? 0 : quote?.max ?? 0");
    expect(source).toContain("eventPreferences: parsedPreferences.data");
    expect(source).not.toContain("estimatedMin: budget");
    expect(source.indexOf("<PrivateEventBudgetPanel")).toBeGreaterThan(source.indexOf("<EventPreferencesFields"));
    expect(source.indexOf("Full Name *")).toBeLessThan(source.indexOf("Email Address *"));
    expect(source.indexOf("Email Address *")).toBeLessThan(source.indexOf("Phone Number *"));
    expect(source.match(/Preferred Date/g)).toHaveLength(2);
  });
});
