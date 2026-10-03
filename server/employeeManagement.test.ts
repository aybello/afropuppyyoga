import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { employees, jobApplications, staffInvites, staffPhoneAccessCodes, users } from "../drizzle/schema";

const { getDb, resolveApyAccess } = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("./db", () => ({ getDb, getUserByOpenId: vi.fn(), upsertUser: vi.fn() }));
vi.mock("./apyAccess", () => ({ resolveApyAccess }));
import { activateEmployeeWithAccess } from "./employeeActivation";
import { revokeTeamProfileAccess } from "./staffAccessRevocation";
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
      const chain: any = {
        from: () => chain, where: () => chain, orderBy: () => chain,
        limit: async () => reads.shift() ?? [],
        for: async () => [],
        then: (resolve: (value: unknown[]) => void) => resolve(reads.shift() ?? []),
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
  it("deactivates all linked capabilities immediately without reading class duties", async () => {
    const { db, updates, deletes } = mockDb([[person], [{ email: "previous@example.com" }]]);
    await expect(revokeTeamProfileAccess(db, 42, { isOwner: true, retainTeamMembership: true })).resolves.toMatchObject({ success: true });
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(updates).toEqual(expect.arrayContaining([
      { table: jobApplications, values: { isTeamMember: true, deletedAt: expect.any(Date) } },
      { table: employees, values: { employmentStatus: "inactive", endedAt: expect.any(Date) } },
      { table: staffInvites, values: { isActive: 0 } },
      { table: users, values: { role: "user" } },
    ]));
    expect(deletes).toEqual([staffPhoneAccessCodes]);
    expect(deletes).not.toContain(employees);
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
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(inserts).toEqual(expect.arrayContaining([{ table: expect.anything(), values: expect.objectContaining({ action: "employee_and_login_activated" }) }]));
    expect(updates.some((update) => update.table === staffInvites)).toBe(false);
  });

  it("creates a login profile for an unlinked employee during activation", async () => {
    const { db, updates, inserts } = mockDb([[{ ...employee, sourceApplicationId: null }], []]);
    await expect(activateEmployeeWithAccess(db, 7, actor, true)).resolves.toMatchObject({ sourceApplicationId: 100, grantsApyHqAccess: true });
    expect(inserts[0]).toMatchObject({ table: jobApplications, values: { isTeamMember: true, status: "onboarded" } });
    expect(updates[0]).toMatchObject({ table: employees, values: { employmentStatus: "active", sourceApplicationId: 100 } });
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
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(inserts[0]).toMatchObject({ table: jobApplications, values: { isTeamMember: true, status: "onboarded" } });
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
    expect(ui).not.toContain('Blocked: this person still has active APY HQ access');
  });
});
