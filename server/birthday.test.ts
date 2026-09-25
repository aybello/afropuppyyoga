import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getAllBirthdayInquiries: vi.fn().mockResolvedValue([]),
  updateBirthdayInquiry: vi.fn().mockResolvedValue(undefined),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@afropuppyyoga.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  };
}

describe("birthday.submitInquiry", () => {
  it("rejects the retired public intake even when old clients send valid input", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.birthday.submitInquiry({
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "519-000-0000",
      preferredDate: "2026-06-14",
      location: "KW",
      tier: "Basic",
      groupSize: 6,
      message: "Looking forward to it!",
    })).rejects.toThrow("Birthday intake has moved to the private event quote workflow");
  });

  it("still validates malformed legacy input before the tombstone handler", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.birthday.submitInquiry({
      name: "Small Group",
      email: "small@example.com",
      preferredDate: "2026-06-14",
      location: "KW",
      tier: "Basic",
      groupSize: 3,
    })).rejects.toThrow();
  });
});

describe("birthday.getAll", () => {
  it("allows admin to view historical birthday inquiries", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.birthday.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects non-admin access", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.birthday.getAll()).rejects.toThrow();
  });
});
