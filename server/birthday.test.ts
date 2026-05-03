import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the DB and notification helpers so tests don't need a real database
vi.mock("./db", () => ({
  createBirthdayInquiry: vi.fn().mockResolvedValue({ insertId: 1 }),
  getAllBirthdayInquiries: vi.fn().mockResolvedValue([]),
  updateBirthdayInquiry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
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
  it("should accept a valid Basic inquiry", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.birthday.submitInquiry({
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "519-000-0000",
      preferredDate: "2026-06-14",
      location: "KW",
      tier: "Basic",
      groupSize: 6,
      message: "Looking forward to it!",
    });
    expect(result.success).toBe(true);
  });

  it("should accept a valid Deluxe inquiry", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.birthday.submitInquiry({
      name: "Alex Johnson",
      email: "alex@example.com",
      preferredDate: "2026-07-05",
      location: "Hamilton",
      tier: "Deluxe",
      groupSize: 15,
    });
    expect(result.success).toBe(true);
  });

  it("should reject group size below 6", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.birthday.submitInquiry({
        name: "Small Group",
        email: "small@example.com",
        preferredDate: "2026-06-14",
        location: "KW",
        tier: "Basic",
        groupSize: 3,
      })
    ).rejects.toThrow();
  });

  it("should reject group size above 20", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.birthday.submitInquiry({
        name: "Big Group",
        email: "big@example.com",
        preferredDate: "2026-06-14",
        location: "Hamilton",
        tier: "Deluxe",
        groupSize: 25,
      })
    ).rejects.toThrow();
  });

  it("should reject invalid email", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.birthday.submitInquiry({
        name: "Bad Email",
        email: "not-an-email",
        preferredDate: "2026-06-14",
        location: "KW",
        tier: "Premium",
        groupSize: 8,
      })
    ).rejects.toThrow();
  });
});

describe("birthday.getAll", () => {
  it("should allow admin to get all inquiries", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.birthday.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should reject non-admin access", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.birthday.getAll()).rejects.toThrow();
  });
});
