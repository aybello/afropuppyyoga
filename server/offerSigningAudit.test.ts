import { beforeEach, describe, expect, it, vi } from "vitest";
import { communicationsLog, jobApplicationActions } from "../drizzle/schema";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));

import { recordOfferSigningOutcome } from "./offerSigningAudit";

type Write = { table: unknown; values: Record<string, unknown> };

function duplicateError(wrapped = false): unknown {
  const duplicate = Object.assign(new Error("duplicate key"), { code: "ER_DUP_ENTRY" });
  return wrapped
    ? new Error("transaction failed", { cause: new Error("query failed", { cause: duplicate }) })
    : duplicate;
}

function mockDatabase() {
  const committed: Write[] = [];
  const claimedKeys = new Set<string>();
  let failTimeline = false;
  let transactionCalls = 0;

  const db = {
    transaction: vi.fn(
      async (
        callback: (tx: {
          insert: (table: unknown) => {
            values: (values: Record<string, unknown>) => Promise<void>;
          };
        }) => Promise<void>,
      ) => {
        transactionCalls += 1;
        const pending: Write[] = [];
        const pendingKeys = new Set<string>();
        const tx = {
          insert: (table: unknown) => ({
            values: async (values: Record<string, unknown>) => {
              if (table === communicationsLog) {
                const key = String(values.idempotencyKey);
                if (claimedKeys.has(key) || pendingKeys.has(key)) throw duplicateError();
                pendingKeys.add(key);
              }
              if (table === jobApplicationActions && failTimeline) {
                failTimeline = false;
                throw new Error("timeline database write failed");
              }
              pending.push({ table, values });
            },
          }),
        };

        await callback(tx);
        pending.forEach((write) => committed.push(write));
        pendingKeys.forEach((key) => claimedKeys.add(key));
      },
    ),
  };

  return {
    db,
    committed,
    claimedKeys,
    failNextTimeline: () => {
      failTimeline = true;
    },
    transactionCalls: () => transactionCalls,
  };
}

const input = {
  applicationId: 42,
  requestKey: "request-abc",
  actor: { id: 7, name: "Hiring Owner", email: "owner@example.com" },
  fromStatus: "interview_completed",
  toStatus: "offer_sent",
  reused: false,
  offerLetterType: "puppy_specialist",
  expiresAt: new Date("2026-11-15T17:30:00.000Z"),
  emailStatus: "sent",
  smsStatus: "skipped",
  smsReason: "missing_phone",
};

const warning =
  "Offer link accepted for sending, but its timeline could not be saved. Do not resend.";

beforeEach(() => {
  getDb.mockReset();
});

