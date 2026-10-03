import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { employees, jobApplications, classStaffAssignments, staffInvites, staffPhoneAccessCodes, staffingMutationLocks, users, weekendLeadershipCoverage } from "../drizzle/schema";

const { getDb, resolveApyAccess } = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("./db", () => ({ getDb, getUserByOpenId: vi.fn(), upsertUser: vi.fn() }));
vi.mock("./apyAccess", () => ({ resolveApyAccess }));
import { getRetiredClassAssignmentIds } from "./staffDutyHistory";
import { activateEmployeeWithAccess } from "./employeeActivation";
import { revokeTeamProfileAccess } from "./staffAccessRevocation";
import { getEventNotificationPreview, puppyScheduleRouter } from "./routers/puppySchedule";
import { staffAvailabilityRouter } from "./routers/staffAvailability";

const actor = { id: 1, name: "Owner", email: "owner@example.com" };
const person = { id: 42, name: "Example Employee", email: "employee@example.com", phone: "289-555-0100", role: "Puppy Monitor", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null };
const employee = { id: 7, sourceApplicationId: 42, ...actor, name: person.name, email: person.email, phone: person.phone, role: person.role, location: person.location, employmentStatus: "inactive", endedAt: new Date() };
// Keep employment primary key separate from actor identity.
employee.id = 7;

