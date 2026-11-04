import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { privateEventPreferencesSchema, validatePrivateEventAttendance, formatPrivateEventPreferences, storePrivateEventScope, readStoredPrivateEventScope, PRIVATE_EVENT_FORMAT_PRICE_NOTE, type PrivateEventPreferences } from "@shared/privateEventExperience";
import { estimatePrivateEventPackage, PRIVATE_EVENT_PACKAGE_BANDS } from "@shared/privateEventPricing";
import { ExperienceCards, EventPreferencesFields, DEFAULT_EVENT_PREFERENCES } from "../client/src/components/PrivateEventExperience";
import { buildPrivateEventQuoteDraft } from "./privateEventQuote";
import { buildEventDescription } from "./routers/privateEvents";

const preferences: PrivateEventPreferences = { experience: "puppy_yoga", schedule: "single", venue: "studio", packagePreference: "classic", durationMinutes: 60, scheduleNotes: "", venueDetails: "" };
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("private event experience and format pricing", () => {
  it.each(["classic", "signature", "luxury"] as const)("keeps the approved %s band for standard studio yoga", packageType => {
    expect(estimatePrivateEventPackage({ guests: 20, packageType, eventPreferences: { ...preferences, packagePreference: packageType } })).toMatchObject({ min: PRIVATE_EVENT_PACKAGE_BANDS[packageType].min, max: PRIVATE_EVENT_PACKAGE_BANDS[packageType].max, requiresCustomQuote: false });
  });
  it.each([
    { experience: "puppy_lounge" }, { schedule: "multiple", sessionCount: 2, guestsPerSession: 10, durationMinutes: 180 },
    { schedule: "drop_in", concurrentGuests: 5, durationMinutes: 180 }, { venue: "client_venue" },
    { durationMinutes: 90 }, { packagePreference: "help_me_choose" },
  ])("requires custom pricing for a nonstandard scope %j without calculating session fees", change => {
    const scope = { ...preferences, ...change } as PrivateEventPreferences;
    for (const packageType of ["classic", "signature", "luxury"] as const) {
      const estimate = estimatePrivateEventPackage({ guests: 10, packageType, eventPreferences: scope });
      expect(estimate.requiresCustomQuote).toBe(true);
      expect(estimate).not.toHaveProperty("sessions");
    }
  });
  it("preserves the previous estimate contract when old clients omit preferences", () => {
    expect(estimatePrivateEventPackage({ guests: 20, packageType: "classic" }).requiresCustomQuote).toBe(false);
    expect(estimatePrivateEventPackage({ guests: 21, packageType: "classic" }).requiresCustomQuote).toBe(true);
  });
  it("requires format-specific fields and whole-number limits", () => {
    expect(privateEventPreferencesSchema.safeParse({ ...preferences, schedule: "multiple" }).success).toBe(false);
    expect(privateEventPreferencesSchema.safeParse({ ...preferences, schedule: "drop_in" }).success).toBe(false);
    expect(privateEventPreferencesSchema.safeParse({ ...preferences, durationMinutes: 60.5 }).success).toBe(false);
    expect(privateEventPreferencesSchema.safeParse({ ...preferences, durationMinutes: 0 }).success).toBe(false);
    expect(privateEventPreferencesSchema.safeParse({ ...preferences, schedule: "multiple", sessionCount: 2, guestsPerSession: 20 }).success).toBe(true);
  });
  it("checks total attendance against session and simultaneous capacity", () => {
    const multi = { ...preferences, schedule: "multiple", sessionCount: 2, guestsPerSession: 20 } as PrivateEventPreferences;
    expect(validatePrivateEventAttendance(multi, 40)).toBeNull();
    expect(validatePrivateEventAttendance(multi, 50)).toContain("space");
    expect(validatePrivateEventAttendance(multi, 10)).toContain("exceed");
    expect(validatePrivateEventAttendance({ ...preferences, schedule: "drop_in", concurrentGuests: 30 }, 20)).toContain("exceed");
  });
  it("persists a readable complete scope rather than merging experience into a package name", () => {
    const summary = formatPrivateEventPreferences({ ...preferences, experience: "puppy_lounge", schedule: "drop_in", venue: "client_venue", packagePreference: "help_me_choose", durationMinutes: 180, concurrentGuests: 10, scheduleNotes: "Noon to 3 pm", venueDetails: "Client campus" });
    for (const text of ["Puppy Play & Wellness Lounge", "Drop-in or short rotations", "At your venue", "Help me choose", "180 minutes", "participating at once: 10", "Noon to 3 pm", "Client campus", "puppy rest"]) expect(summary).toContain(text);
    expect(summary).not.toContain("$0");
  });
  it("recognizes only explicitly versioned new scope notes, not similar legacy free text", () => {
    const summary = formatPrivateEventPreferences(preferences);
    expect(readStoredPrivateEventScope(summary)).toBeUndefined();
    expect(readStoredPrivateEventScope(null)).toBeUndefined();
    expect(readStoredPrivateEventScope(storePrivateEventScope(summary, "Client request"))).toBe(summary + "\n\nClient notes: Client request");
    expect(readStoredPrivateEventScope("APY EVENT PREFERENCES v1\nExperience: Puppy lounge\nLocation: Client office")).toContain("Puppy lounge");
    expect(readStoredPrivateEventScope("APY EVENT PREFERENCES v1\n ")).toBeUndefined();
  });
});

