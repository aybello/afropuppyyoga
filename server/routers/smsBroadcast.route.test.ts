import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, smsCreate, isSmsSuppressed } = vi.hoisted(() => ({
  getDb: vi.fn(),
  smsCreate: vi.fn(),
  isSmsSuppressed: vi.fn(),
}));

vi.mock("../db", () => ({ getDb }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed }));
vi.mock("twilio", () => ({ default: () => ({ messages: { create: smsCreate } }) }));

import { smsBroadcastRouter } from "./smsBroadcast";

function createDb(options?: { claimFails?: boolean }) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  return {
    inserts,
    updates,
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((value) => {
          inserts.push(value);
          if (options?.claimFails) return Promise.reject(new Error("duplicate key"));
          return Promise.resolve();
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((value) => {
          updates.push(value);
          return { where: vi.fn(() => Promise.resolve()) };
        }),
      })),
    },
  };
}

const caller = () => smsBroadcastRouter.createCaller({
  user: { id: 1, openId: "owner", name: "APY Owner", email: "owner@example.com", role: "admin" },
} as never);

describe("durable SMS broadcast claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = "AC-test";
    process.env.TWILIO_AUTH_TOKEN = "token-test";
    process.env.TWILIO_PHONE_NUMBER = "+15550001111";
    isSmsSuppressed.mockResolvedValue(false);
    smsCreate.mockResolvedValue({ sid: "SM-test", status: "queued" });
  });

  it("claims a single send before Twilio and records the provider result", async () => {
    const prepared = createDb();
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().sendSingle({
      phone: "289-555-0100",
      message: "APY message",
      requestKey: "5d4ccbd3-83e4-44c1-b44e-29a87fc73f2a",
    })).resolves.toMatchObject({ success: true, sid: "SM-test" });

    expect(smsCreate).toHaveBeenCalledOnce();
    expect(prepared.inserts[0]).toMatchObject({ deliveryStatus: "processing", action: "manual_broadcast" });
    expect(prepared.updates).toContainEqual({ deliveryStatus: "queued", providerMessageId: "SM-test" });
  });

  it("does not call Twilio when an identical single-send claim already exists", async () => {
    const prepared = createDb({ claimFails: true });
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().sendSingle({
      phone: "289-555-0100",
      message: "APY message",
      requestKey: "5d4ccbd3-83e4-44c1-b44e-29a87fc73f2a",
    })).rejects.toThrow("already being processed");
    expect(smsCreate).not.toHaveBeenCalled();
  });
});
