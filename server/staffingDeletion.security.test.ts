import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import { employeeApplicationAssociations, employees, jobApplicationActions, jobApplications, signingTokens, staffingMutationLocks } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), permanentlyDeleteJobApplication: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("./db", async (importOriginal) => ({
  ...await importOriginal<typeof import("./db")>(),
  getDb: mocks.getDb,
  permanentlyDeleteJobApplication: mocks.permanentlyDeleteJobApplication,
}));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
import { deleteArchivedJobApplication } from "./db";
import { isStaffingDeleteRestrictedError } from "./staffingDeletion";
import { withStaffingMutationLock } from "./staffingMutationLock";
import { reviewedHiringRecordHash } from "./hiringDuplicateIdentity";
import { careersRouter } from "./routers/careers";
import { staffAvailabilityRouter } from "./routers/staffAvailability";

const archivedAt = new Date("2026-01-01T00:00:00Z");
const applicant = { id: 42, status: "accepted", isTeamMember: false as boolean | number | null, deletedAt: archivedAt as Date | null };
const former = { id: 7, sourceApplicationId: 42 as number | null, employmentStatus: "inactive", name: "Former Employee" };
const actor = { id: 1, name: "Owner", email: "owner@example.com" };
const context = () => ({ user: actor } as any);
const legacyAction = (canonicalApplicationId = 42, reviewedApplicationId = 41) => ({
  applicationId: canonicalApplicationId, action: "employee_added_after_signature",
  details: JSON.stringify({ employeeId: former.id, duplicateReview: {
    version: 2, employeeId: former.id, canonicalApplicationId,
    reviewed: [{ applicationId: reviewedApplicationId, recordHash: reviewedHiringRecordHash({ id: reviewedApplicationId, name: "Original Reviewed Hire", email: "original@example.com", phone: "+14165550101" }) }],
  } }),
});
const dialect = new MySqlDialect();
const toSql = (predicate: SQL) => {
  const query = dialect.sqlToQuery(predicate);
  return { sql: query.sql.replace(/`/g, ""), params: query.params };
};

function harness() {
  // Only SQL builders are used: the fake client never executes a query or opens a connection.
  const builder = drizzle.mock();
  const state = {
    app: { ...applicant } as typeof applicant | null,
    directory: [{ ...former }],
    associations: [] as Array<{ id: number; applicationId: number; canonicalApplicationId: number; employeeId: number }>,
    actions: [] as Array<{ applicationId: number; action: string; details: string | null }>,
    signedOffers: [{ id: 9, applicationId: 42, signed: 1 }],
    events: [] as string[],
    deletes: [] as Array<{ table: unknown; sql: string; params: unknown[] }>,
    audits: [] as Record<string, unknown>[],
    affectedRows: 1,
    deleteError: undefined as unknown,
    auditError: undefined as unknown,
    lockError: undefined as unknown,
    commitError: undefined as unknown,
    onLock: undefined as (() => void | Promise<void>) | undefined,
  };
  let queue: Promise<unknown> = Promise.resolve();
  const tx: any = {
    select: (fields?: any) => {
      const query: any = fields ? builder.select(fields) : builder.select();
      const originalFrom = query.from.bind(query);
      query.from = (table: unknown) => {
        const chain: any = originalFrom(table);
        const originalWhere = chain.where.bind(chain);
        let predicate: SQL;
        chain.where = (next: SQL) => { predicate = next; return originalWhere(next); };
        chain.for = async (mode: string) => {
          expect(mode).toBe("update");
          const filter = toSql(predicate);
          if (table === staffingMutationLocks) {
            expect(filter).toEqual({ sql: "staffingMutationLocks.lockName = ?", params: ["apy_staffing_mutation_v1"] });
            state.events.push("lock acquired");
            if (state.lockError) throw state.lockError;
            await state.onLock?.();
            return [];
          }
          expect(state.events).toContain("lock acquired");
          if (table === jobApplications) {
            expect(filter).toEqual({ sql: "jobApplications.id = ?", params: [42] });
            state.events.push("profile read");
            return state.app ? [{ ...state.app }] : [];
          }
          if (table === employees) {
            state.events.push("employee read");
            if (filter.sql === "employees.id = ?") {
              expect(filter.params).toEqual([7]);
              return state.directory.filter(row => row.id === 7).slice(0, 1).map(row => ({ ...row }));
            }
            expect(filter).toEqual({ sql: "employees.sourceApplicationId = ?", params: [42] });
            return state.directory.filter(row => row.sourceApplicationId === 42).slice(0, 1).map(row => ({ ...row }));
          }
          if (table === jobApplicationActions) {
            expect(filter).toEqual({ sql: "jobApplicationActions.action = ?", params: ["employee_added_after_signature"] });
            state.events.push("legacy history read");
            return state.actions.filter(row => row.action === "employee_added_after_signature").map(row => ({ ...row }));
          }
          expect(table).toBe(employeeApplicationAssociations);
          state.events.push("association read");
          if (filter.sql === "employeeApplicationAssociations.employeeId = ?") {
            expect(filter.params).toEqual([7]);
            return state.associations.filter(row => row.employeeId === 7).slice(0, 1);
          }
          expect(filter).toEqual({
            sql: "(employeeApplicationAssociations.applicationId = ? or employeeApplicationAssociations.canonicalApplicationId = ?)", params: [42, 42],
          });
          return state.associations.filter(row => row.applicationId === 42 || row.canonicalApplicationId === 42).slice(0, 1);
        };
        return chain;
      };
      return query;
    },
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => {
      if (table === staffingMutationLocks) {
        expect(values).toEqual({ lockName: "apy_staffing_mutation_v1" });
        return { onDuplicateKeyUpdate: async (update: unknown) => {
          expect(update).toEqual({ set: values });
          state.events.push("lock seed");
        } };
      }
      expect(table).toBe(jobApplicationActions);
      return Promise.resolve().then(() => {
        state.events.push("audit");
        if (state.auditError) throw state.auditError;
        state.audits.push(values);
        return [{ affectedRows: 1 }];
      });
    } }),
    delete: (table: any) => ({ where: async (predicate: SQL) => {
      state.events.push("delete");
      // Real Drizzle compilation verifies NOT EXISTS subqueries (not mock placeholders).
      const query = builder.delete(table).where(predicate).toSQL();
      state.deletes.push({ table, sql: query.sql.replace(/`/g, ""), params: query.params });
      if (state.deleteError) throw state.deleteError;
      if (state.affectedRows === 1) {
        if (table === employees) state.directory = state.directory.filter(row => row.id !== 7);
        else { expect(table).toBe(jobApplications); state.app = null; }
      }
      return [{ affectedRows: state.affectedRows }];
    } }),
  };
  const db: any = {
    // Out-of-transaction reads/writes are intentionally not supported.
    transaction: (callback: (tx: any) => Promise<unknown>) => {
      const result = queue.then(async () => {
        state.events.push("begin");
        const saved = { app: state.app && { ...state.app }, directory: state.directory.map(row => ({ ...row })), audits: [...state.audits] };
        try {
          const value = await callback(tx);
          if (state.commitError) throw state.commitError;
          state.events.push("commit");
          return value;
        } catch (error) {
          Object.assign(state, saved);
          state.events.push("rollback");
          throw error;
        }
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
  mocks.getDb.mockResolvedValue(db);
  mocks.permanentlyDeleteJobApplication.mockImplementation((id: number) => deleteArchivedJobApplication(db, id));
  return { db, state };
}

beforeEach(() => {
  mocks.getDb.mockReset();
  mocks.permanentlyDeleteJobApplication.mockReset();
  mocks.resolveApyAccess.mockReset().mockResolvedValue({ level: "owner", canManageOperations: true });
});

const deleteFormer = () => staffAvailabilityRouter.createCaller(context()).deleteFormerEmployeeRecord({ employeeId: 7 });
const deleteApplication = () => careersRouter.createCaller(context()).permanentlyDelete({ id: 42 });

describe("atomic former employee deletion", () => {
  it("locks before every eligibility read, deletes only an inactive row, and retains applicant contracts", async () => {
    const { state } = harness();
    await expect(deleteFormer()).resolves.toEqual({ success: true });
    expect(state.events).toEqual(["begin", "lock seed", "lock acquired", "employee read", "profile read", "association read", "legacy history read", "delete", "audit", "commit"]);
    expect(state.deletes).toEqual([{ table: employees, sql: "delete from employees where (employees.id = ? and employees.employmentStatus = ? and employees.sourceApplicationId = ?)", params: [7, "inactive", 42] }]);
    expect(state.app).toEqual(applicant);
    expect(state.signedOffers).toEqual([{ id: 9, applicationId: 42, signed: 1 }]);
    expect(state.audits).toEqual([expect.objectContaining({ action: "employee_directory_record_deleted", applicationId: 42, actorUserId: actor.id })]);
  });
  it("allows deletion of an unlinked inactive employee without fabricating an application audit", async () => {
    const { state } = harness(); state.directory[0].sourceApplicationId = null;
    await expect(deleteFormer()).resolves.toEqual({ success: true });
    expect(state.deletes[0]).toMatchObject({ params: [7, "inactive"] });
    expect(state.deletes[0].sql).toContain("employees.sourceApplicationId is null");
    expect(state.events).not.toContain("profile read"); expect(state.audits).toEqual([]);
  });
  it.each([42, null])("retains a pre-migration reviewed hire's inactive parent after contact/source changes (source %s)", async sourceApplicationId => {
    const { state } = harness();
    state.directory[0] = { ...former, sourceApplicationId, name: "Changed Employee Contact" };
    state.actions.push(legacyAction());
    const before = structuredClone({ directory: state.directory, app: state.app, actions: state.actions, signedOffers: state.signedOffers });
    await expect(deleteFormer()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep the record inactive") });
    expect(state.events).toContain("legacy history read");
    expect(state.deletes).toEqual([]); expect(state.audits).toEqual([]); expect(state.associations).toEqual([]);
    expect({ directory: state.directory, app: state.app, actions: state.actions, signedOffers: state.signedOffers }).toEqual(before);
  });
  it("rechecks a legacy review established before the employee deletion lock is acquired", async () => {
    const { state } = harness();
    state.onLock = () => { state.actions.push(legacyAction()); };
    await expect(deleteFormer()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep the record inactive") });
    expect(state.deletes).toEqual([]); expect(state.audits).toEqual([]); expect(state.associations).toEqual([]);
  });
  it("returns retained-history conflict for an unverifiable legacy review rather than deleting the parent", async () => {
    const { state } = harness();
    state.actions.push({ ...legacyAction(), details: JSON.stringify({ employeeId: 7, duplicateReview: { version: 2 } }) });
    await expect(deleteFormer()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("must be retained") });
    expect(state.deletes).toEqual([]); expect(state.audits).toEqual([]);
  });
  it.each(["active employee", "active profile", "association", "missing employee"])("rejects %s before any domain write", async label => {
    const { state } = harness();
    if (label === "active employee") state.directory[0].employmentStatus = "active";
    if (label === "active profile") state.app = { ...applicant, isTeamMember: true, deletedAt: null };
    if (label === "association") state.associations.push({ id: 1, applicationId: 41, canonicalApplicationId: 42, employeeId: 7 });
    if (label === "missing employee") state.directory = [];
    await expect(deleteFormer()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.deletes).toEqual([]); expect(state.audits).toEqual([]);
    expect(state.signedOffers).toHaveLength(1);
  });
  it("re-reads employment and the current linked profile after lock acquisition", async () => {
    const { state } = harness();
    state.onLock = () => { state.directory[0].employmentStatus = "active"; state.app = { ...applicant, isTeamMember: true, deletedAt: null }; };
    await expect(deleteFormer()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.deletes).toEqual([]); expect(state.audits).toEqual([]);
  });
  it("waits for a concurrent staffing activation and then rejects stale deletion", async () => {
    const { db, state } = harness();
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const activation = withStaffingMutationLock(db, async () => {
      started(); await gate;
      state.directory[0].employmentStatus = "active";
      state.app = { ...applicant, isTeamMember: true, deletedAt: null };
    });
    await ready;
    const deletion = deleteFormer();
    const rejected = expect(deletion).rejects.toMatchObject({ code: "CONFLICT" });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(state.events).not.toContain("employee read");
    release(); await activation; await rejected;
    expect(state.directory[0].employmentStatus).toBe("active");
    expect(state.app?.isTeamMember).toBe(true);
    expect(state.deletes).toEqual([]);
  });
  it("returns conflict and rolls back when the conditional inactive delete affects no row", async () => {
    const { state } = harness(); state.affectedRows = 0;
    await expect(deleteFormer()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Refresh Employee Directory") });
    expect(state.directory).toHaveLength(1); expect(state.audits).toEqual([]);
    expect(state.events.at(-1)).toBe("rollback");
  });
  it.each(["deleteError", "commitError"] as const)("translates a wrapped restrictive FK at %s without removing linked evidence", async key => {
    const { state } = harness();
    state[key] = new Error("wrapped SQL", { cause: Object.assign(new Error("FK"), { code: "ER_ROW_IS_REFERENCED_2", errno: 1451 }) });
    await expect(deleteFormer()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep the record inactive") });
    expect(state.directory).toHaveLength(1); expect(state.audits).toEqual([]);
  });
  it("rolls back the deletion if its audit fails", async () => {
    const { state } = harness(); state.auditError = new Error("audit unavailable");
    await expect(deleteFormer()).rejects.toMatchObject({ message: "audit unavailable" });
    expect(state.directory).toHaveLength(1); expect(state.events.at(-1)).toBe("rollback");
  });
  it("never attempts domain writes when the shared lock fails", async () => {
    const { state } = harness(); state.lockError = new Error("lock unavailable");
    await expect(deleteFormer()).rejects.toMatchObject({ message: "lock unavailable" });
    expect(state.deletes).toEqual([]); expect(state.audits).toEqual([]);
  });
});

describe("permanent archived application deletion", () => {
  it("deletes only an archived, unowned non-staff application under the shared lock", async () => {
    const { state } = harness(); state.directory = [];
    await expect(deleteApplication()).resolves.toEqual({ success: true });
    expect(state.events).toEqual(["begin", "lock seed", "lock acquired", "profile read", "employee read", "association read", "legacy history read", "delete", "commit"]);
    expect(state.deletes).toHaveLength(1);
    const deletion = state.deletes[0];
    expect(deletion.table).toBe(jobApplications);
    expect(deletion.sql).toContain("jobApplications.deletedAt is not null");
    expect(deletion.sql).toContain("jobApplications.isTeamMember = ?");
    expect(deletion.sql).toContain("jobApplications.appStatus <> ?");
    expect(deletion.sql).toContain("not exists (select id from employees where employees.sourceApplicationId = ?)");
    expect(deletion.sql).toContain("not exists (select id from employeeApplicationAssociations where (employeeApplicationAssociations.applicationId = ? or employeeApplicationAssociations.canonicalApplicationId = ?))");
    expect(deletion.sql).not.toContain("for update");
    expect(deletion.params).toEqual([42, false, "onboarded", 42, 42, 42]);
    expect(state.audits).toEqual([]);
    expect(state.signedOffers).toEqual([{ id: 9, applicationId: 42, signed: 1 }]);
    expect(state.deletes.some(entry => entry.table === signingTokens || entry.table === employeeApplicationAssociations)).toBe(false);
  });
  it.each(["changed owner", "missing owner", "canonical without owner"])("retains pre-migration reviewed application history after %s, without associations", async label => {
    const { state } = harness();
    // Reviewed hire's contacts and directory source now differ; ownership is by ID.
    state.directory[0] = { ...former, sourceApplicationId: 43, name: "Changed Employee Contact" };
    state.actions.push(label === "canonical without owner" ? legacyAction(42, 41) : legacyAction(43, 42));
    if (label !== "changed owner") state.directory = [];
    const before = structuredClone({ app: state.app, directory: state.directory, actions: state.actions, signedOffers: state.signedOffers });
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep it archived") });
    expect(state.deletes).toEqual([]); expect(state.audits).toEqual([]); expect(state.associations).toEqual([]);
    expect({ app: state.app, directory: state.directory, actions: state.actions, signedOffers: state.signedOffers }).toEqual(before);
  });
  it("rechecks legacy review ownership after acquiring the application deletion lock", async () => {
    const { state } = harness(); state.directory = [];
    state.onLock = () => { state.actions.push(legacyAction(43, 42)); };
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep it archived") });
    expect(state.deletes).toEqual([]); expect(state.associations).toEqual([]);
  });
  it("returns retained-history conflict for a malformed legacy envelope without deleting an application", async () => {
    const { state } = harness(); state.directory = [];
    state.actions.push({ ...legacyAction(43, 42), details: JSON.stringify({ employeeId: 7, duplicateReview: { version: 2 } }) });
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep it archived") });
    expect(state.deletes).toEqual([]);
  });
  it.each([
    ["active canonical source", "active"], ["former canonical source", "inactive"],
  ])("protects %s regardless of application flags", async (_label, status) => {
    const { state } = harness(); state.directory[0].employmentStatus = status;
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Employee Directory") });
    expect(state.deletes).toEqual([]); expect(state.app).toEqual(applicant);
  });
  it.each(["applicationId", "canonicalApplicationId"] as const)("protects the %s association side and signed contract rows", async column => {
    const { state } = harness(); state.directory = [];
    const association = { id: 1, applicationId: 41, canonicalApplicationId: 43, employeeId: 7, [column]: 42 };
    state.associations.push(association);
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep it archived") });
    expect(state.deletes).toEqual([]); expect(state.associations).toEqual([association]); expect(state.signedOffers).toHaveLength(1);
  });
  it.each([
    ["unarchived", { deletedAt: null }], ["active staff", { deletedAt: null, isTeamMember: true }],
    ["archived staff", { isTeamMember: true }], ["numeric staff", { isTeamMember: 1 }],
    ["ambiguous staff", { isTeamMember: null }], ["onboarded staff", { status: "onboarded" }],
  ])("rejects %s before a delete", async (_label, change) => {
    const { state } = harness(); state.directory = []; state.app = { ...applicant, ...change };
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.deletes).toEqual([]);
  });
  it("allows MySQL's numeric false flag for an ordinary unlinked archived applicant", async () => {
    const { state } = harness(); state.directory = []; state.app!.isTeamMember = 0;
    await expect(deleteApplication()).resolves.toEqual({ success: true });
  });
  it("requires the archived application to still exist", async () => {
    const { state } = harness(); state.directory = []; state.app = null;
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("archive an unlinked applicant") });
    expect(state.deletes).toEqual([]);
  });
  it.each(["source", "association", "restored", "activated"])("rechecks a concurrent %s change made before lock acquisition", async change => {
    const { state } = harness(); state.directory = [];
    state.onLock = () => {
      if (change === "source") state.directory.push({ ...former });
      if (change === "association") state.associations.push({ id: 1, applicationId: 42, canonicalApplicationId: 41, employeeId: 7 });
      if (change === "restored") state.app!.deletedAt = null;
      if (change === "activated") state.app!.isTeamMember = true;
    };
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.deletes).toEqual([]);
  });
  it("reports a zero-row conditional delete as an actionable conflict, not success", async () => {
    const { state } = harness(); state.directory = []; state.affectedRows = 0;
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Refresh Applications") });
    expect(state.app).toEqual(applicant);
  });
  it.each(["deleteError", "commitError"] as const)("maps restrictive FK failures at %s to conflict while retaining the application", async key => {
    const { state } = harness(); state.directory = [];
    state[key] = new Error("wrapped SQL", { cause: Object.assign(new Error("FK"), { errno: 1451 }) });
    await expect(deleteApplication()).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Keep it archived") });
    expect(state.app).toEqual(applicant); expect(state.events.at(-1)).toBe("rollback");
  });
  it("does not hide unrelated database errors", async () => {
    const { db, state } = harness(); state.directory = [];
    const error = Object.assign(new Error("database offline"), { code: "ECONNRESET" }); state.deleteError = error;
    await expect(deleteArchivedJobApplication(db, 42)).rejects.toBe(error);
    expect(state.app).toEqual(applicant);
  });
  it("does not report success after a failed commit", async () => {
    const { db, state } = harness(); state.directory = []; state.commitError = new Error("commit failed");
    await expect(deleteArchivedJobApplication(db, 42)).rejects.toBe(state.commitError);
    expect(state.app).toEqual(applicant);
  });
});

describe("deletion authorization and restrictive error classification", () => {
  it.each(["directory", "application"])("denies unauthorized %s deletion before reading the database", async kind => {
    const { state } = harness(); mocks.resolveApyAccess.mockResolvedValue({ level: "team_member", canManageOperations: false });
    await expect(kind === "directory" ? deleteFormer() : deleteApplication()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.events).toEqual([]); expect(mocks.getDb).not.toHaveBeenCalled(); expect(mocks.permanentlyDeleteJobApplication).not.toHaveBeenCalled();
  });
  it("recognizes only restrictive parent-delete errors, including nested and cyclic causes", () => {
    expect(isStaffingDeleteRestrictedError({ code: "ER_ROW_IS_REFERENCED_2" })).toBe(true);
    expect(isStaffingDeleteRestrictedError({ code: "ER_ROW_IS_REFERENCED" })).toBe(true);
    expect(isStaffingDeleteRestrictedError({ errno: 1217 })).toBe(true);
    expect(isStaffingDeleteRestrictedError({ cause: { cause: { errno: 1451 } } })).toBe(true);
    expect(isStaffingDeleteRestrictedError({ code: "ER_NO_REFERENCED_ROW_2", errno: 1452 })).toBe(false);
    expect(isStaffingDeleteRestrictedError("foreign key")).toBe(false);
    const cycle: any = {}; cycle.cause = cycle;
    expect(isStaffingDeleteRestrictedError(cycle)).toBe(false);
  });
});
