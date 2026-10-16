import { describe, expect, it, vi } from "vitest";
import { classStaffAssignments, jobApplicationActions, weekendLeadershipCoverage } from "../drizzle/schema";
import { getTorontoCalendarDate } from "../shared/scheduleVisibility";
import { retireDutiesOutsideNewRole } from "./employeeRoleChange";

const actor = { id: 1, name: "Owner", email: "owner@example.com" };

/**
 * Transaction double that records the real `where` predicates, so a test fails
 * if the date filter or the row targeting is removed.
 */
function mockTx(upcomingAssignments: unknown[], upcomingCoverage: unknown[], options: { failAudit?: boolean } = {}) {
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown>; where: unknown }> = [];
  const deletes: Array<{ table: unknown; where: unknown }> = [];
  const selectPredicates: unknown[] = [];
  const reads = [upcomingAssignments, upcomingCoverage];
  const tx: any = {
    select: vi.fn(() => {
      let result: unknown[] = [];
      const chain: any = {
        from: () => { result = reads.shift() ?? []; return chain; },
        innerJoin: () => chain,
        where: async (predicate: unknown) => { selectPredicates.push(predicate); return result; },
        then: (resolve: (value: unknown[]) => void) => resolve(result),
      };
      return chain;
    }),
    insert: vi.fn((table) => ({ values: async (values: Record<string, unknown>) => {
      if (options.failAudit) throw new Error("audit write failed");
      inserts.push({ table, values });
    } })),
    update: vi.fn((table) => ({ set: (values: Record<string, unknown>) => ({ where: async (where: unknown) => { updates.push({ table, values, where }); } }) })),
    delete: vi.fn((table) => ({ where: async (where: unknown) => { deletes.push({ table, where }); } })),
  };
  return { tx, inserts, updates, deletes, selectPredicates };
}

/** Drizzle predicates are circular, so read their bound values directly. */
function boundValues(node: any, out: Array<string | number> = [], depth = 0): Array<string | number> {
  if (!node || typeof node !== "object" || depth > 8) return out;
  if ("value" in node && (typeof node.value === "string" || typeof node.value === "number")) out.push(node.value);
  for (const key of ["queryChunks", "left", "right", "params"]) {
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => boundValues(child, out, depth + 1));
    else if (value) boundValues(value, out, depth + 1);
  }
  return out;
}

const monitorDuty = { id: 501, scheduleId: 90, staffId: 42, staffName: "Example Employee", classDate: "2099-01-03" };
const secondMonitorDuty = { id: 502, scheduleId: 91, staffId: 42, staffName: "Example Employee", classDate: "2099-01-04" };
const managerCoverage = { id: 601, coverageDate: "2099-01-03", location: "KW", role: "Operations Manager", coverageStaffId: 42, coverageStaffName: "Example Employee" };
const instructorCoverage = { id: 602, coverageDate: "2099-01-04", location: "KW", role: "Yoga Instructor", coverageStaffId: 42, coverageStaffName: "Example Employee" };

describe("retiring duties the new position cannot cover", () => {
  it("removes upcoming class assignments when a Puppy Monitor moves to another position", async () => {
    const { tx, inserts, deletes } = mockTx([monitorDuty], []);
    const result = await retireDutiesOutsideNewRole(tx, 42, "Operations Specialist", actor);

    expect(result).toEqual({ retiredClassAssignments: 1, releasedLeadershipCoverage: 0 });
    expect(deletes.map((entry) => entry.table)).toEqual([classStaffAssignments]);
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
    expect(deletes.map((entry) => entry.table)).toEqual([classStaffAssignments]);
    expect(updates.some((entry) => entry.table === weekendLeadershipCoverage)).toBe(true);
    expect(inserts.some((entry) => entry.values.actorEmail === "owner@example.com")).toBe(true);
  });
});

describe("targeting and boundaries", () => {
  it("only ever looks at duties dated today or later, for this person", async () => {
    // Regression guard: removing the date filter or the staff filter would make
    // this fail, so past duties can never be rewritten by a position change.
    const { tx, selectPredicates } = mockTx([], []);
    await retireDutiesOutsideNewRole(tx, 42, "Operations Specialist", actor);

    expect(selectPredicates).toHaveLength(2);
    const today = getTorontoCalendarDate();
    for (const predicate of selectPredicates) {
      const values = boundValues(predicate);
      expect(values).toContain(today);
      expect(values).toContain(42);
    }
  });

  it("deletes and releases exactly the rows it retired", async () => {
    const { tx, updates, deletes } = mockTx([monitorDuty, secondMonitorDuty], [managerCoverage]);
    await retireDutiesOutsideNewRole(tx, 42, "Operations Manager", actor);

    // Two class assignments retired, each targeted by its own row predicate.
    expect(deletes).toHaveLength(2);
    expect(boundValues(deletes[0].where)).toContain(501);
    expect(boundValues(deletes[1].where)).toContain(502);
    // Operations Manager keeps its own coverage, so nothing is released.
    expect(updates).toHaveLength(0);
  });

  it("releases the specific coverage row rather than all of a person's coverage", async () => {
    const { tx, updates } = mockTx([], [managerCoverage, instructorCoverage]);
    await retireDutiesOutsideNewRole(tx, 42, "Operations Manager", actor);

    expect(updates).toHaveLength(1);
    expect(boundValues(updates[0].where)).toContain(602);
  });

  it("fails loudly instead of silently dropping duties when the audit cannot be written", async () => {
    // The caller runs inside a transaction, so this rolls the whole move back
    // rather than deleting duties with no history of what happened.
    const { tx, deletes, updates } = mockTx([monitorDuty], [managerCoverage], { failAudit: true });
    await expect(retireDutiesOutsideNewRole(tx, 42, "BDR", actor)).rejects.toThrow("audit write failed");
    expect(deletes).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("still records the retirement when no actor is supplied", async () => {
    const { tx, inserts } = mockTx([monitorDuty], []);
    await retireDutiesOutsideNewRole(tx, 42, "BDR");

    expect(inserts[0].values).toMatchObject({ actorUserId: null, actorName: null, actorEmail: null });
  });
});
