import { describe, expect, it, vi } from "vitest";
import { classStaffAssignments, jobApplicationActions, weekendLeadershipCoverage } from "../drizzle/schema";
import { retireDutiesOutsideNewRole } from "./employeeRoleChange";

const actor = { id: 1, name: "Owner", email: "owner@example.com" };

/**
 * Minimal transaction double. `reads` supplies, in order, the upcoming class
 * assignments then the upcoming leadership coverage for the person being moved.
 */
function mockTx(upcomingAssignments: unknown[], upcomingCoverage: unknown[]) {
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const deletes: unknown[] = [];
  const reads = [upcomingAssignments, upcomingCoverage];
  const tx: any = {
    select: vi.fn(() => {
      let result: unknown[] = [];
      const chain: any = {
        from: () => { result = reads.shift() ?? []; return chain; },
        innerJoin: () => chain,
        where: async () => result,
        then: (resolve: (value: unknown[]) => void) => resolve(result),
      };
      return chain;
    }),
    insert: vi.fn((table) => ({ values: async (values: Record<string, unknown>) => { inserts.push({ table, values }); } })),
    update: vi.fn((table) => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push({ table, values }); } }) })),
    delete: vi.fn((table) => ({ where: async () => { deletes.push(table); } })),
  };
  return { tx, inserts, updates, deletes };
}

const monitorDuty = { id: 501, scheduleId: 90, staffId: 42, staffName: "Example Employee", classDate: "2099-01-03" };
const managerCoverage = { id: 601, coverageDate: "2099-01-03", location: "KW", role: "Operations Manager", coverageStaffId: 42, coverageStaffName: "Example Employee" };
const instructorCoverage = { id: 602, coverageDate: "2099-01-04", location: "KW", role: "Yoga Instructor", coverageStaffId: 42, coverageStaffName: "Example Employee" };

describe("retiring duties the new position cannot cover", () => {
  it("removes upcoming class assignments when a Puppy Monitor moves to another position", async () => {
    const { tx, inserts, deletes } = mockTx([monitorDuty], []);
    const result = await retireDutiesOutsideNewRole(tx, 42, "Operations Specialist", actor);

    expect(result).toEqual({ retiredClassAssignments: 1, releasedLeadershipCoverage: 0 });
    expect(deletes).toContain(classStaffAssignments);
    const audit = inserts.find((entry) => entry.table === jobApplicationActions);
    expect(audit?.values).toMatchObject({ applicationId: 42, action: "staff_duties_retired_role_change", actorUserId: 1 });
    // The retired duty is preserved in history rather than silently dropped.
    expect(String(audit?.values.details)).toContain("501");
  });

  it("keeps upcoming class assignments when the person stays a Puppy Monitor", async () => {
    const { tx, inserts, deletes } = mockTx([monitorDuty], []);
    const result = await retireDutiesOutsideNewRole(tx, 42, "Puppy Monitor", actor);

    expect(result).toEqual({ retiredClassAssignments: 0, releasedLeadershipCoverage: 0 });
    expect(deletes).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("opens weekend leadership coverage the new position cannot hold", async () => {
    const { tx, updates } = mockTx([], [managerCoverage]);
    const result = await retireDutiesOutsideNewRole(tx, 42, "Puppy Monitor", actor);

    expect(result).toEqual({ retiredClassAssignments: 0, releasedLeadershipCoverage: 1 });
    const released = updates.find((entry) => entry.table === weekendLeadershipCoverage);
    // Cleared to null so the staffing gap stays visible for reassignment.
    expect(released?.values).toEqual({ coverageStaffId: null, coverageStaffName: null });
  });

  it("keeps only the coverage the new position can still hold", async () => {
    const { tx, updates } = mockTx([], [managerCoverage, instructorCoverage]);
    const result = await retireDutiesOutsideNewRole(tx, 42, "Yoga Instructor", actor);

    // Operations Manager coverage is released; Yoga Instructor coverage stays.
    expect(result).toEqual({ retiredClassAssignments: 0, releasedLeadershipCoverage: 1 });
    expect(updates).toHaveLength(1);
  });

  it("changes nothing when the person has no upcoming duties", async () => {
    const { tx, inserts, updates, deletes } = mockTx([], []);
    const result = await retireDutiesOutsideNewRole(tx, 42, "Operations Manager", actor);

    expect(result).toEqual({ retiredClassAssignments: 0, releasedLeadershipCoverage: 0 });
    expect([...inserts, ...updates, ...deletes]).toHaveLength(0);
  });

  it("retires both duty types in one move and records who made it", async () => {
    const { tx, inserts, updates, deletes } = mockTx([monitorDuty], [managerCoverage]);
    const result = await retireDutiesOutsideNewRole(tx, 42, "BDR", actor);

    expect(result).toEqual({ retiredClassAssignments: 1, releasedLeadershipCoverage: 1 });
    expect(deletes).toContain(classStaffAssignments);
    expect(updates.some((entry) => entry.table === weekendLeadershipCoverage)).toBe(true);
    expect(inserts.some((entry) => entry.values.actorEmail === "owner@example.com")).toBe(true);
  });
});
