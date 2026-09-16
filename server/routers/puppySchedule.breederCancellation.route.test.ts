import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, sendEmail, smsCreate, isSmsSuppressed } = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendEmail: vi.fn(),
  smsCreate: vi.fn(),
  isSmsSuppressed: vi.fn(),
}));

vi.mock("../db", () => ({ getDb }));
vi.mock("../email", () => ({ sendEmail, buildBreederConfirmationEmail: vi.fn() }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed }));
vi.mock("twilio", () => ({ default: () => ({ messages: { create: smsCreate } }) }));

import { puppyScheduleRouter } from "./puppySchedule";

const cancelledSchedule = {
  id: 88,
  breederId: 14,
  breederName: "Bernese Mountain Dogs Breeder",
  classDate: "2026-09-20",
  dayOfWeek: "Sunday",
  location: "Oakville",
  breed: "Bernese Mountain Dogs",
  startTime: "11:00",
  endTime: "15:00",
  scheduleStatus: "cancelled",
  lumaEventId: "evt-cancelled",
};
const breeder = {
  id: 14,
  name: "Bernese Mountain Dogs Breeder",
  contactName: "Jordan Breeder",
  email: "breeder-contact@example.com",
  phone: "2895551234",
};

function createDb(responses: unknown[]) {
  const updates: unknown[] = [];
  const inserts: unknown[] = [];
  const db = {
    select: vi.fn(() => {
      const result = responses.shift() ?? [];
      const query: any = {
        from: () => query,
        where: () => query,
        limit: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
    update: vi.fn(() => ({ set: vi.fn((value) => { updates.push(value); return { where: vi.fn(() => Promise.resolve()) }; }) })),
    insert: vi.fn(() => ({ values: vi.fn((value) => { inserts.push(value); return Promise.resolve(); }) })),
  };
  return { db, updates, inserts };
}

const caller = () => puppyScheduleRouter.createCaller({
  user: { id: 1, openId: "owner", name: "Ay Bello", email: "owner@example.com", role: "admin" },
} as never);

describe("previewed breeder cancellation archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue(undefined);
    smsCreate.mockResolvedValue({ sid: "SM123" });
    isSmsSuppressed.mockResolvedValue(false);
  });

  it("requires the current preview key, archives the already-cancelled class, and sends only the breeder cancellation notice", async () => {
    const prepared = createDb([[cancelledSchedule], [breeder], [cancelledSchedule], [breeder]]);
    getDb.mockResolvedValue(prepared.db);

    const preview = await caller().getBreederCancellationPreview({ id: 88 });
    expect(preview).toMatchObject({
      class: { id: 88, classDate: "2026-09-20", location: "Oakville", breed: "Bernese Mountain Dogs" },
      channels: { email: "ready", sms: "ready" },
    });
    expect(JSON.stringify(preview)).not.toContain(breeder.email);
    expect(JSON.stringify(preview)).not.toContain(breeder.phone);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(smsCreate).not.toHaveBeenCalled();

    await expect(caller().archiveWithBreederCancellationNotice({ id: 88, confirmationKey: preview.confirmationKey })).resolves.toMatchObject({
      success: true,
      emailStatus: "sent",
      smsStatus: "sent",
    });
    expect(prepared.updates).toContainEqual(expect.objectContaining({ scheduleStatus: "archived" }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: breeder.email, subject: preview.subject, text: preview.emailText }));
    expect(smsCreate).toHaveBeenCalledWith(expect.objectContaining({ body: preview.smsText }));
    expect(prepared.inserts).toHaveLength(1);
  });

  it("refuses to archive an active Luma-linked class through the breeder-only notification path", async () => {
    const prepared = createDb([[{ ...cancelledSchedule, scheduleStatus: "scheduled" }]]);
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().getBreederCancellationPreview({ id: 88 })).rejects.toThrow("Cancel this Luma class through Cancel Class before archiving it.");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(smsCreate).not.toHaveBeenCalled();
  });

  it("does not archive or notify when the owner has not confirmed the current preview", async () => {
    const prepared = createDb([[cancelledSchedule], [breeder]]);
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().archiveWithBreederCancellationNotice({ id: 88, confirmationKey: "a".repeat(64) })).rejects.toThrow("Review the breeder cancellation preview again before archiving.");
    expect(prepared.updates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(smsCreate).not.toHaveBeenCalled();
  });
});
