import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  communicationsLog,
  privateEventActions,
  privateEventClasses,
  privateEventInquiries,
  type InsertPrivateEventInquiry,
  type PrivateEventInquiry,
} from "../drizzle/schema";
import {
  formatPrivateEventPreferences,
  storePrivateEventScope,
  PRIVATE_EVENT_FORMAT_PRICE_NOTE,
  type PrivateEventPreferences,
} from "../shared/privateEventExperience";
import type { TrpcContext } from "./_core/context";
import type { EmailOptions } from "./email";
import { privateEventsRouter } from "./routers/privateEvents";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendEmail: vi.fn(),
  notifyOwner: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

const baseInput = {
  name: "Jordan Example",
  email: "jordan@example.com",
  phone: "(289) 788-1885",
  eventType: "Team Social",
  guests: 12,
  location: "Kitchener",
  packageType: "classic" as const,
  preferredDate: "2026-12-12",
  notes: "Please confirm availability.",
};
const standardPreferences: PrivateEventPreferences = {
  experience: "puppy_yoga",
  schedule: "single",
  venue: "studio",
  packagePreference: "classic",
  durationMinutes: 60,
  scheduleNotes: "",
  venueDetails: "",
};
const bands = [
  ["classic", "Classic Experience", 1500, 1750, "$1,500-$1,750 + HST CAD"],
  ["signature", "Signature Experience", 2000, 2250, "$2,000-$2,250 + HST CAD"],
  ["luxury", "Luxury Experience", 2500, 3500, "$2,500-$3,500 + HST CAD"],
] as const;

function context(owner = false): TrpcContext {
  return {
    user: owner ? {
      id: 1, openId: "mock-owner", name: "Mock Owner", email: "owner@example.com",
      role: "admin", loginMethod: "manus", createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"), lastSignedIn: new Date("2026-01-01"),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createMockDb() {
  const writes: Array<{ table: unknown; row: Record<string, unknown> }> = [];
  return {
    writes,
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        writes.push({ table, row });
        return [{ insertId: 81 }];
      }),
    })),
  };
}

let db: ReturnType<typeof createMockDb>;
let network: ReturnType<typeof vi.fn>;
function storedInquiry() {
  const write = db.writes.find(entry => entry.table === privateEventInquiries);
  expect(write).toBeDefined();
  return write!.row as InsertPrivateEventInquiry;
}
function storedAction() {
  const write = db.writes.find(entry => entry.table === privateEventActions);
  expect(write).toBeDefined();
  return write!.row;
}
function emails(): EmailOptions[] {
  expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  const result = mocks.sendEmail.mock.calls.map(([email]) => email as EmailOptions);
  expect(result.map(email => email.to)).toEqual(["afropuppyyoga@gmail.com", baseInput.email]);
  return result;
}
function ownerContent(): string {
  expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
  return mocks.notifyOwner.mock.calls[0][0].content;
}
function expectNoSideEffects() {
  expect(mocks.getDb).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
  expect(mocks.sendEmail).not.toHaveBeenCalled();
  expect(mocks.notifyOwner).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  db = createMockDb();
  mocks.getDb.mockResolvedValue(db);
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.notifyOwner.mockResolvedValue(true);
  network = vi.fn(() => { throw new Error("External network access forbidden in inquiry tests"); });
  vi.stubGlobal("fetch", network);
});
afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  expect(db.select).not.toHaveBeenCalled();
  expect(db.update).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalledWith(privateEventClasses);
  vi.unstubAllGlobals();
});

