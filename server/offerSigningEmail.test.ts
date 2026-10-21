import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./email", () => ({ sendEmail: mocks.sendEmail }));

import { sendOfferSigningEmail } from "./offerSigningEmail";

type LedgerRow = {
  idempotencyKey: string;
  recipient: string | null;
  subject: string | null;
  deliveryStatus: string;
  [key: string]: unknown;
};

const privateUrl = "https://sign.example/private?token=super-secret-token";
const email = {
  to: "applicant@example.com",
  subject: "Your private offer documents",
  text: `Review and sign here: ${privateUrl}`,
  html: `<p>Private offer</p><a href="${privateUrl}">Sign offer and NDA</a>`,
};
const baseInput = {
  applicationId: 42,
  requestKey: "offer-1",
  actor: { id: 7, name: "Hiring Lead" },
  email,
};

function duplicateError(nested = false): Error {
  const duplicate = Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
  return nested ? Object.assign(new Error("query failed"), { cause: duplicate }) : duplicate;
}

function assertRowsArePrivate(rows: Map<string, LedgerRow>) {
  for (const row of rows.values()) {
    const persisted = JSON.stringify(row);
    expect(persisted).not.toContain(privateUrl);
    expect(persisted).not.toContain("super-secret-token");
    expect(persisted).not.toContain(email.html);
    expect(row.bodyPreview).toBe("Private offer letter and NDA signing link emailed. Link redacted.");
  }
}

function makeDb(options: {
  insertFailure?: Error;
  updateFailure?: Error;
  selectFailure?: Error;
  nestedDuplicates?: boolean;
} = {}) {
  const rows = new Map<string, LedgerRow>();
  let activeKey: string | undefined;
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(async (value: LedgerRow) => {
        activeKey = value.idempotencyKey;
        if (options.insertFailure) throw options.insertFailure;
        if (rows.has(value.idempotencyKey)) throw duplicateError(options.nestedDuplicates);
        rows.set(value.idempotencyKey, { ...value });
        return [{ insertId: rows.size }];
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (options.selectFailure) throw options.selectFailure;
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

beforeEach(() => vi.clearAllMocks());

describe("sendOfferSigningEmail", () => {
  it("claims before dispatch, stores only a hash and redacted preview, then finalizes sent", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockImplementation(async () => {
      expect([...rows.values()][0]).toMatchObject({
        idempotencyKey: "offer-email:42:offer-1",
        action: "offer_signing_email",
        deliveryStatus: "processing",
        actorUserId: 7,
        actorName: "Hiring Lead",
      });
      assertRowsArePrivate(rows);
    });

    await expect(sendOfferSigningEmail(baseInput)).resolves.toEqual({ status: "sent" });

    const fingerprint = createHash("sha256").update(JSON.stringify(email)).digest("hex");
    expect([...rows.values()][0]).toMatchObject({
      subject: `Offer signing notification ${fingerprint}`,
      deliveryStatus: "sent",
    });
    assertRowsArePrivate(rows);
  });

  it("replays a sent row without another provider call, including nested MySQL duplicate errors", async () => {
    const { db, rows } = makeDb({ nestedDuplicates: true });
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);

    await expect(sendOfferSigningEmail(baseInput)).resolves.toEqual({ status: "sent" });
    await expect(sendOfferSigningEmail(baseInput)).resolves.toEqual({ status: "sent", reused: true });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    assertRowsArePrivate(rows);
  });

  it.each(["processing", "unknown", "failed"])('returns reused unknown for a prior "%s" row and never resends', async (deliveryStatus) => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const fingerprint = createHash("sha256").update(JSON.stringify(email)).digest("hex");
    rows.set("offer-email:42:offer-1", {
      idempotencyKey: "offer-email:42:offer-1",
      recipient: email.to,
      subject: `Offer signing notification ${fingerprint}`,
      bodyPreview: "Private offer letter and NDA signing link emailed. Link redacted.",
      deliveryStatus,
    });

    await expect(sendOfferSigningEmail(baseInput)).resolves.toMatchObject({ status: "unknown", reused: true });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    assertRowsArePrivate(rows);
  });

  it("rejects the same key when any email request content changes", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);
    await sendOfferSigningEmail(baseInput);

    const changed = { ...email, html: `<p>Changed private document</p><a href="${privateUrl}">Sign</a>` };
    const result = await sendOfferSigningEmail({ ...baseInput, email: changed });

    expect(result).toMatchObject({ status: "failed" });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(privateUrl);
    assertRowsArePrivate(rows);
  });

  it("does not dispatch when the durable claim fails and sanitizes the database error", async () => {
    const { db, rows } = makeDb({ insertFailure: new Error(`database leaked ${privateUrl}`) });
    mocks.getDb.mockResolvedValue(db);

    const result = await sendOfferSigningEmail(baseInput);

    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).not.toContain(privateUrl);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it("does not dispatch if duplicate-claim lookup fails and sanitizes the error", async () => {
    const { db, rows } = makeDb({ selectFailure: new Error(`lookup leaked ${privateUrl}`) });
    mocks.getDb.mockResolvedValue(db);
    const fingerprint = createHash("sha256").update(JSON.stringify(email)).digest("hex");
    rows.set("offer-email:42:offer-1", {
      idempotencyKey: "offer-email:42:offer-1", recipient: email.to,
      subject: `Offer signing notification ${fingerprint}`,
      bodyPreview: "Private offer letter and NDA signing link emailed. Link redacted.", deliveryStatus: "processing",
    });

    const result = await sendOfferSigningEmail(baseInput);

    expect(result.status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain(privateUrl);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    assertRowsArePrivate(rows);
  });

  it("records ambiguous provider exceptions as unknown without exposing provider details", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockRejectedValue(new Error(`SMTP rejected ${privateUrl}`));

    const result = await sendOfferSigningEmail(baseInput);

    expect(result.status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain(privateUrl);
    expect([...rows.values()][0]!.deliveryStatus).toBe("unknown");
    assertRowsArePrivate(rows);
  });

  it("returns sent with a warning when accepted delivery cannot be finalized", async () => {
    const { db, rows } = makeDb({ updateFailure: new Error(`ledger leaked ${privateUrl}`) });
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);

    const result = await sendOfferSigningEmail(baseInput);

    expect(result).toEqual({
      status: "sent",
      reason: "Email was accepted, but its delivery record could not be finalized. Do not resend it.",
    });
    expect(JSON.stringify(result)).not.toContain(privateUrl);
    assertRowsArePrivate(rows);
  });

  it("permits only one provider dispatch for concurrent duplicate requests", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.sendEmail.mockResolvedValue(undefined);

    const results = await Promise.all([sendOfferSigningEmail(baseInput), sendOfferSigningEmail(baseInput)]);

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(results.some(({ status }) => status === "sent")).toBe(true);
    expect(results.every(({ status }) => status === "sent" || status === "unknown")).toBe(true);
    assertRowsArePrivate(rows);
  });

  it("fails without dispatch when no database is available", async () => {
    mocks.getDb.mockResolvedValue(null);

    await expect(sendOfferSigningEmail(baseInput)).resolves.toMatchObject({ status: "failed" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
