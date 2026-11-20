import { describe, expect, it } from "vitest";
import { estimatePrivateEventBudget, formatPrivateEventBudgetSummary, type PrivateEventBudget } from "../shared/privateEventBudget";
import { estimatePrivateEventPackage } from "../shared/privateEventPricing";
import type { PrivateEventPreferences } from "../shared/privateEventExperience";

const standard: PrivateEventPreferences = { experience: "puppy_yoga", schedule: "single", venue: "studio", packagePreference: "classic", durationMinutes: 60, scheduleNotes: "", venueDetails: "" };
const budget = (p: Partial<PrivateEventPreferences> = {}, guests = 20) => estimatePrivateEventBudget({ guests, packageType: p.packagePreference === "signature" ? "signature" : p.packagePreference === "luxury" ? "luxury" : "classic", eventPreferences: { ...standard, ...p } });
const assertRange = (result: PrivateEventBudget, min: number, max: number) => {
  expect(result).toMatchObject({ kind: "estimate", min, max, hstMinCents: min * 13, hstMaxCents: max * 13, totalMinCents: min * 113, totalMaxCents: max * 113 });
};

describe("owner-approved planning-only event budgets", () => {
  it.each([["classic", 1500, 1750], ["signature", 2000, 2250], ["luxury", 2500, 3500]] as const)("preserves standard %s studio range", (packagePreference, min, max) => {
    const result = budget({ packagePreference });
    assertRange(result, min, max);
    expect(result.coreOnly).toBe(false);
  });
  it.each([1, 5, 6, 8, 20])("does not assume per-person revenue or discount for %s attendees", guests => assertRange(budget({}, guests), 1500, 1750));
  it("prices a lounge without yoga", () => {
    const result = budget({ experience: "puppy_lounge" });
    assertRange(result, 1250, 1500);
    expect(result.lines[0].label).toContain("no guided yoga");
  });
  it.each([90, 120, 150, 180])("prices only supervised extensions for a %s-minute yoga event", durationMinutes => {
    const extra = (durationMinutes - 60) / 30;
    const result = budget({ durationMinutes });
    assertRange(result, 1500 + extra * 250, 1750 + extra * 375);
    expect(result.notes.join(" ")).toContain("not additional guided yoga");
  });
  it("prices an additional lounge session instead of multiplying its studio band", () => assertRange(budget({ experience: "puppy_lounge", schedule: "multiple", sessionCount: 2, guestsPerSession: 20, durationMinutes: 150 }, 40), 2000, 2500));
  it("prices the approved 40-guest two-yoga-session example", () => assertRange(budget({ schedule: "multiple", sessionCount: 2, guestsPerSession: 20, durationMinutes: 150 }, 40), 2500, 3000));
  it("prices three yoga sessions", () => assertRange(budget({ schedule: "multiple", sessionCount: 3, guestsPerSession: 20, durationMinutes: 210 }, 60), 3500, 4250));
  it.each([[120, 2000, 2500], [180, 2500, 3250]] as const)("prices a %s-minute lounge operating window", (durationMinutes, min, max) => assertRange(budget({ experience: "puppy_lounge", schedule: "drop_in", concurrentGuests: 20, durationMinutes }, 60), min, max));
  it("does not invent off-site travel and keeps location-independent core budget", () => {
    const result = budget({ venue: "client_venue" });
    assertRange(result, 1500, 1750);
    expect(result.exclusions.join(" ")).toContain("small off-site delivery/travel fee");
    expect(result.lines).toHaveLength(1);
  });
  it.each(["signature", "luxury"] as const)("does not imply %s premium services are included in core lounge or multiple budgets", packagePreference => {
    const result = budget({ packagePreference, experience: "puppy_lounge" });
    assertRange(result, 1250, 1500);
    expect(result.coreOnly).toBe(true);
    expect(result.exclusions.join(" ")).toContain("upgrades are not priced or included");
  });
  it("does not pretend Classic was selected for Help me choose", () => {
    const result = budget({ packagePreference: "help_me_choose" });
    assertRange(result, 1500, 1750);
    expect(result.lines[0].label).not.toContain("Classic");
    expect(result.exclusions.join(" ")).toContain("No Classic, Signature or Luxury package has been selected");
  });
  it.each([
    ["over 20 single guests", {}, 21],
    ["short single yoga", { durationMinutes: 45 }, 20],
    ["fractional extension", { durationMinutes: 75 }, 20],
    ["long single event", { durationMinutes: 210 }, 20],
    ["insufficient reset window", { schedule: "multiple", sessionCount: 2, guestsPerSession: 20, durationMinutes: 120 }, 40],
    ["unpriced long standby", { schedule: "multiple", sessionCount: 2, guestsPerSession: 20, durationMinutes: 240 }, 40],
    ["over three sessions", { schedule: "multiple", sessionCount: 4, guestsPerSession: 20, durationMinutes: 270 }, 80],
    ["large session groups", { schedule: "multiple", sessionCount: 2, guestsPerSession: 30, durationMinutes: 150 }, 60],
    ["yoga rotations", { schedule: "drop_in", concurrentGuests: 20, durationMinutes: 120 }, 60],
    ["large drop-in total", { experience: "puppy_lounge", schedule: "drop_in", concurrentGuests: 20, durationMinutes: 120 }, 61],
    ["large concurrent groups", { experience: "puppy_lounge", schedule: "drop_in", concurrentGuests: 21, durationMinutes: 120 }, 60],
    ["short drop-in window", { experience: "puppy_lounge", schedule: "drop_in", concurrentGuests: 20, durationMinutes: 60 }, 60],
    ["long drop-in window", { experience: "puppy_lounge", schedule: "drop_in", concurrentGuests: 20, durationMinutes: 240 }, 60],
  ] as Array<[string, Partial<PrivateEventPreferences>, number]>)("needs review without a numeric promise for %s", (_label, p, guests) => {
    expect(budget(p, guests)).toMatchObject({ kind: "manual", min: null, max: null, totalMinCents: null });
  });
  it.each([0, -1, 20.5, NaN, Infinity, 2001])("has no stale range with invalid attendance %s", guests => expect(budget({}, guests)).toMatchObject({ kind: "incomplete", min: null, max: null }));
  it.each([
    { durationMinutes: 0 },
    { schedule: "multiple", sessionCount: 2 },
    { schedule: "multiple", sessionCount: 2, guestsPerSession: 5, durationMinutes: 150 },
    { schedule: "drop_in", concurrentGuests: 21, durationMinutes: 120 },
  ] as Array<Partial<PrivateEventPreferences>>)("does not estimate incomplete/invalid scope %j", p => expect(budget(p)).toMatchObject({ kind: "incomplete", min: null }));
  it("server summary preserves all exclusions and tax without a payable promise", () => {
    const summary = formatPrivateEventBudgetSummary(budget({ experience: "puppy_lounge", schedule: "drop_in", concurrentGuests: 20, durationMinutes: 180, venue: "client_venue" }, 60));
    expect(summary).toContain("$2,500–$3,250 CAD before HST");
    expect(summary).toContain("$2,825–$3,672.50 CAD");
    expect(summary).toContain("not a final quote");
    expect(summary).toContain("delivery/travel fee");
  });
  it("never changes custom 0/0 eligibility or saved package estimator values", () => {
    const preferences = { ...standard, venue: "client_venue" as const };
    assertRange(budget(preferences), 1500, 1750);
    expect(estimatePrivateEventPackage({ guests: 20, packageType: "classic", eventPreferences: preferences })).toMatchObject({ requiresCustomQuote: true, min: null, max: null });
    expect(estimatePrivateEventPackage({ guests: 20, packageType: "classic" })).toMatchObject({ requiresCustomQuote: false, min: 1500, max: 1750 });
  });
});