describe("experience-aware inquiries: authoritative estimates", () => {
  it.each(bands)("keeps the approved %s band for single 60-minute studio puppy yoga", async (packageType, name, min, max, label) => {
    for (const guests of [1, 20]) {
      vi.clearAllMocks();
      db = createMockDb();
      mocks.getDb.mockResolvedValue(db);
      const eventPreferences = { ...standardPreferences, packagePreference: packageType };
      await expect(privateEventsRouter.createCaller(context()).submitInquiry({
        ...baseInput, guests, packageType, eventPreferences, estimatedMin: -9000, estimatedMax: 999999,
      })).resolves.toEqual({ success: true });
      expect(storedInquiry()).toMatchObject({ guests, packageType, estimatedMin: min, estimatedMax: max });
      for (const email of emails()) {
        for (const body of [email.html, email.text!]) {
          expect(body).toContain(`${name} (${label})`);
          expect(body).toContain("Preferred experience: Private Puppy Yoga");
          expect(body).toContain("Total event duration: 60 minutes");
          expect(body).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
          expect(body).not.toContain("999999");
          expect(body).not.toContain("Custom quote required");
        }
      }
      expect(ownerContent()).toContain(label);
      expect(storedAction().details).toBe(JSON.stringify({ estimatedMin: min, estimatedMax: max, packageType, eventPreferences }));
    }
  });

  const customCases: Array<[string, Partial<PrivateEventPreferences>, number]> = [
    ["small lounge", { experience: "puppy_lounge" }, 12],
    ["small multiple-session yoga", { schedule: "multiple", sessionCount: 2, guestsPerSession: 6 }, 12],
    ["small drop-in yoga", { schedule: "drop_in", concurrentGuests: 6 }, 12],
    ["off-site yoga", { venue: "client_venue", venueDetails: "Our office" }, 12],
    ["shorter yoga", { durationMinutes: 45 }, 12],
    ["longer yoga", { durationMinutes: 90 }, 12],
    ["help me choose", { packagePreference: "help_me_choose" }, 12],
    ["larger standard-format yoga", {}, 21],
    ["multiple-session lounge", { experience: "puppy_lounge", schedule: "multiple", sessionCount: 2, guestsPerSession: 6 }, 12],
    ["off-site drop-in lounge", { experience: "puppy_lounge", schedule: "drop_in", concurrentGuests: 6, venue: "client_venue", durationMinutes: 180 }, 12],
  ];
  it.each(customCases)("stores 0/0 and advertises no numeric package band for %s", async (_description, preferences, guests) => {
    const eventPreferences = { ...standardPreferences, ...preferences };
    await privateEventsRouter.createCaller(context()).submitInquiry({
      ...baseInput, guests, eventPreferences, estimatedMin: 1, estimatedMax: 999999,
    });
    expect(storedInquiry()).toMatchObject({ guests, packageType: "classic", estimatedMin: 0, estimatedMax: 0 });
    expect(storedInquiry()).not.toHaveProperty("sessions");
    expect(storedInquiry()).not.toHaveProperty("finalPriceCents");
    for (const email of emails()) {
      for (const body of [email.html, email.text!]) {
        expect(body).toContain("Custom quote required");
        expect(body).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
        expect(body).not.toMatch(/\$|999999|reference band only|free event/i);
        expect(body).toContain(eventPreferences.packagePreference === "help_me_choose" ? "Help me choose" : "Classic Experience");
        if (eventPreferences.packagePreference === "help_me_choose") expect(body).not.toContain("Classic");
      }
    }
    expect(mocks.sendEmail.mock.calls[1][0].subject).toContain("Custom quote required");
    expect(mocks.sendEmail.mock.calls[1][0].subject).not.toContain("$");
    expect(ownerContent()).toContain("Custom quote required");
    expect(ownerContent()).not.toContain("$");
    expect(JSON.parse(storedAction().details as string)).toEqual({ estimatedMin: 0, estimatedMax: 0, packageType: "classic", eventPreferences });
    expect(db.writes.find(entry => entry.table === communicationsLog)!.row.bodyPreview).toContain("Custom quote required");
  });

  it.each(bands)("preserves the selected %s preference without a misleading band for lounge", async (packageType, name) => {
    await privateEventsRouter.createCaller(context()).submitInquiry({
      ...baseInput, packageType, eventPreferences: { ...standardPreferences, experience: "puppy_lounge", packagePreference: packageType },
    });
    for (const email of emails()) {
      for (const body of [email.html, email.text!]) {
        expect(body).toContain(name);
        expect(body).not.toContain("$");
        if (packageType !== "classic") expect(body).not.toContain("Classic Experience");
      }
    }
  });
});

