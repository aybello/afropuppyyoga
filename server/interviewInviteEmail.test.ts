import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./email", () => ({ sendEmail: mocks.sendEmail }));

import { sendInterviewInviteEmail } from "./interviewInviteEmail";

type LedgerRow = {
  idempotencyKey: string;
  recipient: string | null;
  subject: string | null;
  deliveryStatus: string;
  [key: string]: unknown;
};

function duplicateError() {
  return Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
}

function makeDb(options: { insertFailure?: Error; updateFailure?: Error } = {}) {
  const rows = new Map<string, LedgerRow>();
  let activeKey: string | undefined;
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(async (value: LedgerRow) => {
        activeKey = value.idempotencyKey;
        if (options.insertFailure) throw options.insertFailure;
        if (rows.has(value.idempotencyKey)) throw duplicateError();
        // The synchronous Map mutation models the database unique constraint even
        // when two callers are waiting on the same insert promise.
        rows.set(value.idempotencyKey, { ...value });
        return [{ insertId: rows.size }];
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            const row = activeKey ? rows.get(activeKey) : undefined;
            return row ? [{ ...row }] : [];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((change: Partial<LedgerRow>) => ({
        where: vi.fn(async () => {
          if (options.updateFailure) throw options.updateFailure;
          if (activeKey && rows.has(activeKey)) rows.set(activeKey, { ...rows.get(activeKey)!, ...change });
          return [{ affectedRows: activeKey && rows.has(activeKey) ? 1 : 0 }];
        }),
      })),
    })),
  };
  return { db, rows };
}

const email = {
  to: "applicant@example.com",
  subject: "Your AfroPuppyYoga interview",
  text: "Please choose an interview time.",
  html: "<p>Please choose an interview time.</p>",
};

const baseInput = {
  applicationId: 42,
  requestKey: "manual-1",
  actor: { id: 7, name: "Hiring Lead" },
  email,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendInterviewInviteEmail", () => {
  it("persists a processing claim before provider dispatch and then marks it sent", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockImplementation(async () => {
      expect([...rows.values()][0]).toMatchObject({
        idempotencyKey: "interview-email:42:manual-1",
        recipient: email.to,
        deliveryStatus: "processing",
        actorUserId: 7,
        actorName: "Hiring Lead",
      });
    });

    await expect(sendInterviewInviteEmail(baseInput)).resolves.toEqual({ status: "sent" });

    const row = [...rows.values()][0]!;
    const fingerprint = createHash("sha256").update(JSON.stringify(email)).digest("hex");
    expect(row.subject).toBe(`Interview invitation ${fingerprint}`);
    expect(row.deliveryStatus).toBe("sent");
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it("replays a sent ledger row for the same key without sending again", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);

    await expect(sendInterviewInviteEmail(baseInput)).resolves.toEqual({ status: "sent" });
    await expect(sendInterviewInviteEmail(baseInput)).resolves.toEqual({ status: "sent", reused: true });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it.each(["processing", "unknown"])("does not repeat a %s claim", async (deliveryStatus) => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const fingerprint = createHash("sha256").update(JSON.stringify(email)).digest("hex");
    rows.set("interview-email:42:manual-1", {
      idempotencyKey: "interview-email:42:manual-1",
      recipient: email.to,
      subject: `Interview invitation ${fingerprint}`,
      deliveryStatus,
    });

    await expect(sendInterviewInviteEmail(baseInput)).resolves.toMatchObject({ status: "unknown", reused: true });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses the same key when either the body or recipient changes", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);
    await sendInterviewInviteEmail(baseInput);

    await expect(sendInterviewInviteEmail({ ...baseInput, email: { ...email, text: "Changed copy" } })).resolves.toMatchObject({ status: "failed" });
    await expect(sendInterviewInviteEmail({ ...baseInput, email: { ...email, to: "other@example.com" } })).resolves.toMatchObject({ status: "failed" });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not send when an unrelated insert error prevents the claim", async () => {
    const { db } = makeDb({ insertFailure: Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }) });
    mocks.getDb.mockResolvedValue(db);

    await expect(sendInterviewInviteEmail(baseInput)).resolves.toMatchObject({ status: "failed" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("treats provider rejection as ambiguous, records unknown, and exposes no provider error", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockRejectedValue(new Error("SMTP password secret-value; mailbox rejected"));

    const result = await sendInterviewInviteEmail(baseInput);

    expect(result).toEqual({
      status: "unknown",
      reason: "The email provider did not confirm this invitation. Check the APY Sent folder before starting a new invitation.",
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect([...rows.values()][0]!.deliveryStatus).toBe("unknown");
  });

  it("returns sent with a no-resend warning when provider acceptance cannot be finalized", async () => {
    const { db } = makeDb({ updateFailure: new Error("ledger unavailable") });
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);

    await expect(sendInterviewInviteEmail(baseInput)).resolves.toEqual({
      status: "sent",
      reason: "Email was accepted, but its delivery record could not be finalized. Do not resend it.",
    });
  });

  it("fails without dispatch when the database is missing", async () => {
    mocks.getDb.mockResolvedValue(null);

    await expect(sendInterviewInviteEmail(baseInput)).resolves.toEqual({
      status: "failed",
      reason: "Email was not attempted because its delivery record could not be saved.",
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("allows only one provider call for concurrent duplicate requests", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);

    const results = await Promise.all([sendInterviewInviteEmail(baseInput), sendInterviewInviteEmail(baseInput)]);

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(results.some((result) => result.status === "sent")).toBe(true);
    expect(results.every((result) => result.status === "sent" || result.status === "unknown")).toBe(true);
  });
});
