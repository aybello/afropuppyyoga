import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  twilio: vi.fn(),
  suppressed: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("twilio", () => ({ default: mocks.twilio }));
vi.mock("./smsConsent", () => ({ isSmsSuppressed: mocks.suppressed }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { sendInterviewInviteSms } from "./interviewInviteSms";

type LedgerRow = {
  recipient: string | null;
  subject: string | null;
  deliveryStatus: string;
  providerMessageId: string | null;
  [key: string]: unknown;
};

function duplicateError() {
  return Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
}

function makeDb(options: { claimFails?: boolean; updateFails?: boolean } = {}) {
  const rows = new Map<string, LedgerRow>();
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(async (value: LedgerRow & { idempotencyKey: string }) => {
        if (options.claimFails) throw new Error("write unavailable");
        if (rows.has(value.idempotencyKey)) throw duplicateError();
        rows.set(value.idempotencyKey, { ...value });
        return [{ insertId: rows.size }];
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            const row = [...rows.values()][0];
            return row ? [{
              recipient: row.recipient,
              subject: row.subject,
              deliveryStatus: row.deliveryStatus,
              providerMessageId: row.providerMessageId,
            }] : [];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((change: Partial<LedgerRow>) => ({
        where: vi.fn(async () => {
          if (options.updateFails) throw new Error("update unavailable");
          const key = [...rows.keys()][0];
          if (key) rows.set(key, { ...rows.get(key)!, ...change });
          return [{ affectedRows: key ? 1 : 0 }];
        }),
      })),
    })),
  };
  return { db, rows };
}

const baseInput = {
  applicationId: 42,
  applicantName: "Avery Johnson",
  role: "Yoga Instructor",
  phone: "(289) 788-1885",
  bookingLink: "https://calendar.example/interview",
  requestKey: "manual-1",
  actor: { id: 7, name: "Hiring Lead" },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "secret";
  process.env.TWILIO_PHONE_NUMBER = "+14165550100";
  mocks.suppressed.mockResolvedValue(false);
  mocks.twilio.mockReturnValue({ messages: { create: mocks.create } });
});