describe("experience-aware inquiries: durable details and safe email delivery", () => {
  it.each(["multiple", "drop_in"] as const)("retains every %s preference, safely renders HTML and preserves readable plaintext", async schedule => {
    const scheduleNotes = '<img src=x onerror="alert(1)"> & \'late\' rotations';
    const venueDetails = '<script>alert("venue")</script> & reception';
    const notes = '<b onclick="alert(2)">Client notes</b> & snacks';
    const name = '<img src=x onerror="alert(3)"> Jordan';
    const eventType = '<script>alert("event")</script>';
    const location = '<b>Office & lobby</b>';
    const preferredDate = '<img src=x onerror="alert(4)">';
    const eventPreferences: PrivateEventPreferences = {
      ...standardPreferences, experience: "puppy_lounge", schedule, venue: "client_venue", packagePreference: "signature",
      durationMinutes: 180, scheduleNotes, venueDetails,
      ...(schedule === "multiple" ? { sessionCount: 3, guestsPerSession: 8 } : { concurrentGuests: 8 }),
    };
    const summary = formatPrivateEventPreferences(eventPreferences);
    await privateEventsRouter.createCaller(context()).submitInquiry({
      ...baseInput, name, eventType, location, preferredDate, guests: 24, packageType: "signature", notes, eventPreferences,
    });
    expect(storedInquiry()).toMatchObject({
      name, eventType, location, preferredDate, phone: "+12897881885", notes: storePrivateEventScope(summary, notes),
      estimatedMin: 0, estimatedMax: 0,
    });
    expect(JSON.parse(storedAction().details as string)).toEqual({
      estimatedMin: 0, estimatedMax: 0, packageType: "signature", eventPreferences,
    });
    const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    for (const email of emails()) {
      expect(email.html).toContain(escaped(summary));
      expect(email.text).toContain(summary);
      expect(email.html).toContain("white-space:pre-wrap");
      for (const raw of [scheduleNotes, venueDetails, notes, name, eventType, location, preferredDate]) {
        expect(email.html).not.toContain(raw);
        expect(email.html).toContain(escaped(raw));
        expect(email.text).toContain(raw);
      }
      expect(email.html).not.toMatch(/<script|<img/i);
      expect(email.html).not.toContain("private puppy yoga event!");
      expect(email.text).not.toContain("private puppy yoga event!");
    }
    expect(ownerContent()).toContain(summary);
    expect(ownerContent()).toContain(notes);
    expect(db.insert.mock.calls.map(([table]) => table)).toEqual([privateEventInquiries, privateEventActions, communicationsLog]);
  });

  it("stores readable preferences even when there are no client notes and persists schema defaults", async () => {
    const { scheduleNotes: _scheduleNotes, venueDetails: _venueDetails, ...eventPreferences } = standardPreferences;
    await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, notes: "", eventPreferences });
    expect(storedInquiry().notes).toBe(storePrivateEventScope(formatPrivateEventPreferences(standardPreferences)));
    expect(JSON.parse(storedAction().details as string).eventPreferences).toEqual(standardPreferences);
  });

  it("preserves legacy notes and exact legacy audit bytes when preferences are omitted", async () => {
    await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, location: "Other client venue" });
    expect(storedInquiry()).toMatchObject({ notes: baseInput.notes, estimatedMin: 1500, estimatedMax: 1750 });
    expect(storedAction().details).toBe('{"estimatedMin":1500,"estimatedMax":1750,"packageType":"classic"}');
    expect(storedAction().details).not.toContain("eventPreferences");
  });

  it("preserves the legacy larger-group reference label only for inquiries without preferences", async () => {
    await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, guests: 21 });
    expect(storedInquiry()).toMatchObject({ estimatedMin: 0, estimatedMax: 0 });
    for (const email of emails()) {
      expect(email.html).toContain("Classic Experience ($1,500-$1,750 + HST CAD; selected reference band only)");
      expect(email.text).toContain("Classic Experience ($1,500-$1,750 + HST CAD; selected reference band only)");
    }
    expect(storedAction().details).toBe('{"estimatedMin":0,"estimatedMax":0,"packageType":"classic"}');
  });
});

