import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createBirthdayInquiry: vi.fn().mockResolvedValue({ insertId: 1 }),
  getAllBirthdayInquiries: vi.fn().mockResolvedValue([]),
  updateBirthdayInquiry: vi.fn().mockResolvedValue(undefined),
  createPartnershipInquiry: vi.fn().mockResolvedValue({ insertId: 2 }),
  getAllPartnershipInquiries: vi.fn().mockResolvedValue([]),
  updatePartnershipInquiry: vi.fn().mockResolvedValue(undefined),
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

describe("partnership.submitInquiry", () => {
  it("should accept a valid Corporate Wellness inquiry", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.partnership.submitInquiry({
      partnershipType: "Corporate Wellness",
      organizationName: "Acme Corp",
      contactName: "Jane Smith",
      email: "jane@acme.com",
      proposal: "We would like to book monthly private sessions for our 50-person team.",
    });
    expect(result.success).toBe(true);
  });

  it("should accept a Media & Production inquiry with website", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.partnership.submitInquiry({
      partnershipType: "Media & Production",
      organizationName: "CBC Productions",
      contactName: "Alex Producer",
      email: "alex@cbc.ca",
      website: "https://cbc.ca",
      proposal: "We are producing a wellness segment and would love to feature AfroPuppyYoga.",
    });
    expect(result.success).toBe(true);
  });

  it("should reject inquiry with proposal that is too short", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.partnership.submitInquiry({
        partnershipType: "Local Business",
        organizationName: "Tiny Cafe",
        contactName: "Bob",
        email: "bob@cafe.com",
        proposal: "Hi",
      })
    ).rejects.toThrow();
  });

  it("should reject inquiry with invalid email", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.partnership.submitInquiry({
        partnershipType: "Brand Collaboration",
        organizationName: "Brand Co",
        contactName: "Sam",
        email: "not-an-email",
        proposal: "We want to collaborate on a product placement campaign at your classes.",
      })
    ).rejects.toThrow();
  });
});

describe("partnership.getAll", () => {
  it("should allow admin to get all inquiries", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.partnership.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should reject non-admin access", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.partnership.getAll()).rejects.toThrow();
  });
});

describe("partnership.updateStatus", () => {
  it("should allow admin to update status", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.partnership.updateStatus({ id: 1, status: "reviewing" });
    expect(result.success).toBe(true);
  });

  it("should reject non-admin status update", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.partnership.updateStatus({ id: 1, status: "active" })
    ).rejects.toThrow();
  });
});
