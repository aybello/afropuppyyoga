import { beforeEach, describe, expect, it, vi } from "vitest";
import { communicationsLog, jobApplicationActions } from "../drizzle/schema";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));

import { recordInterviewInviteOutcome } from "./interviewInviteAudit";

type Write = { table: unknown; values: Record<string, unknown> };

function duplicateError(wrapped = false): unknown {
  const duplicate = Object.assign(new Error("duplicate key"), { code: "ER_DUP_ENTRY" });
  return wrapped ? new Error("transaction failed", { cause: new Error("query failed", { cause: duplicate }) }) : duplicate;
}

function mockDatabase() {
  const committed: Write[] = [];
  const claimedKeys = new Set<string>();
  let failTimeline = false;
  let transactionCalls = 0;

  const db = {
    transaction: vi.fn(async (callback: (tx: { insert: (table: unknown) => { values: (values: Record<string, unknown>) => Promise<void> } }) => Promise<void>) => {
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
    }),
  };

  return {
    db,
    committed,
    claimedKeys,
    failNextTimeline: () => { failTimeline = true; },
    transactionCalls: () => transactionCalls,
  };
}

const input = {
  applicationId: 42,
  requestKey: "request-abc",
  actor: { id: 7, name: "Hiring Owner", email: "owner@example.com" },
  fromStatus: "new",
  toStatus: "interview_requested",
  bookingLink: "https://calendar.example/book/42",
  emailStatus: "sent",
  smsStatus: "skipped",
  smsReason: "missing_phone",
};

beforeEach(() => {
  getDb.mockReset();
});

describe("recordInterviewInviteOutcome", () => {
  it("writes the outcome claim and timeline entry in one transaction", async () => {
    const prepared = mockDatabase();
    getDb.mockResolvedValue(prepared.db);

    await expect(recordInterviewInviteOutcome(input)).resolves.toEqual({ recorded: true });
    expect(prepared.db.transaction).toHaveBeenCalledTimes(1);
    expect(prepared.committed).toHaveLength(2);

    expect(prepared.committed[0]).toMatchObject({
      table: communicationsLog,
      values: {
        idempotencyKey: "interview-outcome:42:request-abc",
        entityType: "job_application",
        entityId: 42,
        channel: "system",
        direction: "system",
        action: "interview_invite_outcome",
        deliveryStatus: "recorded",
        recipient: null,
        subject: "Interview invitation outcome",
        actorUserId: 7,
        actorName: "Hiring Owner",
      },
    });
    expect(JSON.parse(String(prepared.committed[0].values.bodyPreview))).toEqual({
      fromStatus: "new",
      toStatus: "interview_requested",
      emailStatus: "sent",
      smsStatus: "skipped",
      smsReason: "missing_phone",
    });

    expect(prepared.committed[1]).toMatchObject({
      table: jobApplicationActions,
      values: {
        applicationId: 42,
        action: "interview_invite_sent",
        fromStatus: "new",
        toStatus: "interview_requested",
        actorUserId: 7,
        actorName: "Hiring Owner",
        actorEmail: "owner@example.com",
      },
    });
    expect(JSON.parse(String(prepared.committed[1].values.details))).toEqual({
      requestKey: "request-abc",
      bookingLink: "https://calendar.example/book/42",
      emailStatus: "sent",
      smsStatus: "skipped",
      smsReason: "missing_phone",
    });
  });

  it("rolls back the claim when the timeline insert fails, allowing the same key to recover", async () => {
    const prepared = mockDatabase();
    prepared.failNextTimeline();
    getDb.mockResolvedValue(prepared.db);

    await expect(recordInterviewInviteOutcome(input)).resolves.toEqual({
      recorded: false,
      warning: "Invitation accepted for sending, but its timeline could not be saved. Do not resend.",
    });
    expect(prepared.committed).toHaveLength(0);
    expect(prepared.claimedKeys).toHaveLength(0);

    await expect(recordInterviewInviteOutcome(input)).resolves.toEqual({ recorded: true });
    expect(prepared.committed).toHaveLength(2);
  });

  it("treats a replay as already handled and does not append a duplicate timeline row", async () => {
    const prepared = mockDatabase();
    getDb.mockResolvedValue(prepared.db);

    await expect(recordInterviewInviteOutcome(input)).resolves.toEqual({ recorded: true });
    await expect(recordInterviewInviteOutcome(input)).resolves.toEqual({ recorded: false });
    expect(prepared.transactionCalls()).toBe(2);
    expect(prepared.committed).toHaveLength(2);
  });

  it("recognizes a duplicate code nested through transaction causes", async () => {
    getDb.mockResolvedValue({ transaction: vi.fn().mockRejectedValue(duplicateError(true)) });

    await expect(recordInterviewInviteOutcome(input)).resolves.toEqual({ recorded: false });
  });

  it("returns the safe warning when the database is unavailable", async () => {
    getDb.mockResolvedValue(null);

    await expect(recordInterviewInviteOutcome(input)).resolves.toEqual({
      recorded: false,
      warning: "Invitation accepted for sending, but its timeline could not be saved. Do not resend.",
    });
  });

  it("does not expose a raw provider or database error in its warning", async () => {
    getDb.mockRejectedValue(new Error("TiDB provider secret host timed out"));

    const result = await recordInterviewInviteOutcome(input);
    expect(result.recorded).toBe(false);
    expect(result.warning).toBe("Invitation accepted for sending, but its timeline could not be saved. Do not resend.");
    expect(result.warning).not.toContain("TiDB");
    expect(result.warning).not.toContain("provider");
  });

  it("omits an absent SMS reason while preserving nullable actor identity", async () => {
    const prepared = mockDatabase();
    getDb.mockResolvedValue(prepared.db);

    await recordInterviewInviteOutcome({ ...input, smsReason: undefined, actor: { id: 8, name: null, email: null } });
    expect(prepared.committed[0].values).toMatchObject({ actorUserId: 8, actorName: null });
    expect(JSON.parse(String(prepared.committed[0].values.bodyPreview))).not.toHaveProperty("smsReason");
    expect(prepared.committed[1].values).toMatchObject({ actorUserId: 8, actorName: null, actorEmail: null });
    expect(JSON.parse(String(prepared.committed[1].values.details))).not.toHaveProperty("smsReason");
  });
});
