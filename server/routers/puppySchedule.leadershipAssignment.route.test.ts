import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("../db", () => ({ getDb }));
vi.mock("../email", () => ({ sendEmail: vi.fn(), buildBreederConfirmationEmail: vi.fn() }));
vi.mock("../smsConsent", () => ({ isSmsSuppressed: vi.fn() }));

import { puppyScheduleRouter } from "./puppySchedule";

const schedule = { id: 77, scheduleStatus: "scheduled", classDate: "2026-09-12", location: "Kitchener" };
const leadershipCandidate = {
  id: 15,
  name: "Alex Operations",
  role: "Operations Manager",
  location: "KW",
  status: "onboarded",
  isTeamMember: true,
  deletedAt: null,
};

function createDb(responses: unknown[]) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const db = {
    select: vi.fn(() => {
      const result = responses.shift() ?? [];
      const query: any = {
        from: () => query,
        where: () => query,
        limit: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
    insert: vi.fn(() => ({ values: vi.fn((value) => { inserts.push(value); return Promise.resolve(); }) })),
    update: vi.fn(() => ({ set: vi.fn((value) => { updates.push(value); return { where: vi.fn(() => Promise.resolve()) }; }) })),
  };
  return { db, inserts, updates };
}

const caller = () => puppyScheduleRouter.createCaller({ user: { openId: "owner", name: "Ay Bello", email: "owner@example.com", role: "admin" } } as never);

describe("assignLeadership mutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assigns an eligible Operations Manager as coverage for the selected class date and studio", async () => {
    const prepared = createDb([[schedule], [leadershipCandidate], [], []]);
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().assignLeadership({ scheduleId: 77, role: "Operations Manager", staffId: 15 })).resolves.toEqual({ success: true });
    expect(prepared.inserts).toEqual([{
      coverageDate: "2026-09-12",
      location: "KW",
      role: "Operations Manager",
      coverageStaffId: 15,
      coverageStaffName: "Alex Operations",
      notes: "Assigned from class staffing",
    }]);
  });

  it("rejects a leader whose role does not match the coverage role", async () => {
    const prepared = createDb([[schedule], [{ ...leadershipCandidate, role: "Yoga Instructor" }], []]);
    getDb.mockResolvedValue(prepared.db);

    await expect(caller().assignLeadership({ scheduleId: 77, role: "Operations Manager", staffId: 15 })).rejects.toThrow("Choose an active Operations Manager for this class.");
    expect(prepared.inserts).toEqual([]);
  });
});