describe("recordOfferSigningOutcome", () => {
  it("atomically writes the outcome claim and a new-offer timeline entry", async () => {
    const prepared = mockDatabase();
    getDb.mockResolvedValue(prepared.db);

    await expect(recordOfferSigningOutcome(input)).resolves.toEqual({ recorded: true });
    expect(prepared.db.transaction).toHaveBeenCalledTimes(1);
    expect(prepared.committed).toHaveLength(2);
    expect(prepared.committed[0]).toMatchObject({
      table: communicationsLog,
      values: {
        idempotencyKey: "offer-outcome:42:request-abc",
        entityType: "job_application",
        entityId: 42,
        channel: "system",
        direction: "system",
        action: "offer_signing_outcome",
        deliveryStatus: "recorded",
        recipient: null,
        subject: "Offer signing outcome",
        actorUserId: 7,
        actorName: "Hiring Owner",
      },
    });
    expect(JSON.parse(String(prepared.committed[0].values.bodyPreview))).toEqual({
      fromStatus: "interview_completed",
      toStatus: "offer_sent",
      offerLetterType: "puppy_specialist",
      tokenReused: false,
      expiresAt: "2026-11-15T17:30:00.000Z",
      requestKey: "request-abc",
      emailStatus: "sent",
      smsStatus: "skipped",
      smsReason: "missing_phone",
    });
    expect(prepared.committed[1]).toMatchObject({
      table: jobApplicationActions,
      values: {
        applicationId: 42,
        action: "offer_sent",
        fromStatus: "interview_completed",
        toStatus: "offer_sent",
        actorUserId: 7,
        actorName: "Hiring Owner",
        actorEmail: "owner@example.com",
      },
    });
    expect(JSON.parse(String(prepared.committed[1].values.details))).toEqual({
      offerLetterType: "puppy_specialist",
      tokenReused: false,
      expiresAt: "2026-11-15T17:30:00.000Z",
      requestKey: "request-abc",
      emailStatus: "sent",
      smsStatus: "skipped",
      smsReason: "missing_phone",
    });
  });

  it("records reused links as an offer resend without storing private signing material", async () => {
    const prepared = mockDatabase();
    getDb.mockResolvedValue(prepared.db);
    const privateInput = {
      ...input,
      reused: true,
      token: "private-signing-token",
      signingUrl: "https://example.test/sign/private-signing-token",
    };

    await expect(recordOfferSigningOutcome(privateInput)).resolves.toEqual({ recorded: true });
    expect(prepared.committed[1].values.action).toBe("offer_resent");
    const persisted = JSON.stringify(prepared.committed.map(({ values }) => values));
    expect(persisted).not.toContain("private-signing-token");
    expect(persisted).not.toContain("signingUrl");
    expect(persisted).not.toContain('"token"');
  });

  it("rolls back a failed timeline write so tracking can recover without a resend", async () => {
    const prepared = mockDatabase();
    prepared.failNextTimeline();
    getDb.mockResolvedValue(prepared.db);

    await expect(recordOfferSigningOutcome(input)).resolves.toEqual({ recorded: false, warning });
    expect(prepared.committed).toHaveLength(0);
    expect(prepared.claimedKeys).toHaveLength(0);

    await expect(recordOfferSigningOutcome(input)).resolves.toEqual({ recorded: true });
    expect(prepared.committed).toHaveLength(2);
    expect(prepared.claimedKeys).toContain("offer-outcome:42:request-abc");
  });

  it("deduplicates a replay without appending another timeline row", async () => {
    const prepared = mockDatabase();
    getDb.mockResolvedValue(prepared.db);

    await expect(recordOfferSigningOutcome(input)).resolves.toEqual({ recorded: true });
    await expect(recordOfferSigningOutcome(input)).resolves.toEqual({ recorded: false });
    expect(prepared.transactionCalls()).toBe(2);
    expect(prepared.committed).toHaveLength(2);
  });

  it("returns recorded false for a duplicate claim nested in transaction causes", async () => {
    getDb.mockResolvedValue({ transaction: vi.fn().mockRejectedValue(duplicateError(true)) });

    await expect(recordOfferSigningOutcome(input)).resolves.toEqual({ recorded: false });
  });

  it("fails safe with the do-not-resend warning when persistence is unavailable", async () => {
    getDb.mockResolvedValue(null);

    await expect(recordOfferSigningOutcome(input)).resolves.toEqual({ recorded: false, warning });
  });

  it("does not leak a database/provider error through the safe warning", async () => {
    getDb.mockRejectedValue(new Error("TiDB provider secret host timed out"));

    const result = await recordOfferSigningOutcome(input);
    expect(result).toEqual({ recorded: false, warning });
    expect(result.warning).not.toContain("TiDB");
    expect(result.warning).not.toContain("provider");
  });

  it("preserves acceptable SMS reasons, redacts human-readable input, and omits absent reasons", async () => {
    const prepared = mockDatabase();
    getDb.mockResolvedValue(prepared.db);

    await recordOfferSigningOutcome(input);
    await recordOfferSigningOutcome({
      ...input,
      requestKey: "human-reason",
      smsReason: "No mobile phone number on file",
    });
    await recordOfferSigningOutcome({
      ...input,
      requestKey: "absent-reason",
      smsReason: undefined,
      actor: { id: 8, name: null, email: null },
    });

    const firstDetails = JSON.parse(String(prepared.committed[1].values.details));
    const humanDetails = JSON.parse(String(prepared.committed[3].values.details));
    const absentClaim = JSON.parse(String(prepared.committed[4].values.bodyPreview));
    const absentDetails = JSON.parse(String(prepared.committed[5].values.details));
    expect(firstDetails.smsReason).toBe("missing_phone");
    expect(humanDetails.smsReason).toBe("redacted");
    expect(absentClaim).not.toHaveProperty("smsReason");
    expect(absentDetails).not.toHaveProperty("smsReason");
    expect(prepared.committed[5].values).toMatchObject({
      actorUserId: 8,
      actorName: null,
      actorEmail: null,
    });
  });
});