describe("sendInterviewInviteSms", () => {
  it("normalizes only the saved phone and skips null or invalid values before DB/provider work", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);

    await expect(sendInterviewInviteSms({ ...baseInput, phone: null })).resolves.toMatchObject({ status: "skipped", phone: null });
    await expect(sendInterviewInviteSms({ ...baseInput, phone: "123-456-7890" })).resolves.toMatchObject({ status: "skipped", phone: null });
    expect(mocks.suppressed).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("skips before claiming when Twilio credentials are missing", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);

    await expect(sendInterviewInviteSms(baseInput)).resolves.toEqual({
      status: "skipped",
      reason: "SMS is not configured.",
      phone: "+12897881885",
    });
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("fails closed on suppression lookup failure and skips opted-out recipients", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.suppressed.mockRejectedValueOnce(new Error("DB down")).mockResolvedValueOnce(true);

    await expect(sendInterviewInviteSms(baseInput)).resolves.toMatchObject({ status: "unknown", phone: "+12897881885" });
    await expect(sendInterviewInviteSms(baseInput)).resolves.toMatchObject({ status: "skipped", reason: "Applicant opted out of SMS." });
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("claims processing before dispatch and sends the exact capped branded message with SDK safety options", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockResolvedValue({ sid: "SM123", status: "queued" });
    const longName = "Alexandertheverylongfirstname Beyond Thirty Characters";
    const longRole = "R".repeat(120);

    const result = await sendInterviewInviteSms({ ...baseInput, applicantName: longName, role: longRole });

    expect(result).toEqual({ status: "queued", phone: "+12897881885", providerMessageId: "SM123" });
    expect(mocks.twilio).toHaveBeenCalledWith("AC_test", "secret", { timeout: 10_000, autoRetry: false });
    expect(mocks.create).toHaveBeenCalledWith({
      to: "+12897881885",
      from: "+14165550100",
      body: `AfroPuppyYoga: Hi Alexandertheverylongfirstname, please book your ${"R".repeat(100)} interview: https://calendar.example/interview. Check your email for details. Questions? afropuppyyoga@gmail.com. Reply STOP to opt out.`,
    });
    const row = [...rows.values()][0]!;
    expect(row).toMatchObject({
      idempotencyKey: "interview-sms:42:manual-1",
      recipient: "+12897881885",
      deliveryStatus: "queued",
      providerMessageId: "SM123",
      actorUserId: 7,
      actorName: "Hiring Lead",
    });
    expect(row.subject).toMatch(/^[a-f0-9]{64}$/);
  });

  it("lets one concurrent request dispatch and replays the same durable result", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockResolvedValue({ sid: "SMconcurrent", status: "sent" });

    const results = await Promise.all([sendInterviewInviteSms(baseInput), sendInterviewInviteSms(baseInput)]);

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(results).toContainEqual({ status: "sent", phone: "+12897881885", providerMessageId: "SMconcurrent" });
    expect(results.every((result) => ["sent", "unknown"].includes(result.status))).toBe(true);
  });

  it("does not resend an unknown network outcome and replays it as unknown", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockRejectedValue(new Error("socket timeout"));

    const first = await sendInterviewInviteSms(baseInput);
    const replay = await sendInterviewInviteSms(baseInput);

    expect(first.status).toBe("unknown");
    expect(replay.status).toBe("unknown");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of an idempotency key with a different recipient or body", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockResolvedValue({ sid: "SMonce", status: "queued" });
    await sendInterviewInviteSms(baseInput);

    const conflict = await sendInterviewInviteSms({ ...baseInput, role: "Puppy Monitor" });

    expect(conflict).toMatchObject({ status: "failed", reason: "SMS request conflicts with a previous request." });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("distinguishes explicit Twilio rejection from timeout/network errors and requires a SID", async () => {
    const rejectedDb = makeDb();
    mocks.getDb.mockResolvedValueOnce(rejectedDb.db);
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("private provider detail"), { status: 400, code: 21211 }));
    const rejected = await sendInterviewInviteSms(baseInput);
    expect(rejected).toMatchObject({ status: "failed", reason: "SMS provider rejected the message." });
    expect(rejected.reason).not.toContain("private provider detail");

    const noSidDb = makeDb();
    mocks.getDb.mockResolvedValueOnce(noSidDb.db);
    mocks.create.mockResolvedValueOnce({ sid: "", status: "queued" });
    await expect(sendInterviewInviteSms({ ...baseInput, requestKey: "manual-2" })).resolves.toMatchObject({ status: "unknown" });
  });

  it.each([408, 500, 503])("keeps provider %s uncertain and never resends its claim", async (status) => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("uncertain provider response"), { status, code: 20500 }));
    await expect(sendInterviewInviteSms(baseInput)).resolves.toMatchObject({ status: "unknown" });
    await expect(sendInterviewInviteSms(baseInput)).resolves.toMatchObject({ status: "unknown" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("maps honest provider snapshots without claiming final delivery", async () => {
    for (const [provider, expected] of [["accepted", "queued"], ["queued", "queued"], ["delivered", "delivered"], ["undelivered", "failed"], ["canceled", "failed"]] as const) {
      const { db } = makeDb();
      mocks.getDb.mockResolvedValueOnce(db);
      mocks.create.mockResolvedValueOnce({ sid: `SM-${provider}`, status: provider });
      const result = await sendInterviewInviteSms({ ...baseInput, requestKey: provider });
      expect(result.status).toBe(expected);
    }
  });

  it("does not call Twilio when claim storage fails", async () => {
    const { db } = makeDb({ claimFails: true });
    mocks.getDb.mockResolvedValue(db);

    await expect(sendInterviewInviteSms(baseInput)).resolves.toMatchObject({ status: "unknown" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns unknown with the SID when the provider accepts but the ledger update fails", async () => {
    const { db } = makeDb({ updateFails: true });
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockResolvedValue({ sid: "SMaccepted", status: "queued" });

    await expect(sendInterviewInviteSms(baseInput)).resolves.toEqual({
      status: "unknown",
      reason: "SMS outcome could not be recorded.",
      phone: "+12897881885",
      providerMessageId: "SMaccepted",
    });
  });
});
