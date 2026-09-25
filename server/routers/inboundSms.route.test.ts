import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, smsCreate, isSmsSuppressed } = vi.hoisted(() => ({
  getDb: vi.fn(),
  smsCreate: vi.fn(),
  isSmsSuppressed: vi.fn(),
}));

vi.mock("../db", () => ({ getDb }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed }));
vi.mock("twilio", () => ({ default: () => ({ messages: { create: smsCreate } }) }));

import { getInboundReplyIdempotencyKey, inboundSmsRouter, isDefinitiveTwilioRejection } from "./inboundSms";

const inboundMessage = {
  id: 27,
  fromPhone: "+12895550100",
  toPhone: "+12897881885",
  body: "Can you confirm the drop-off time?",
  twilioSid: "SM-inbound",
  breederId: 42,
  breederName: "Happy Tails Kennels",
  isRead: 0,
  receivedAt: new Date("2026-09-25T12:00:00.000Z"),
  createdAt: new Date("2026-09-25T12:00:00.000Z"),
};

function createDb(options?: { lockFails?: boolean; claimFails?: boolean; completionFails?: boolean; replyStatus?: string | null }) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const deletes: unknown[] = [];
  return {
    inserts,
    updates,
    deletes,
    db: {
      select: vi.fn((projection?: { deliveryStatus?: unknown }) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(projection?.deliveryStatus
              ? options?.replyStatus ? [{ deliveryStatus: options.replyStatus }] : []
              : [inboundMessage])),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((value) => {
          inserts.push(value);
          const isLock = typeof value === "object" && value !== null && "inboundSmsId" in value;
          if ((isLock && options?.lockFails) || (!isLock && options?.claimFails)) return Promise.reject(new Error("duplicate key"));
          return Promise.resolve();
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn((value) => {
          deletes.push(value);
          return Promise.resolve();
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((value) => {
          updates.push(value);
          return { where: vi.fn(() => options?.completionFails ? Promise.reject(new Error("temporary database error")) : Promise.resolve()) };
        }),
      })),
    },
  };
}

const caller = () => inboundSmsRouter.createCaller({
  user: { id: 1, openId: "owner", name: "APY Owner", email: "owner@example.com", role: "admin" },
} as never);
const attemptId = "5d4ccbd3-83e4-44c1-b44e-29a87fc73f2a";

describe("SMS Inbox business-number replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = "AC-test";
    process.env.TWILIO_AUTH_TOKEN = "token-test";
    process.env.TWILIO_PHONE_NUMBER = "+12897881885";
    isSmsSuppressed.mockResolvedValue(false);
    smsCreate.mockResolvedValue({ sid: "SM-outbound", status: "queued" });
  });

  it("sends a reply to the exact inbound sender, then records the delivery", async () => {
    const prepared = createDb();
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().reply({
      messageId: inboundMessage.id,
      body: "Yes, drop-off is at 9:00 AM.",
      attemptId,
    })).resolves.toMatchObject({ success: true, to: "+12895550100", sid: "SM-outbound" });

    expect(smsCreate).toHaveBeenCalledWith({
      to: "+12895550100",
      from: "+12897881885",
      body: "Yes, drop-off is at 9:00 AM.",
    });
    expect(prepared.inserts[0]).toMatchObject({
      inboundSmsId: 27,
      bodyHash: expect.any(String),
    });
    expect(prepared.inserts[1]).toMatchObject({
      entityType: "breeder",
      entityId: 42,
      action: "inbound_reply",
      recipient: "+12895550100",
      deliveryStatus: "processing",
      idempotencyKey: getInboundReplyIdempotencyKey(inboundMessage.id, attemptId),
    });
    expect(prepared.updates).toContainEqual({ deliveryStatus: "queued", providerMessageId: "SM-outbound" });
    expect(prepared.updates).toContainEqual({ isRead: 1 });
    expect(prepared.deletes).toHaveLength(0);
  });

  it("returns the durable status only for the inbox reply idempotency key", async () => {
    const prepared = createDb({ replyStatus: "failed" });
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().replyStatus({ messageId: inboundMessage.id, attemptId })).resolves.toEqual({
      found: true,
      deliveryStatus: "failed",
    });
  });

  it("does not call Twilio when another device holds the inbound-message reply lock, even with a different attempt ID", async () => {
    const prepared = createDb({ lockFails: true });
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().reply({
      messageId: inboundMessage.id,
      body: "Already sent.",
      attemptId: "6f9c997b-8ccb-4266-aa5b-b6dfe8bda899",
    })).rejects.toThrow("No duplicate SMS will be sent");

    expect(smsCreate).not.toHaveBeenCalled();
  });

  it("reports success when Twilio accepts the reply but post-send audit updates fail", async () => {
    const prepared = createDb({ completionFails: true });
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().reply({
      messageId: inboundMessage.id,
      body: "Twilio accepted this message.",
      attemptId,
    })).resolves.toMatchObject({ success: true, sid: "SM-outbound", status: "queued" });

    expect(smsCreate).toHaveBeenCalledOnce();
    expect(prepared.updates).not.toContainEqual({ deliveryStatus: "failed" });
  });

  it("keeps ambiguous Twilio failures claimed so they cannot be resent blindly", async () => {
    const prepared = createDb();
    getDb.mockResolvedValue(prepared.db);
    smsCreate.mockRejectedValue(new Error("socket timeout"));

    await expect(caller().reply({
      messageId: inboundMessage.id,
      body: "Do not duplicate this reply.",
      attemptId,
    })).rejects.toThrow("did not confirm the reply outcome");

    expect(prepared.updates).not.toContainEqual({ deliveryStatus: "failed" });
  });

  it("classifies only provider 4xx failures as definite rejections", () => {
    expect(isDefinitiveTwilioRejection({ status: 400 })).toBe(true);
    expect(isDefinitiveTwilioRejection({ status: 429 })).toBe(true);
    expect(isDefinitiveTwilioRejection({ status: 500 })).toBe(false);
    expect(isDefinitiveTwilioRejection(new Error("socket timeout"))).toBe(false);
  });

  it("does not send a reply to a number that has opted out", async () => {
    const prepared = createDb();
    getDb.mockResolvedValue(prepared.db);
    isSmsSuppressed.mockResolvedValue(true);

    await expect(caller().reply({
      messageId: inboundMessage.id,
      body: "This cannot be sent.",
      attemptId,
    })).rejects.toThrow("opted out");

    expect(prepared.inserts).toHaveLength(0);
    expect(smsCreate).not.toHaveBeenCalled();
  });

  it("does not claim a reply when Twilio is not configured", async () => {
    const prepared = createDb();
    getDb.mockResolvedValue(prepared.db);
    delete process.env.TWILIO_ACCOUNT_SID;

    await expect(caller().reply({
      messageId: inboundMessage.id,
      body: "This cannot be claimed.",
      attemptId,
    })).rejects.toThrow("Twilio credentials are not configured");

    expect(prepared.inserts).toHaveLength(0);
    expect(smsCreate).not.toHaveBeenCalled();
  });
});