describe("experience-aware inquiries: reject before database or providers", () => {
  const invalidCases: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ["missing session count", { schedule: "multiple", guestsPerSession: 6 }, {}],
    ["missing guests per session", { schedule: "multiple", sessionCount: 2 }, {}],
    ["missing concurrent attendance", { schedule: "drop_in" }, {}],
    ["session guests exceed total", { schedule: "multiple", sessionCount: 2, guestsPerSession: 13 }, {}],
    ["insufficient session capacity", { schedule: "multiple", sessionCount: 2, guestsPerSession: 5 }, {}],
    ["concurrent guests exceed total", { schedule: "drop_in", concurrentGuests: 13 }, {}],
    ["mismatched package", { packagePreference: "signature" }, {}],
    ["help me choose with non-classic compatibility package", { packagePreference: "help_me_choose" }, { packageType: "luxury" }],
    ["unknown experience", { experience: "puppy_party" }, {}],
    ["unknown schedule", { schedule: "all_day" }, {}],
    ["unknown venue", { venue: "park" }, {}],
    ["zero duration", { durationMinutes: 0 }, {}],
    ["fractional duration", { durationMinutes: 60.5 }, {}],
    ["duration beyond maximum", { durationMinutes: 1441 }, {}],
    ["only one requested session", { schedule: "multiple", sessionCount: 1, guestsPerSession: 12 }, {}],
    ["fractional session count", { schedule: "multiple", sessionCount: 2.5, guestsPerSession: 6 }, {}],
    ["zero concurrent guests", { schedule: "drop_in", concurrentGuests: 0 }, {}],
    ["overlong schedule notes", { scheduleNotes: "x".repeat(2001) }, {}],
    ["overlong venue details", { venueDetails: "x".repeat(1001) }, {}],
    ["zero total attendance", {}, { guests: 0 }],
    ["fractional total attendance", {}, { guests: 12.5 }],
    ["total attendance beyond maximum", {}, { guests: 2001 }],
    ["invalid phone", {}, { phone: "123" }],
  ];
  it.each(invalidCases)("rejects %s before side effects", async (_description, preferences, changes) => {
    const caller = privateEventsRouter.createCaller(context());
    const input = {
      ...baseInput, ...changes, eventPreferences: { ...standardPreferences, ...preferences },
    } as Parameters<typeof caller.submitInquiry>[0];
    await expect(caller.submitInquiry(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expectNoSideEffects();
  });

  it("accepts bounded maximum attendance with a feasible multiple-group plan", async () => {
    await privateEventsRouter.createCaller(context()).submitInquiry({
      ...baseInput, guests: 2000, eventPreferences: { ...standardPreferences, schedule: "multiple", sessionCount: 100, guestsPerSession: 20 },
    });
    expect(storedInquiry()).toMatchObject({ guests: 2000, estimatedMin: 0, estimatedMax: 0 });
  });
});

function createBookingDb(inquiry: Partial<PrivateEventInquiry>) {
  const writes: Array<{ table: unknown; row: Record<string, unknown> }> = [];
  const saved = { ...inquiry };
  const updateWhere = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
  const updateSet = vi.fn((patch: Record<string, unknown>) => {
    Object.assign(saved, patch);
    return { where: updateWhere };
  });
  return {
    saved, writes, updateSet,
    update: vi.fn(() => ({ set: updateSet })),
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          const rows = table === privateEventInquiries ? [saved] : [];
          return Object.assign(Promise.resolve(rows), { orderBy: vi.fn().mockResolvedValue(rows) });
        }),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        writes.push({ table, row });
        return [{ insertId: 81 }];
      }),
    })),
  };
}
const bookingInput = {
  inquiryId: 81, finalPrice: 1500, pricingType: "plus_hst" as const,
  sessions: 3, eventDate: "2026-12-12", startTime: "09:00", endTime: "10:00",
};
const pendingInquiry: Partial<PrivateEventInquiry> = {
  id: 81, name: baseInput.name, email: baseInput.email, eventType: baseInput.eventType,
  guests: 12, packageType: "classic", location: "Kitchener", estimatedMin: 0, estimatedMax: 0,
};

