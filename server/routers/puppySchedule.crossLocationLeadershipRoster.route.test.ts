import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("../db", () => ({ getDb }));
vi.mock("../email", () => ({ sendEmail: vi.fn(), buildBreederConfirmationEmail: vi.fn() }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed: vi.fn() }));

import { puppyScheduleRouter } from "./puppySchedule";

function createDb(responses: unknown[]) {
  const db = {
    select: vi.fn(() => {
      const result = responses.shift() ?? [];
      const query: any = {
        from: () => query,
        where: () => query,
        orderBy: () => Promise.resolve(result),
        limit: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
  };
  return db;
}

const caller = () => puppyScheduleRouter.createCaller({
  user: { openId: "owner", name: "Ay Bello", email: "owner@example.com", role: "admin" },
} as never);

describe("listWithStaffing cross-location leadership roster", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists every active, available Operations Manager and Yoga Instructor regardless of home location", async () => {
    const db = createDb([
      [{ id: 77, scheduleStatus: "scheduled", classDate: "2026-09-12", location: "Kitchener" }],
      [],
      [
        { id: 15, name: "Hamilton Operations", role: "Operations Manager", location: "HAM", status: "onboarded", isTeamMember: true, deletedAt: null },
        { id: 16, name: "Oakville Yoga", role: "yoga_instructor", location: "OAK", status: "onboarded", isTeamMember: true, deletedAt: null },
        { id: 17, name: "Away Operations", role: "Operations Manager", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null },
      ],
      [{ staffId: 17, startDate: "2026-09-12", endDate: "2026-09-12", status: "approved" }],
      [],
    ]);
    getDb.mockResolvedValue(db);

    const [schedule] = await caller().listWithStaffing();

    expect(schedule.staffing.eligibleOperationsManagers).toEqual([{ id: 15, name: "Hamilton Operations" }]);
    expect(schedule.staffing.eligibleYogaInstructors).toEqual([{ id: 16, name: "Oakville Yoga" }]);
  });
});