function mockDb(reads: unknown[][]) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const deletes: unknown[] = [];
  let nextId = 100;
  const db: any = {
    select: vi.fn(() => {
      let result: unknown[] = [];
      const chain: any = {
        from: (table: unknown) => { result = table === staffingMutationLocks ? [] : reads.shift() ?? []; return chain; },
        where: () => chain, orderBy: () => chain, innerJoin: () => chain,
        limit: async () => result,
        for: async () => [],
        then: (resolve: (value: unknown[]) => void) => resolve(result),
      };
      return chain;
    }),
    update: vi.fn((table) => ({ set: (values: Record<string, unknown>) => {
      updates.push({ table, values }); return { where: async () => [{ affectedRows: 1 }] };
    } })),
    insert: vi.fn((table) => ({ values: (values: Record<string, unknown>) => {
      inserts.push({ table, values });
      const result: any = [{ insertId: nextId++, affectedRows: 1 }];
      result.onDuplicateKeyUpdate = async () => result;
      return result;
    } })),
    delete: vi.fn((table) => { deletes.push(table); return { where: async () => undefined }; }),
  };
  db.transaction = vi.fn(async (callback) => callback(db));
  return { db, updates, inserts, deletes };
}
function context(authenticated = true) {
  return { user: authenticated ? { ...actor, openId: "owner", role: "admin", loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null, req: {} as never, res: {} as never } as any;
}
beforeEach(() => {
  getDb.mockReset();
  resolveApyAccess.mockReset().mockResolvedValue({ level: "owner", teamMember: null, canManageOperations: true });
});

describe("simple employee management", () => {
  it("deactivates linked capabilities immediately without requiring duty reassignment", async () => {
    const { db, updates, deletes } = mockDb([[person], [{ email: "previous@example.com" }]]);
    await expect(revokeTeamProfileAccess(db, 42, { isOwner: true, retainTeamMembership: true })).resolves.toMatchObject({ success: true });
    expect(db.select).toHaveBeenCalledTimes(4);
    expect(updates).toEqual(expect.arrayContaining([
      { table: jobApplications, values: { isTeamMember: true, deletedAt: expect.any(Date) } },
      { table: employees, values: { employmentStatus: "inactive", endedAt: expect.any(Date) } },
      { table: staffInvites, values: { isActive: 0 } },
      { table: users, values: { role: "user" } },
    ]));
    expect(deletes).toEqual([staffPhoneAccessCodes]);
    expect(deletes).not.toContain(employees);
  });

  it("retires future duties without blocking removal and preserves the original rows in history", async () => {
    const assignments = [{ id: 55, scheduleId: 10, staffId: 42, staffName: person.name, classDate: "2026-10-04" }];
    const coverage = [{ id: 8, coverageStaffId: 42, coverageStaffName: person.name, coverageDate: "2026-10-04", location: "KW", role: "Operations Manager" }];
    const harness = mockDb([[person], [], assignments, coverage]);
    await revokeTeamProfileAccess(harness.db, 42, { isOwner: true, actor });
    const audit = harness.inserts.find((item) => item.values.action === "staff_duties_retired");
    expect(JSON.parse(String(audit?.values.details))).toEqual({ classAssignments: assignments, leadershipCoverage: coverage });
    expect(harness.deletes).not.toContain(classStaffAssignments);
    expect(harness.updates).toContainEqual({ table: weekendLeadershipCoverage, values: { coverageStaffId: null, coverageStaffName: null } });
    const retired = await getRetiredClassAssignmentIds(mockDb([[{ details: String(audit?.values.details) }]]).db);
    expect(retired.has(55)).toBe(true);
    // Staffing views consult this permanent retirement marker, even after the
    // employee becomes active and a replacement has filled the class.
    const source = readFileSync(new URL("./routers/puppySchedule.ts", import.meta.url), "utf8");
    expect(source).toContain('!retiredIds.has(assignment.id)');
  });

  it("revokes access with retirement history larger than MySQL TEXT and preserves every retired ID", async () => {
    const assignments = Array.from({ length: 1500 }, (_, index) => ({ id: index + 1, scheduleId: 10, staffId: 42, staffName: "Example Employee", classDate: "2099-10-04" }));
    expect(Buffer.byteLength(JSON.stringify({ classAssignments: assignments }))).toBeGreaterThan(65_535);
    const harness = mockDb([[person], [], assignments, []]);
    await expect(revokeTeamProfileAccess(harness.db, 42, { isOwner: true, actor })).resolves.toMatchObject({ portalAccessRevoked: true });
    const logs = harness.inserts.filter((item) => item.values.action === "staff_duties_retired");
    expect(logs.length).toBeGreaterThan(1);
    for (const entry of logs) expect(Buffer.byteLength(String(entry.values.details), "utf8")).toBeLessThan(65_535);
    const retired = await getRetiredClassAssignmentIds(mockDb([logs.map((item) => ({ details: String(item.values.details) }))]).db);
    expect([...retired]).toEqual(assignments.map((item) => item.id));
    expect(harness.updates).toContainEqual({ table: employees, values: { employmentStatus: "inactive", endedAt: expect.any(Date) } });
  });

  it("keeps a replaced monitor retired even after they return to the original location", async () => {
    const schedule = { id: 10, scheduleStatus: "scheduled", classDate: "2099-10-04", location: "Kitchener", breed: "Example", startTime: "09:00", endTime: "10:00" };
    const original = { ...person, location: "OAK" };
    const replacement = { ...person, id: 43, name: "Replacement", email: "replacement@example.com" };
    const saved = { id: 55, staffId: 42, staffName: person.name, scheduleId: 10, role: "Puppy Monitor" };
    const assign = mockDb([[schedule], [replacement], [], [saved], [original, replacement], [], []]);
    getDb.mockResolvedValue(assign.db);
    await expect(puppyScheduleRouter.createCaller(context()).assignPuppyMonitor({ scheduleId: 10, staffId: 43 })).resolves.toMatchObject({ success: true });
    const retiredAudit = assign.inserts.find((entry) => entry.values.action === "staff_duties_retired");
    expect(JSON.parse(String(retiredAudit?.values.details))).toMatchObject({ classAssignments: [{ id: 55 }], reason: "replacement_assigned" });
    const returned = { ...person, location: "KW" };
    const previewDb = mockDb([[schedule], [returned, replacement], [], [], [saved, { id: 56, staffId: 43, staffName: replacement.name, scheduleId: 10 }], [], [{ details: String(retiredAudit?.values.details) }]]);
    const preview = await getEventNotificationPreview(previewDb.db, 10);
    expect(preview.recipients.map((recipient) => recipient.id)).toEqual([43]);
  });

  it.each(["Operations Manager", "Yoga Instructor"])("allows multiple %s employees at the same location", async (role) => {
    for (const index of [1, 2]) {
      const harness = mockDb([[], []]); getDb.mockResolvedValue(harness.db);
      await expect(staffAvailabilityRouter.createCaller(context()).createEmployeeRecord({ name: `Employee ${index}`, email: `person${index}@example.com`, phone: "", role: role as "Operations Manager" | "Yoga Instructor", location: "KW", startedAt: "2026-10-03" })).resolves.toMatchObject({ grantsApyHqAccess: true });
      expect(harness.inserts.find((entry) => entry.table === jobApplications)).toMatchObject({ table: jobApplications, values: { role, location: "KW", isTeamMember: true } });
    }
    const tree = readFileSync(new URL("../client/src/pages/StaffAvailability.tsx", import.meta.url), "utf8");
    expect(tree).toContain('trpc.staffAvailability.listEmployees.useQuery()');
    expect(tree).toContain('<EmployeeTeamTree employees={employees}');
  });

  it("does not remove another active employee's shared phone credentials", async () => {
    const { db, deletes } = mockDb([[person, { ...person, id: 43 }], []]);
    await revokeTeamProfileAccess(db, 42, { isOwner: true });
    expect(deletes).toEqual([]);
  });

  it("activates employment and login together without onboarding or a manager", async () => {
    const { db, updates, inserts } = mockDb([[employee], [{ ...person, isTeamMember: false, deletedAt: new Date(), onboardingSentAt: null }]]);
    await expect(activateEmployeeWithAccess(db, 7, actor, true)).resolves.toMatchObject({ grantsApyHqAccess: true });
    expect(updates).toEqual(expect.arrayContaining([
      { table: employees, values: { employmentStatus: "active", endedAt: null, sourceApplicationId: 42 } },
      { table: jobApplications, values: expect.objectContaining({ isTeamMember: true, deletedAt: null, status: "onboarded" }) },
    ]));
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(inserts).toEqual(expect.arrayContaining([{ table: expect.anything(), values: expect.objectContaining({ action: "employee_and_login_activated" }) }]));
    expect(updates.some((update) => update.table === staffInvites)).toBe(false);
  });

  it("creates a login profile for an unlinked employee during activation", async () => {
    const { db, updates, inserts } = mockDb([[{ ...employee, sourceApplicationId: null }], []]);
    await expect(activateEmployeeWithAccess(db, 7, actor, true)).resolves.toMatchObject({ sourceApplicationId: 100, grantsApyHqAccess: true });
    expect(inserts.find((entry) => entry.table === jobApplications)).toMatchObject({ table: jobApplications, values: { isTeamMember: true, status: "onboarded" } });
    expect(updates[0]).toMatchObject({ table: employees, values: { employmentStatus: "active", sourceApplicationId: 100 } });
  });

  it("requires a usable saved contact and fixed location, but accepts phone-only activation", async () => {
    for (const values of [{ email: "not-an-email", phone: null }, { location: "OTHER" }, { role: "BDR", location: "KW" }]) {
      const harness = mockDb([[{ ...employee, ...values }]]);
      await expect(activateEmployeeWithAccess(harness.db, 7, actor, true)).rejects.toThrow();
      expect(harness.updates).toEqual([]);
    }
    const harness = mockDb([[{ ...employee, email: "not-an-email" }], [person]]);
    await expect(activateEmployeeWithAccess(harness.db, 7, actor, true)).resolves.toMatchObject({ grantsApyHqAccess: true });
    expect(harness.updates[0].values).toMatchObject({ email: null, phone: "+12895550100" });
  });

  it("links an unlinked directory employee to their existing onboarded profile", async () => {
    const harness = mockDb([[{ ...employee, sourceApplicationId: null }], [{ ...person, isTeamMember: false, deletedAt: new Date() }], [employee]]);
    await expect(activateEmployeeWithAccess(harness.db, 7, actor, true)).resolves.toMatchObject({ sourceApplicationId: 42, grantsApyHqAccess: true });
    expect(harness.inserts.some((entry) => entry.table === jobApplications)).toBe(false);
    expect(harness.updates).toContainEqual({ table: employees, values: { employmentStatus: "active", endedAt: null, sourceApplicationId: 42 } });
  });

  it("does not bypass new-applicant onboarding when linking employee access", async () => {
    const harness = mockDb([[{ ...employee, sourceApplicationId: null }], [{ ...person, status: "accepted" }], []]);
    await expect(activateEmployeeWithAccess(harness.db, 7, actor, true)).rejects.toThrow("applicant");
    expect(harness.updates).toEqual([]);
  });

  it("rejects contacts or profiles already owned by another employee", async () => {
    let harness = mockDb([[employee], [person], [{ ...employee, id: 8, phone: "+12895550100" }]]);
    await expect(activateEmployeeWithAccess(harness.db, 7, actor, true)).rejects.toThrow("Employee Directory");
    expect(harness.updates).toEqual([]);
    harness = mockDb([[{ ...employee, sourceApplicationId: null }], [person], [{ ...employee, id: 8, email: "other@example.com", phone: null }]]);
    await expect(activateEmployeeWithAccess(harness.db, 7, actor, true)).rejects.toThrow("already linked");
    expect(harness.updates).toEqual([]);
  });

  it("rejects an already-linked profile owned by another directory record with different contacts", async () => {
    const harness = mockDb([[employee], [person], [{ ...employee, id: 8, email: "different@example.com", phone: null, sourceApplicationId: 42 }]]);
    await expect(activateEmployeeWithAccess(harness.db, 7, actor, true)).rejects.toThrow("already linked");
    expect(harness.updates).toEqual([]);
    expect(harness.inserts).toEqual([]);
  });

  it("retains contact validation and avoids duplicate login identities", async () => {
    const missing = mockDb([[{ ...employee, email: null, phone: null }]]);
    await expect(activateEmployeeWithAccess(missing.db, 7, actor, true)).rejects.toThrow("valid email");
    const duplicate = mockDb([[employee], [person, { ...person, id: 43 }]]);
    await expect(activateEmployeeWithAccess(duplicate.db, 7, actor, true)).rejects.toThrow("Another applicant");
    expect(duplicate.updates).toEqual([]);
  });

  it("lets an owner add a monitor without manager coverage or signed documents", async () => {
    const { db, inserts } = mockDb([[], [], [], []]); getDb.mockResolvedValue(db);
    await expect(staffAvailabilityRouter.createCaller(context()).createEmployeeRecord({ name: person.name, email: person.email, phone: "", role: "Puppy Monitor", location: "KW", startedAt: "2026-10-03" })).resolves.toMatchObject({ grantsApyHqAccess: true });
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(inserts.find((entry) => entry.table === jobApplications)).toMatchObject({ table: jobApplications, values: { isTeamMember: true, status: "onboarded" } });
  });

  it("makes the visible inactive, remove and activation routes work", async () => {
    let harness = mockDb([[person], []]); getDb.mockResolvedValue(harness.db);
    await expect(staffAvailabilityRouter.createCaller(context()).setTeamMemberActive({ id: 42, isActive: false })).resolves.toMatchObject({ portalAccessRevoked: true });
    harness = mockDb([[person], []]); getDb.mockResolvedValue(harness.db);
    await expect(staffAvailabilityRouter.createCaller(context()).removeTeamMember({ id: 42 })).resolves.toMatchObject({ success: true });
    harness = mockDb([[employee], [{ ...person, isTeamMember: false }]]); getDb.mockResolvedValue(harness.db);
    await expect(staffAvailabilityRouter.createCaller(context()).reactivateEmployeeEmployment({ employeeId: 7 })).resolves.toMatchObject({ grantsApyHqAccess: true });
  });

  it("lets owner edits move monitors or the sole manager without coverage prerequisites", async () => {
    for (const role of ["Puppy Monitor", "Operations Manager"]) {
      const harness = mockDb([[{ ...person, role }], [], [], []]); getDb.mockResolvedValue(harness.db);
      await expect(staffAvailabilityRouter.createCaller(context()).updateTeamMember({ id: 42, name: person.name, email: person.email, phone: "", role: "Yoga Instructor", location: "OAK" })).resolves.toMatchObject({ success: true });
      expect(harness.updates).toEqual(expect.arrayContaining([
        { table: employees, values: expect.objectContaining({ role: "Yoga Instructor", location: "OAK" }) },
        { table: jobApplications, values: expect.objectContaining({ role: "Yoga Instructor", location: "OAK" }) },
      ]));
    }
  });

  it("deactivates a linked employee from the Directory without another management screen", async () => {
    const harness = mockDb([[{ ...employee, employmentStatus: "active" }], [person], []]); getDb.mockResolvedValue(harness.db);
    await expect(staffAvailabilityRouter.createCaller(context()).markEmployeeDeparted({ employeeId: 7 })).resolves.toMatchObject({ success: true });
    expect(harness.updates).toEqual(expect.arrayContaining([{ table: employees, values: expect.objectContaining({ employmentStatus: "inactive" }) }]));
    expect(harness.deletes).toEqual([staffPhoneAccessCodes]);
  });

  it("serializes a directory edit with activation so login uses the current role and contact", async () => {
    let savedEmployee = { ...employee, role: "Operations Manager" };
    let savedProfile = { ...person, role: "Operations Manager" };
    let unlockEdit!: () => void;
    let markEditReading!: () => void;
    const editIsReading = new Promise<void>((resolve) => { markEditReading = resolve; });
    const releaseEdit = new Promise<void>((resolve) => { unlockEdit = resolve; });
    let queue: Promise<unknown> = Promise.resolve();
    let employeeReads = 0;
    const db: any = {
      select: () => {
        let table: unknown;
        const read = async () => {
          if (table === staffingMutationLocks) return [];
          if (table === employees) {
            employeeReads++;
            if (employeeReads === 1) { markEditReading(); await releaseEdit; }
            return [{ ...savedEmployee }];
          }
          return [{ ...savedProfile }];
        };
        const chain: any = { from: (value: unknown) => { table = value; return chain; }, where: () => chain,
          limit: read, for: async () => [], then: (resolve: (value: unknown) => void) => read().then(resolve) };
        return chain;
      },
      update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => {
        if (table === employees) savedEmployee = { ...savedEmployee, ...values };
        if (table === jobApplications) savedProfile = { ...savedProfile, ...values };
        return [{ affectedRows: 1 }];
      } }) }),
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
      transaction: (callback: (tx: unknown) => Promise<unknown>) => {
        const result = queue.then(() => callback(db)); queue = result.catch(() => undefined); return result;
      },
    };
    getDb.mockResolvedValue(db);
    const caller = staffAvailabilityRouter.createCaller(context());
    const edit = caller.updateEmployeeRecord({ id: 7, name: person.name, email: "changed@example.com", phone: "", role: "Puppy Monitor", location: "OAK" });
    await editIsReading;
    const activation = caller.reactivateEmployeeEmployment({ employeeId: 7 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(employeeReads).toBe(1);
    unlockEdit();
    await Promise.all([edit, activation]);
    expect(savedEmployee).toMatchObject({ role: "Puppy Monitor", location: "OAK", email: "changed@example.com", employmentStatus: "active" });
    expect(savedProfile).toMatchObject({ role: "Puppy Monitor", location: "OAK", email: "changed@example.com", isTeamMember: true });
  });

  it("uses the same no-paperwork activation for the existing employee access button", async () => {
    const harness = mockDb([[employee], [{ ...person, isTeamMember: false, deletedAt: new Date(), onboardingSentAt: null }]]);
    getDb.mockResolvedValue(harness.db);
    await expect(staffAvailabilityRouter.createCaller(context()).provisionEmployeeApyHqAccess({ employeeId: 7 })).resolves.toMatchObject({ id: 42, grantsApyHqAccess: true });
  });

  it("does not allow anonymous or ordinary staff to mutate employees", async () => {
    await expect(staffAvailabilityRouter.createCaller(context(false)).removeTeamMember({ id: 42 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    resolveApyAccess.mockResolvedValue({ level: "team_member", canManageOperations: false });
    await expect(staffAvailabilityRouter.createCaller(context()).reactivateEmployeeEmployment({ employeeId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("opens Manage Active Team directly on the team tree", () => {
    const ui = readFileSync(new URL("../client/src/pages/EmployeeDirectory.tsx", import.meta.url), "utf8");
    const tree = readFileSync(new URL("../client/src/pages/StaffAvailability.tsx", import.meta.url), "utf8");
    expect(ui).toContain('href="/admin/staff-availability?tab=team"');
    expect(tree).toContain('get("tab") === "team" ? "team" : "ops"');
    expect(ui).toContain('utils.staffAvailability.getOrgChart.invalidate()');
    expect(tree).toContain('utils.staffAvailability.listEmployees.invalidate()');
    expect(ui).not.toContain('Blocked: this person still has active APY HQ access');
  });
});