describe("explicit combined event pricing without changing legacy commercial math", () => {
  it.each([
    { ...standardPreferences, experience: "puppy_lounge" as const },
    { ...standardPreferences, schedule: "multiple" as const, sessionCount: 3, guestsPerSession: 4 },
    { ...standardPreferences, schedule: "drop_in" as const, concurrentGuests: 6 },
    { ...standardPreferences, venue: "client_venue" as const },
    { ...standardPreferences, durationMinutes: 90 },
    { ...standardPreferences, packagePreference: "help_me_choose" as const },
  ])("stores one $1500 combined event price with three real sessions for scope %j", async eventPreferences => {
    const bookingDb = createBookingDb({ ...pendingInquiry, notes: storePrivateEventScope(formatPrivateEventPreferences(eventPreferences)) });
    mocks.getDb.mockResolvedValue(bookingDb);
    const result = await privateEventsRouter.createCaller(context(true)).generateBookingLink({
      ...bookingInput, priceBasis: "event_total",
    });
    expect(result).toMatchObject({
      success: true, totalCents: 169500, hstCents: 19500,
      needsApproval: true, approvalStatus: "pending", eventUrl: null, eventId: null, emailDraft: null,
    });
    expect(bookingDb.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      finalPriceCents: 150000, hstCents: 19500, sessions: 3, pricingType: "plus_hst",
      ownerApproved: false, approvalStatus: "pending", lumaEventId: null, lumaEventUrl: null,
    }));
    expect(bookingDb.writes[0].row).toMatchObject({
      action: "approval_requested",
      details: '{"basePriceCents":150000,"hstCents":19500,"totalCents":169500,"pricingType":"plus_hst","priceBasis":"event_total"}',
    });
    expect(bookingDb.insert).not.toHaveBeenCalledWith(privateEventClasses);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(ownerContent()).toContain("$1695.00 CAD");
  });

  it.each([undefined, "per_session"] as const)("retains legacy $1500 times three when priceBasis is %s", async priceBasis => {
    const bookingDb = createBookingDb({ ...pendingInquiry, estimatedMin: 1500, estimatedMax: 1750 });
    mocks.getDb.mockResolvedValue(bookingDb);
    const result = await privateEventsRouter.createCaller(context(true)).generateBookingLink({ ...bookingInput, priceBasis });
    expect(result).toMatchObject({ totalCents: 508500, hstCents: 58500, needsApproval: true, eventId: null });
    expect(bookingDb.saved).toMatchObject({ finalPriceCents: 450000, hstCents: 58500, sessions: 3 });
    expect(bookingDb.writes[0].row.details).toBe('{"basePriceCents":450000,"hstCents":58500,"totalCents":508500,"pricingType":"plus_hst"}');
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("extracts HST once from an all-in combined event amount", async () => {
    const bookingDb = createBookingDb(pendingInquiry);
    mocks.getDb.mockResolvedValue(bookingDb);
    const result = await privateEventsRouter.createCaller(context(true)).generateBookingLink({
      ...bookingInput, finalPrice: 1695, pricingType: "all_in", priceBasis: "event_total",
    });
    expect(result).toMatchObject({ totalCents: 169500, hstCents: 19500, needsApproval: true });
    expect(bookingDb.saved).toMatchObject({ finalPriceCents: 150000, hstCents: 19500, sessions: 3 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it.each([0, 1.5, 101])("rejects invalid real session count %s before database or publication", async sessions => {
    await expect(privateEventsRouter.createCaller(context(true)).generateBookingLink({
      ...bookingInput, sessions, priceBasis: "event_total",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expectNoSideEffects();
  });

  it.each([1499, 3001])("keeps combined event owner-approval thresholds for $%s", async finalPrice => {
    const bookingDb = createBookingDb({ ...pendingInquiry, estimatedMin: 1500, estimatedMax: 1750 });
    mocks.getDb.mockResolvedValue(bookingDb);
    await expect(privateEventsRouter.createCaller(context(true)).generateBookingLink({
      ...bookingInput, finalPrice, priceBasis: "event_total",
    })).resolves.toMatchObject({ needsApproval: true, eventId: null });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("stored quote scope wiring, preserving legacy quote behavior", () => {
  it.each(["multiple", "drop_in"] as const)("uses all new formatted %s notes in the reviewable combined quote", async schedule => {
    const notes = `${formatPrivateEventPreferences({
      ...standardPreferences, experience: "puppy_lounge", schedule, venue: "client_venue",
      durationMinutes: 180, scheduleNotes: "Groups arrive after lunch", venueDetails: "Client office",
      ...(schedule === "multiple" ? { sessionCount: 3, guestsPerSession: 4 } : { concurrentGuests: 6 }),
    })}\n\nClient notes: Please confirm scope before sending.`;
    const bookingDb = createBookingDb({
      ...pendingInquiry, notes: storePrivateEventScope(notes), ownerApproved: false, approvalStatus: "pending", sessions: 1,
      finalPriceCents: 150000, hstCents: 19500, pricingType: "plus_hst", preferredDate: "2026-12-12",
      eventStartTime: "09:00", eventEndTime: "12:00", eventVenue: "Client office",
      lumaEventId: "mock-existing-booking", lumaEventUrl: "https://example.com/mock-private-booking",
    });
    mocks.getDb.mockResolvedValue(bookingDb);
    const result = await privateEventsRouter.createCaller(context(true)).approveQuote({ inquiryId: 81 });
    expect(result.emailDraft.body).toContain(notes);
    expect(result.emailDraft.body).toContain("Your combined event quote:");
    expect(result.emailDraft.body).toContain("$1,500.00 + HST ($195.00) = $1,695.00");
    expect(result.emailDraft.body).not.toContain("Beginner-friendly guided yoga instruction");
    expect(result.emailDraft.body).not.toContain("A private one-hour puppy yoga experience");
    expect(result.emailDraft.body).not.toContain("Yoga mats for participants");
    expect(bookingDb.saved.quoteEmailBody).toBe(result.emailDraft.body);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it.each([null, "Ordinary legacy user notes", "Preferred experience: legacy text without format fields"])("keeps legacy drafted inclusions without a complete format block: %s", async notes => {
    const bookingDb = createBookingDb({
      ...pendingInquiry, notes, approvalStatus: "pending", sessions: 1,
      finalPriceCents: 150000, hstCents: 19500, pricingType: "plus_hst", preferredDate: "2026-12-12",
      eventStartTime: "09:00", eventEndTime: "10:00", eventVenue: "Kitchener",
      lumaEventId: "mock-existing-booking", lumaEventUrl: "https://example.com/mock-private-booking",
    });
    mocks.getDb.mockResolvedValue(bookingDb);
    const result = await privateEventsRouter.createCaller(context(true)).approveQuote({ inquiryId: 81 });
    expect(result.emailDraft.body).toContain("Beginner-friendly guided yoga instruction");
    expect(result.emailDraft.body).toContain("A private one-hour puppy yoga experience");
    expect(result.emailDraft.body).not.toContain("Event scope for review:");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