describe("experience selector and conditional form controls", () => {
  it("shows two real-photo choices with a same-page quote action", () => {
    const html = renderToStaticMarkup(createElement(ExperienceCards, { selected: "puppy_yoga", onChoose: vi.fn() }));
    expect(html.match(/<article\b/g)).toHaveLength(2);
    expect(html.match(/href="#quote-form"/g)).toHaveLength(2);
    expect(html).toContain("files.manuscdn.com");
    expect(html).toContain("approximately 40 minutes");
    expect(html).toContain("without a guided yoga class");
    expect(html).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
  });
  it("shows only the capacity fields relevant to the selected format", () => {
    const render = (schedule: "single" | "multiple" | "drop_in") => renderToStaticMarkup(createElement(EventPreferencesFields, { value: { ...DEFAULT_EVENT_PREFERENCES, schedule }, onChange: vi.fn() }));
    const single = render("single");
    expect(single).not.toContain('id="event-session-count"');
    expect(single).not.toContain('id="event-concurrent-guests"');
    const multiple = render("multiple");
    expect(multiple).toContain('id="event-session-count"');
    expect(multiple).toContain('id="event-guests-per-session"');
    expect(multiple).not.toContain('id="event-concurrent-guests"');
    const drop = render("drop_in");
    expect(drop).toContain('id="event-concurrent-guests"');
    expect(drop).toContain("Lounge operating time");
    expect(drop).not.toContain('id="event-session-count"');
  });
  it("uses exact validated preferences in client requests and explicit full-event price basis in staff entry", () => {
    const quote = read("client/src/pages/PrivateEventQuote.tsx");
    expect(quote).toContain("eventPreferences: parsedPreferences.data");
    expect(quote).toContain("!preferencesReady");
    expect(quote).toContain("validatePrivateEventAttendance");
    expect(quote).toContain("<ExperienceCards");
    expect(quote).not.toContain("scrollIntoView");
    const admin = read("client/src/pages/PrivateEventsDashboard.tsx");
    expect(admin).toContain("priceBasis: bookingForm.priceBasis");
    expect(admin).toContain('bookingForm.priceBasis === "event_total" ? 1 : sessionCount');
    expect(admin).toContain("Session count controls the schedule only");
    expect(admin).toContain("One combined event price");
    expect(admin).toContain('setBookingForm({ ...bookingForm, finalPrice: "", priceBasis: e.target.value');
    expect(quote).toContain("guestCount >= 1");
  });
});

describe("new scoped quote output and preserved legacy template", () => {
  const input = { customerName: "Test Customer", eventType: "Campus Social", guests: 80, packageType: "classic", eventDate: "2026-12-12", startTime: "12:00", sessionSchedule: [{ startTime: "12:00", endTime: "15:00" }], venue: "Client campus", basePriceCents: 300000, hstCents: 39000, pricingType: "plus_hst" as const, eventUrl: "https://example.com/private" };
  it("new lounge quotes reflect format, capacity and full price without automatic yoga promises", () => {
    const notes = formatPrivateEventPreferences({ ...preferences, experience: "puppy_lounge", schedule: "drop_in", venue: "client_venue", durationMinutes: 180, concurrentGuests: 10 });
    const quote = buildPrivateEventQuoteDraft({ ...input, eventScopeNotes: notes });
    expect(quote.body).toContain(notes);
    expect(quote.body).toContain("$3,000.00");
    expect(quote.body).toContain("$390.00");
    expect(quote.body).toContain("$3,390.00");
    expect(quote.body).toContain("not a price to multiply");
    expect(quote.body).not.toContain("Beginner-friendly guided yoga instruction");
    expect(quote.body).not.toContain("Yoga mats for participants");
    expect(quote.body).not.toContain("one-hour puppy yoga experience");
  });
  it("legacy no-preferences drafts retain their existing wording", () => {
    const quote = buildPrivateEventQuoteDraft(input);
    expect(quote.body).toContain("Beginner-friendly guided yoga instruction");
    expect(quote.body).toContain("Yoga mats for participants");
    expect(quote.body).not.toContain("Event scope for review");
  });
  it("new private booking descriptions use the requested format and omit separate private client notes", () => {
    const scope = formatPrivateEventPreferences({ ...preferences, experience: "puppy_lounge", schedule: "drop_in", durationMinutes: 180, concurrentGuests: 10 });
    const params = { eventType: "Campus Social", orgName: "Client campus", guests: 80, sessions: 1, breed: "Puppies" };
    const description = buildEventDescription({ ...params, eventScopeNotes: scope + "\n\nClient notes: PRIVATE CLIENT NOTE" });
    expect(description).toContain("Puppy Play & Wellness Lounge");
    expect(description).toContain("participating at once: 10");
    expect(description).not.toContain("PRIVATE CLIENT NOTE");
    expect(description).not.toContain("beginner-friendly yoga flow");
    expect(buildEventDescription(params)).toContain("beginner-friendly yoga flow");
  });
});
