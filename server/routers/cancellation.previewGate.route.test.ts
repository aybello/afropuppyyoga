import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, sendClassCancellationEmail, setLumaRegistrationOpen, ensureFreeCalendarRebookingCoupon } = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendClassCancellationEmail: vi.fn(),
  setLumaRegistrationOpen: vi.fn(),
  ensureFreeCalendarRebookingCoupon: vi.fn(),
}));

vi.mock("../db", () => ({ getDb }));
vi.mock("../email", () => ({
  buildClassCancellationEmail: vi.fn(({ eventName, rebookingCode, guestName }) => ({
    subject: "Important: Your AfroPuppyYoga class has been cancelled",
    html: "<p>preview</p>",
    text: `Hi ${guestName}, ${eventName}. Your free rebooking code: ${rebookingCode}`,
  })),
  sendClassCancellationEmail,
}));
vi.mock("../lumaCalendarCoupon", async () => {
  const actual = await vi.importActual<typeof import("../lumaCalendarCoupon")>("../lumaCalendarCoupon");
  return { ...actual, ensureFreeCalendarRebookingCoupon };
});
vi.mock("../lumaScheduleHelper", () => ({ setLumaRegistrationOpen }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed: vi.fn() }));
vi.mock("../twilioWebhook", () => ({ getTwilioWebhookUrl: vi.fn() }));
vi.mock("twilio", () => ({ default: () => ({ calls: { create: vi.fn() }, messages: { create: vi.fn() } }) }));

import { cancellationRouter } from "./cancellation";

const caller = () => cancellationRouter.createCaller({
  user: { id: 1, openId: "owner", name: "APY Owner", email: "owner@example.com", role: "admin" },
} as never);

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function lumaJson(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

function createDb() {
  return {
    select: vi.fn(() => {
      const query: any = {
        from: () => query,
        where: () => query,
        limit: () => Promise.resolve([]),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve([]).then(resolve, reject),
      };
      return query;
    }),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
  };
}

describe("preview-gated cancellation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-preview-secret";
    process.env.TWILIO_ACCOUNT_SID = "AC-test";
    process.env.TWILIO_AUTH_TOKEN = "token-test";
    process.env.TWILIO_PHONE_NUMBER = "+15550001111";
    sendClassCancellationEmail.mockResolvedValue(undefined);
    setLumaRegistrationOpen.mockResolvedValue(undefined);
    ensureFreeCalendarRebookingCoupon.mockResolvedValue({ state: "created" });
    getDb.mockResolvedValue(createDb());
    global.fetch = vi.fn((url: string) => {
      if (url.includes("calendar/list-events")) {
        return lumaJson({ entries: [{ event: { api_id: "evt-preview", name: "AfroPuppyYoga | Kitchener | Dachshunds", start_at: "2026-09-12T15:00:00.000Z" } }] });
      }
      if (url.includes("event/get-guests")) {
        return lumaJson({ entries: [{ user_name: "Preview Guest", user_email: "guest@example.com", phone_number: "+15550002222", approval_status: "approved" }], has_more: false, next_cursor: null });
      }
      throw new Error(`Unexpected Luma request: ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("does not close registration, create a code, or deliver when the preview key is stale", async () => {
    const preview = await caller().previewCancellation({ eventApiId: "evt-preview" });

    await expect(caller().cancelClass({ eventApiId: "evt-preview", customMessage: "Different text", previewKey: preview.previewKey })).rejects.toThrow(
      "This cancellation preview is no longer current"
    );

    expect(setLumaRegistrationOpen).not.toHaveBeenCalled();
    expect(ensureFreeCalendarRebookingCoupon).not.toHaveBeenCalled();
  });

  it("rejects a historical untracked Private PuppyYoga booking page", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("calendar/list-events")) {
        return lumaJson({ entries: [{ event: { api_id: "evt-legacy-private", name: "Northwind — Private PuppyYoga", start_at: "2026-09-12T15:00:00.000Z" } }] });
      }
      throw new Error(`Unexpected Luma request: ${url}`);
    }) as typeof fetch;

    await expect(caller().previewCancellation({ eventApiId: "evt-legacy-private" })).rejects.toThrow("private-event booking");
    expect(setLumaRegistrationOpen).not.toHaveBeenCalled();
  });

  it("allows delivery only after the current exact-message preview is confirmed", async () => {
    getDb.mockResolvedValue(createDb());
    const preview = await caller().previewCancellation({ eventApiId: "evt-preview" });

    const result = await caller().cancelClass({ eventApiId: "evt-preview", previewKey: preview.previewKey });

    expect(result).toMatchObject({ rebookingCode: "SEP12", registrationClosed: true });
    expect(setLumaRegistrationOpen).toHaveBeenCalledWith("evt-preview", false);
    expect(ensureFreeCalendarRebookingCoupon).toHaveBeenCalledWith("SEP12", expect.any(Object));
    expect(sendClassCancellationEmail).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "AfroPuppyYoga | Kitchener | Dachshunds",
      rebookingCode: "SEP12",
    }));
  });
});
