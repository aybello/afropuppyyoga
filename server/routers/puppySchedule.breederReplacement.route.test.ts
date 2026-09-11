import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, sendEmail, smsCreate, isSmsSuppressed, updateLumaEventForSchedule } = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendEmail: vi.fn(),
  smsCreate: vi.fn(),
  isSmsSuppressed: vi.fn(),
  updateLumaEventForSchedule: vi.fn(),
}));

vi.mock("../db", () => ({ getDb }));
vi.mock("../email", () => ({ sendEmail, buildBreederConfirmationEmail: vi.fn() }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed }));
vi.mock("../lumaScheduleHelper", () => ({
  createLumaEventForSchedule: vi.fn(),
  getExistingLumaEventInvitationReadiness: vi.fn(),
  sendExistingLumaEventInvitations: vi.fn(),
  setLumaRegistrationOpen: vi.fn(),
  updateLumaEventForSchedule,
}));
vi.mock("twilio", () => ({ default: () => ({ messages: { create: smsCreate } }) }));

import { puppyScheduleRouter } from "./puppySchedule";

const activeLumaSchedule = {
  id: 88,
  breederId: 14,
  breederName: "Outgoing Frenchie Breeder",
  classDate: "2026-09-20",
  dayOfWeek: "Sunday",
  location: "Oakville",
  breed: "Frenchies",
  startTime: "11:00",
  endTime: "15:00",
  classType: "regular",
  notes: null,
  scheduleStatus: "scheduled",
  lumaEventId: "evt-active",
  lumaEventUrl: "https://luma.com/evt-active",
};
const outgoingBreeder = { id: 14, name: "Outgoing Frenchie Breeder", contactName: "Jordan Breeder", email: "outgoing@example.com", phone: "2895551234", isActive: 1 };
const incomingBreeder = { id: 27, name: "Incoming Bernese Breeder", contactName: "Morgan Breeder", email: "incoming@example.com", phone: "2895555678", isActive: 1 };

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

describe("previewed active-Luma breeder replacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue(undefined);
    smsCreate.mockResolvedValue({ sid: "SM-OUTGOING" });
    isSmsSuppressed.mockResolvedValue(false);
    updateLumaEventForSchedule.mockResolvedValue(undefined);
  });

  it("keeps the active Luma event, updates the linked breeder, and notifies only the outgoing breeder after the current preview is confirmed", async () => {
    const prepared = createDb([
      [activeLumaSchedule], [outgoingBreeder], [incomingBreeder],
      [activeLumaSchedule], [outgoingBreeder], [incomingBreeder], [],
    ]);
    getDb.mockResolvedValue(prepared.db);

    const preview = await caller().getBreederReplacementPreview({ id: 88, newBreederId: 27, newBreed: "Bernese Mountain Dogs" });
    expect(preview).toMatchObject({
      currentBreeder: { name: "Outgoing Frenchie Breeder" },
      replacementBreeder: { name: "Incoming Bernese Breeder" },
      channels: { email: "ready", sms: "ready" },
    });
    expect(JSON.stringify(preview)).not.toContain(outgoingBreeder.email);
    expect(JSON.stringify(preview)).not.toContain(outgoingBreeder.phone);
    expect(sendEmail).not.toHaveBeenCalled();

    await expect(caller().replaceBreederWithNotice({ id: 88, newBreederId: 27, newBreed: "Bernese Mountain Dogs", confirmationKey: preview.confirmationKey })).resolves.toMatchObject({
      success: true,
      lumaSynchronized: true,
      emailStatus: "sent",
      smsStatus: "sent",
    });
    expect(updateLumaEventForSchedule).toHaveBeenCalledWith("evt-active", expect.objectContaining({ breederId: 27, breederName: "Incoming Bernese Breeder", breed: "Bernese Mountain Dogs" }));
    expect(prepared.updates).toContainEqual(expect.objectContaining({ breederId: 27, breederName: "Incoming Bernese Breeder", breed: "Bernese Mountain Dogs" }));
    expect(prepared.updates).not.toContainEqual(expect.objectContaining({ scheduleStatus: "archived" }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: outgoingBreeder.email, text: preview.emailText }));
    expect(smsCreate).toHaveBeenCalledWith(expect.objectContaining({ to: "+12895551234", body: preview.smsText }));
  });

  it("does not replace the breeder or notify anyone without a current matching preview", async () => {
    const prepared = createDb([[activeLumaSchedule], [outgoingBreeder], [incomingBreeder]]);
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().replaceBreederWithNotice({ id: 88, newBreederId: 27, newBreed: "Bernese Mountain Dogs", confirmationKey: "a".repeat(64) })).rejects.toThrow("Review the breeder replacement preview again before changing this class.");
    expect(prepared.updates).toHaveLength(0);
    expect(updateLumaEventForSchedule).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(smsCreate).not.toHaveBeenCalled();
  });
});
