import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const { getDashboardOverview, resolveApyAccess } = vi.hoisted(() => ({
  getDashboardOverview: vi.fn(),
  resolveApyAccess: vi.fn(),
}));

vi.mock("../dashboardAnalytics", () => ({ getDashboardOverview }));
vi.mock("../apyAccess", () => ({ resolveApyAccess }));

import { dashboardRouter } from "./dashboard";

beforeEach(() => {
  getDashboardOverview.mockReset();
  resolveApyAccess.mockReset();
});

function context(user: { role: string } | null) {
  const headers: Array<[string, string]> = [];
  return {
    headers,
    ctx: {
      user: user ? {
        id: 1,
        openId: "test-user",
        name: "Test User",
        email: "test@example.com",
        loginMethod: "test",
        role: user.role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } : null,
      req: {} as never,
      res: { setHeader: (name: string, value: string) => headers.push([name, value]) } as never,
    },
  };
}

describe("dashboard router", () => {
  it("allows only the owner to receive aggregate data and no-store response headers", async () => {
    const payload = { summary: { totalTickets: 12 }, source: { revenueStatus: "estimated" } };
    getDashboardOverview.mockResolvedValue(payload);
    resolveApyAccess.mockResolvedValue({ level: "owner", teamMember: null, canManageOperations: true });
    const request = context({ role: "admin" });

    await expect(dashboardRouter.createCaller(request.ctx).overview()).resolves.toEqual(payload);
    expect(getDashboardOverview).toHaveBeenCalledOnce();
    expect(request.headers).toEqual(expect.arrayContaining([
      ["Cache-Control", "private, no-store, max-age=0"],
      ["Pragma", "no-cache"],
    ]));
  });

  it("rejects unauthenticated and non-owner callers", async () => {
    await expect(dashboardRouter.createCaller(context(null).ctx).overview()).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });

    resolveApyAccess.mockResolvedValue({ level: "operations_manager", teamMember: null, canManageOperations: true });
    await expect(dashboardRouter.createCaller(context({ role: "staff" }).ctx).overview()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
    expect(getDashboardOverview).not.toHaveBeenCalled();
  });
});
