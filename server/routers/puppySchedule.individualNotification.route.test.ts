import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, sendEmail, isSmsSuppressed } = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendEmail: vi.fn(),
  isSmsSuppressed: vi.fn(),
}));

vi.mock("../db", () => ({ getDb }));
vi.mock("../email", () => ({ sendEmail, buildBreederConfirmationEmail: vi.fn() }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed }));

import { puppyScheduleRouter } from "./puppySchedule";

const schedule = { id: 77, scheduleStatus: "scheduled", classDate: "2026-08-29", location: "Kitchener", breed: "Huskies", startTime: "10:00", endTime: "11:00" };
const createDb = (person: { email: string | null; phone: string | null }, prior: unknown[] = []) => {
  const responses: unknown[] = [
    [schedule],
    [{ id: 1, name: "Maya Monitor", email: person.email, phone: person.phone, role: "Operations Manager", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null }],
    [], [], [], prior,
  ];
  const inserts: unknown[] = [];
  const db = {
    select: vi.fn(() => {
      const result = responses.shift() ?? [];
      const query: any = {
        from: () => query,
        where: () => query,
        limit: () => Promise.resolve(result),
        orderBy: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
    insert: vi.fn(() => ({ values: vi.fn((value) => { inserts.push(value); return Promise.resolve(); }) })),
  };
  return { db, inserts };
};

const caller = () => puppyScheduleRouter.createCaller({ user: { openId: "owner", name: "Ay Bello", email: "afropuppyyoga@gmail.com", role: "admin" } } as never);

describe("notifyIndividualEventStaff mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    vi.stubEnv("TWILIO_PHONE_NUMBER", "");
    isSmsSuppressed.mockResolvedValue(false);
  });

  it("rejects an unassigned recipient and a prior delivery without explicit resend", async () => {
    let prepared = createDb({ email: "maya@example.com", phone: null });
    getDb.mockResolvedValue(prepared.db);
    await expect(caller().notifyIndividualEventStaff({ scheduleId: 77, staffId: 2, resend: false })).rejects.toThrow("not currently assigned");
    prepared = createDb({ email: "maya@example.com", phone: null }, [{ staffId: 1, emailStatus: "sent", smsStatus: "missing", sentAt: new Date() }]);
    getDb.mockResolvedValue(prepared.db);
    await expect(caller().notifyIndividualEventStaff({ scheduleId: 77, staffId: 1, resend: false })).rejects.toThrow("Choose Resend");
  });

  it("returns suppressed and not-configured delivery states without claiming success", async () => {
    let prepared = createDb({ email: null, phone: "+15555550100" });
    getDb.mockResolvedValue(prepared.db);
    isSmsSuppressed.mockResolvedValue(true);
    await expect(caller().notifyIndividualEventStaff({ scheduleId: 77, staffId: 1, resend: false })).resolves.toMatchObject({ success: false, deliveryStatus: "sms_suppressed" });
    prepared = createDb({ email: null, phone: "+15555550100" });
    getDb.mockResolvedValue(prepared.db);
    isSmsSuppressed.mockResolvedValue(false);
    await expect(caller().notifyIndividualEventStaff({ scheduleId: 77, staffId: 1, resend: false })).resolves.toMatchObject({ success: false, deliveryStatus: "not_configured" });
  });

  it("returns failed and sent delivery states from the route", async () => {
    let prepared = createDb({ email: "maya@example.com", phone: null });
    getDb.mockResolvedValue(prepared.db);
    sendEmail.mockRejectedValueOnce(new Error("SMTP timeout"));
    await expect(caller().notifyIndividualEventStaff({ scheduleId: 77, staffId: 1, resend: false })).resolves.toMatchObject({ success: false, deliveryStatus: "failed" });
    prepared = createDb({ email: "maya@example.com", phone: null });
    getDb.mockResolvedValue(prepared.db);
    sendEmail.mockResolvedValueOnce(undefined);
    await expect(caller().notifyIndividualEventStaff({ scheduleId: 77, staffId: 1, resend: false })).resolves.toMatchObject({ success: true, deliveryStatus: "sent" });
  });
});
