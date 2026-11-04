import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  communicationsLog,
  privateEventActions,
  privateEventClasses,
  privateEventInquiries,
  type InsertPrivateEventInquiry,
  type PrivateEventInquiry,
} from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import type { EmailOptions } from "./email";
import {
  calculateLumaTicketPricing,
  calculatePrivateEventPrice,
  privateEventQuoteNeedsApproval,
  privateEventsRouter,
} from "./routers/privateEvents";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendEmail: vi.fn(),
  notifyOwner: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

const APY_EMAIL = "afropuppyyoga@gmail.com";
const FAKE_INQUIRY_ID = 77;
const baseInput = {
  name: "Taylor Example",
  email: "taylor@example.com",
  phone: "(289) 788-1885",
  eventType: "Birthday Party",
  guests: 20,
  location: "Toronto (Client venue)",
  packageType: "classic" as const,
  preferredDate: "2026-12-12",
  notes: "Please confirm availability.",
};
const bands = [
  ["classic", "Classic Experience", 1500, 1750, "$1,500-$1,750 + HST CAD"],
  ["signature", "Signature Experience", 2000, 2250, "$2,000-$2,250 + HST CAD"],
  ["luxury", "Luxury Experience", 2500, 3500, "$2,500-$3,500 + HST CAD"],
] as const;

function context(owner = false): TrpcContext {
  return {
    user: owner ? {
      id: 1,
      openId: "mock-owner",
      name: "Mock Owner",
      email: "owner@example.com",
      role: "admin",
      loginMethod: "manus",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      lastSignedIn: new Date("2026-01-01"),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createMockDb() {
  const writes: Array<{ table: unknown; row: Record<string, unknown> }> = [];
  let selectedInquiry: Partial<PrivateEventInquiry> | undefined;
  const insert = vi.fn((table: unknown) => ({
    values: vi.fn(async (row: Record<string, unknown>) => {
      writes.push({ table, row });
      return [{ insertId: FAKE_INQUIRY_ID }];
    }),
  }));
  const updateWhere = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const select = vi.fn(() => ({
    from: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        const rows = table === privateEventInquiries && selectedInquiry ? [selectedInquiry] : [];
        return Object.assign(Promise.resolve(rows), {
          orderBy: vi.fn().mockResolvedValue(rows),
        });
      }),
    })),
  }));
  return {
    insert, select, update, updateSet, updateWhere, writes,
    setInquiry: (inquiry: Partial<PrivateEventInquiry>) => { selectedInquiry = inquiry; },
  };
}

let db: ReturnType<typeof createMockDb>;
let network: ReturnType<typeof vi.fn>;

function insertedInquiry(): InsertPrivateEventInquiry {
  const write = db.writes.find(entry => entry.table === privateEventInquiries);
  expect(write).toBeDefined();
  return write!.row as InsertPrivateEventInquiry;
}

function inquiryEmails(): EmailOptions[] {
  expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  const emails = mocks.sendEmail.mock.calls.map(([email]) => email as EmailOptions);
  expect(emails.map(email => email.to)).toEqual([APY_EMAIL, baseInput.email]);
  return emails;
}

function assertPricingRules(body: string) {
  expect(body).toContain("non-binding package estimate, not a final quote or confirmed booking");
  expect(body).toContain("Indicative package ranges in CAD, plus HST.");
  expect(body).toContain("Final pricing depends on the confirmed scope, date and delivery costs.");
  expect(body).toContain("Off-site travel is quoted separately.");
  expect(body).toContain("Larger or more complex events receive a custom quote and may exceed these ranges.");
}

beforeEach(() => {
  vi.clearAllMocks();
  db = createMockDb();
  mocks.getDb.mockResolvedValue(db);
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.notifyOwner.mockResolvedValue(true);
  network = vi.fn(() => { throw new Error("Unexpected external network call in isolated private-event test"); });
  vi.stubGlobal("fetch", network);
});

afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("privateEvents.submitInquiry approved test bands", () => {
  it.each(bands)("stores the selected %s band and renders accurate HTML/text emails", async (packageType, name, min, max, label) => {
    const caller = privateEventsRouter.createCaller(context());
    await expect(caller.submitInquiry({ ...baseInput, packageType })).resolves.toEqual({ success: true });
    expect(insertedInquiry()).toMatchObject({
      packageType, estimatedMin: min, estimatedMax: max,
      phone: "+12897881885", preferredDate: baseInput.preferredDate,
    });
    for (const email of inquiryEmails()) {
      expect(email).not.toHaveProperty("from");
      expect(email).not.toHaveProperty("replyTo");
      for (const body of [email.html, email.text!]) {
        expect(body).toContain(`${name} (${label})`);
        expect(body).toContain(label);
        expect(body).not.toContain("$1,200");
        expect(body).not.toContain("$5,000");
        assertPricingRules(body);
      }
    }
    expect(mocks.sendEmail.mock.calls[1][0].subject).toContain(label);
    const ownerContent = mocks.notifyOwner.mock.calls[0][0].content as string;
    expect(ownerContent).toContain(label);
    assertPricingRules(ownerContent);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert.mock.calls.map(([table]) => table)).toEqual([
      privateEventInquiries, privateEventActions, communicationsLog,
    ]);
    expect(db.writes[1].row).toMatchObject({
      inquiryId: FAKE_INQUIRY_ID, action: "inquiry_submitted",
      details: JSON.stringify({ estimatedMin: min, estimatedMax: max, packageType }),
    });
    expect(db.writes[2].row).toMatchObject({ entityId: FAKE_INQUIRY_ID, deliveryStatus: "sent" });
  });

  it.each(["Corporate Wellness", "Brand Activation", "Team Building"])("does not add a corporate uplift for %s", async eventType => {
    for (const [packageType, , min, max, label] of bands) {
      vi.clearAllMocks();
      db = createMockDb();
      mocks.getDb.mockResolvedValue(db);
      await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, eventType, packageType });
      expect(insertedInquiry()).toMatchObject({ estimatedMin: min, estimatedMax: max });
      for (const email of inquiryEmails()) {
        expect(email.html).toContain(label);
        expect(email.text).toContain(label);
      }
    }
  });

  it.each(["Kitchener", "Oakville", "Toronto", "Other client venue"])("quotes travel separately without adding a fixed fee in %s", async location => {
    await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, location });
    expect(insertedInquiry()).toMatchObject({ estimatedMin: 1500, estimatedMax: 1750 });
    for (const email of inquiryEmails()) {
      for (const body of [email.html, email.text!]) {
        expect(body).toContain("$1,500-$1,750 + HST CAD");
        expect(body).toContain("Off-site travel is quoted separately.");
      }
    }
  });

  it.each(bands)("keeps %s as the selected reference band for larger groups, with no fixed session estimate", async (packageType, name, _min, _max, label) => {
    for (const guests of [21, 40, 41, 100]) {
      vi.clearAllMocks();
      db = createMockDb();
      mocks.getDb.mockResolvedValue(db);
      await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, packageType, guests });
      expect(insertedInquiry()).toMatchObject({ packageType, guests, estimatedMin: 0, estimatedMax: 0 });
      expect(insertedInquiry()).not.toHaveProperty("sessions");
      expect(insertedInquiry()).not.toHaveProperty("finalPriceCents");
      for (const email of inquiryEmails()) {
        for (const body of [email.html, email.text!]) {
          expect(body).toContain("Custom quote required");
          expect(body).toContain(`${name} (${label}; selected reference band only)`);
          expect(body).not.toMatch(/\$0(?:\D|$)|free event|Custom Luxury quote|\$5,000|\$6,000|\$2,300/);
          if (packageType !== "luxury") expect(body).not.toContain("Luxury Experience");
          assertPricingRules(body);
        }
        expect(email.html).toMatch(/font-size:(?:26|28)px[^>]*>Custom quote required<\/p>/);
        expect(email.text).toMatch(/(?:Estimated Quote|YOUR ESTIMATE): Custom quote required/);
      }
      expect(mocks.sendEmail.mock.calls[1][0].subject).toContain("Custom quote required");
      expect(mocks.sendEmail.mock.calls[1][0].subject).not.toContain("$");
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalledWith(privateEventClasses);
      expect(db.writes[2].row.bodyPreview).toContain("Custom quote required");
    }
  });

  it.each([[0, 0], [-999999, -1], [1, 999999]])("ignores untrusted client prices %s/%s", async (estimatedMin, estimatedMax) => {
    await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, packageType: "signature", estimatedMin, estimatedMax });
    expect(insertedInquiry()).toMatchObject({ estimatedMin: 2000, estimatedMax: 2250 });
    for (const email of inquiryEmails()) {
      expect(email.html).toContain("$2,000-$2,250 + HST CAD");
      expect(email.text).toContain("$2,000-$2,250 + HST CAD");
    }
  });

  it("also ignores supplied prices for a custom quote", async () => {
    await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, guests: 50, estimatedMin: 1, estimatedMax: 999999 });
    expect(insertedInquiry()).toMatchObject({ packageType: "classic", estimatedMin: 0, estimatedMax: 0 });
    for (const email of inquiryEmails()) {
      expect(email.html).toContain("Custom quote required");
      expect(email.text).toContain("Custom quote required");
      expect(email.text).not.toContain("999999");
    }
  });

  it("escapes an arbitrary preferred-date string in both HTML emails without changing validation or storage", async () => {
    const preferredDate = '<img src=x onerror="alert(1)">';
    await privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, preferredDate });
    expect(insertedInquiry().preferredDate).toBe(preferredDate);
    for (const email of inquiryEmails()) {
      expect(email.html).not.toContain(preferredDate);
      expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
      expect(email.text).toContain(preferredDate);
    }
  });

  it("preserves required Canadian-phone validation before any insert or email", async () => {
    await expect(privateEventsRouter.createCaller(context()).submitInquiry({ ...baseInput, phone: "123" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });
});

describe("custom inquiry approval and unchanged legacy commercial controls", () => {
  it.each([1, 1500, 3000])("requires owner approval for a 0/0 custom inquiry quoted at $%s", async finalPrice => {
    db.setInquiry({
      id: FAKE_INQUIRY_ID, name: baseInput.name, location: baseInput.location,
      estimatedMin: 0, estimatedMax: 0, packageType: "classic", guests: 50,
    });
    const result = await privateEventsRouter.createCaller(context(true)).generateBookingLink({
      inquiryId: FAKE_INQUIRY_ID, finalPrice, pricingType: "plus_hst", sessions: 1,
      eventDate: "2026-12-12", startTime: "14:00", endTime: "15:30",
    });
    expect(result).toMatchObject({ needsApproval: true, approvalStatus: "pending", eventUrl: null, eventId: null, emailDraft: null });
    expect(db.updateSet).toHaveBeenCalledWith(expect.objectContaining({ ownerApproved: false, approvalStatus: "pending", lumaEventUrl: null, lumaEventId: null }));
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Needs Approval") }));
    expect(db.insert).not.toHaveBeenCalledWith(privateEventClasses);
  });

  it.each([[0, 1500], [1500, 0], [-1, 1500]])("requires owner review for an incomplete legacy estimate %s/%s", async (estimatedMin, estimatedMax) => {
    db.setInquiry({
      id: FAKE_INQUIRY_ID, name: baseInput.name, location: baseInput.location,
      estimatedMin, estimatedMax, packageType: "classic", guests: 20,
    });
    const result = await privateEventsRouter.createCaller(context(true)).generateBookingLink({
      inquiryId: FAKE_INQUIRY_ID, finalPrice: 1500, pricingType: "plus_hst", sessions: 1,
      eventDate: "2026-12-12", startTime: "14:00", endTime: "15:30",
    });
    expect(result).toMatchObject({ needsApproval: true, approvalStatus: "pending", eventUrl: null });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalledWith(privateEventClasses);
  });

  it("preserves existing positive-estimate approval thresholds and quote/Luma session arithmetic", () => {
    expect(privateEventQuoteNeedsApproval(1199, 1200)).toBe(true);
    expect(privateEventQuoteNeedsApproval(1200, 1200)).toBe(false);
    expect(privateEventQuoteNeedsApproval(3000, 1200)).toBe(false);
    expect(privateEventQuoteNeedsApproval(3000.01, 1200)).toBe(true);
    expect(calculatePrivateEventPrice(1200, "plus_hst", 2)).toEqual({ basePriceCents: 240000, hstCents: 31200, totalCents: 271200 });
    expect(calculateLumaTicketPricing(1130, "all_in", 2)).toEqual({ lumaTicketCents: 200000, hstCents: 26000, totalCents: 226000 });
  });

  it("keeps retired quick booking blocked without inserts, email, or publication", async () => {
    await expect(privateEventsRouter.createCaller(context(true)).generateQuickBookingLink({
      clientName: baseInput.name, eventDate: "2026-12-12", sessions: 1,
      sessionSchedule: [{ startTime: "14:00", endTime: "15:30" }],
      finalPrice: 1200, pricingType: "plus_hst",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("sends an existing approved saved quote verbatim without applying the new inquiry bands", async () => {
    const subject = "Your original approved private-event quote";
    const body = "Original price: $1,200 CAD + HST.\nExisting booking link: https://example.com/legacy-booking";
    db.setInquiry({
      id: FAKE_INQUIRY_ID, name: baseInput.name, email: baseInput.email,
      eventType: baseInput.eventType, guests: 20, packageType: "classic", location: "Kitchener",
      estimatedMin: 1200, estimatedMax: 1500, finalPriceCents: 120000, hstCents: 15600,
      pricingType: "plus_hst", preferredDate: "2026-12-12", eventStartTime: "14:00",
      ownerApproved: true, approvalStatus: "approved", quoteSentAt: null,
      lumaEventUrl: "https://example.com/legacy-booking", quoteEmailSubject: subject, quoteEmailBody: body,
    });
    await expect(privateEventsRouter.createCaller(context(true)).sendQuoteEmail({ inquiryId: FAKE_INQUIRY_ID }))
      .resolves.toEqual({ success: true });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: baseInput.email, subject, text: body }));
    const sent = mocks.sendEmail.mock.calls[0][0] as EmailOptions;
    expect(sent.html).toContain("$1,200 CAD + HST.");
    expect(sent.html).not.toContain("$1,500-$1,750");
    expect(sent.html).not.toContain("non-binding package estimate");
    expect(db.updateSet).toHaveBeenCalledWith({ quoteEmailSubject: subject, quoteEmailBody: body, quoteSentAt: expect.any(Date), status: "quote_sent" });
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("does not alter an already issued legacy quote or allow it to be prepared again", async () => {
    const issued = {
      id: FAKE_INQUIRY_ID, estimatedMin: 1200, estimatedMax: 1500,
      finalPriceCents: 120000, hstCents: 15600, pricingType: "plus_hst",
      quoteSentAt: new Date("2026-10-01"), quoteEmailBody: "Original issued quote.",
      status: "quote_sent" as const,
    };
    db.setInquiry(issued);
    await expect(privateEventsRouter.createCaller(context(true)).generateBookingLink({
      inquiryId: FAKE_INQUIRY_ID, finalPrice: 1750, pricingType: "plus_hst",
      eventDate: "2026-12-12", startTime: "14:00", endTime: "15:30",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(issued).toMatchObject({ estimatedMin: 1200, estimatedMax: 1500, finalPriceCents: 120000, quoteEmailBody: "Original issued quote." });
  });
});
