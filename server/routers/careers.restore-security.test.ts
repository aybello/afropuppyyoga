import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { employees, jobApplicationActions, jobApplications, staffingMutationLocks } from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({ drizzle: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: mocks.drizzle }));
vi.mock("../apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
import { careersRouter } from "./careers";

const caller = () => careersRouter.createCaller({ user: { id: 1, name: "Owner", email: "owner@example.com" } } as any);
const archivedAt = new Date("2026-01-01T00:00:00Z");
const base = { id: 42, status: "accepted", isTeamMember: false as boolean | number | null, deletedAt: archivedAt as Date | null };
let app: typeof base | null;
let linked: Array<{ id: number; sourceApplicationId: number; employmentStatus: string }>;
let reads: unknown[];
let updates: unknown[];
let audits: unknown[];
let affectedRows: number;
let onTransaction: (() => void) | undefined;
const dialect = new MySqlDialect();
function assertSql(predicate: SQL, sql: string, params: unknown[]) {
  const query = dialect.sqlToQuery(predicate);
  expect(query.sql.replace(/`/g, "")).toBe(sql);
  expect(query.params).toEqual(params);
}
const db = {
  transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
    onTransaction?.();
    const tx = {
      insert: (table: unknown) => ({ values: (values: unknown) => {
        expect(table).toBe(staffingMutationLocks);
        expect(values).toEqual({ lockName: "apy_staffing_mutation_v1" });
        return { onDuplicateKeyUpdate: async (update: unknown) => {
          expect(update).toEqual({ set: values });
        } };
      } }),
      select: () => {
        let table: unknown;
        let filtered = false;
        let limited = false;
        const chain = {
          from: (target: unknown) => { table = target; return chain; },
          where: (predicate: SQL) => {
            filtered = true;
            if (table === staffingMutationLocks) assertSql(predicate, "staffingMutationLocks.lockName = ?", ["apy_staffing_mutation_v1"]);
            else if (table === jobApplications) assertSql(predicate, "jobApplications.id = ?", [42]);
            else if (table === employees) assertSql(predicate, "employees.sourceApplicationId = ?", [42]);
            else throw new Error("Unexpected read");
            return chain;
          },
          limit: (value: number) => { expect(value).toBe(1); limited = true; return chain; },
          for: async (mode: string) => {
            expect(mode).toBe("update");
            expect(filtered).toBe(true);
            expect(limited).toBe(table !== staffingMutationLocks);
            reads.push(table);
            if (table === staffingMutationLocks) return [{ lockName: "apy_staffing_mutation_v1" }];
            expect(reads[0]).toBe(staffingMutationLocks);
            if (table === jobApplications) return app ? [{ ...app }] : [];
            if (table === employees) return linked.filter((row) => row.sourceApplicationId === 42).slice(0, 1);
            throw new Error("Unexpected locked read");
          },
        };
        return chain;
      },
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async (predicate: SQL) => {
        expect(table).toBe(jobApplications);
        expect(reads).toEqual([staffingMutationLocks, jobApplications, employees]);
        expect(values).toEqual({ deletedAt: null });
        assertSql(predicate, "(jobApplications.id = ? and jobApplications.deletedAt is not null and jobApplications.isTeamMember = ? and jobApplications.appStatus <> ?)", [42, false, "onboarded"]);
        updates.push(values);
        if (affectedRows && app) app.deletedAt = null;
        return [{ affectedRows }];
      } }) }),
    };
    return callback(tx);
  },
  insert: (table: unknown) => ({ values: async (values: unknown) => {
    expect(table).toBe(jobApplicationActions);
    audits.push(values);
  } }),
};
beforeAll(() => {
  // The driver is mocked: this URL never creates a real connection.
  process.env.DATABASE_URL = "mysql://mock.invalid/restore_test";
  mocks.drizzle.mockReturnValue(db);
});
beforeEach(() => {
  app = { ...base }; linked = []; reads = []; updates = []; audits = []; affectedRows = 1; onTransaction = undefined;
  mocks.resolveApyAccess.mockResolvedValue({ level: "owner", canManageOperations: true });
});

describe("archived application restoration", () => {
  it("restores ordinary archived applicant history and records an audit", async () => {
    await expect(caller().restoreApplication({ id: 42 })).resolves.toEqual({ success: true });
    expect(app?.deletedAt).toBeNull();
    expect(reads).toEqual([staffingMutationLocks, jobApplications, employees]);
    expect(audits).toEqual([expect.objectContaining({ action: "application_restored", applicationId: 42 })]);
  });
  it("does not treat a directory entry linked to another application as this application's link", async () => {
    linked = [{ id: 7, sourceApplicationId: 43, employmentStatus: "active" }];
    await expect(caller().restoreApplication({ id: 42 })).resolves.toEqual({ success: true });
    expect(app?.deletedAt).toBeNull();
  });
  it("does not let an unauthorized caller attempt a restore", async () => {
    mocks.resolveApyAccess.mockResolvedValue({ level: "team_member", canManageOperations: false });
    await expect(caller().restoreApplication({ id: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reads).toEqual([]); expect(updates).toEqual([]); expect(audits).toEqual([]);
  });
  it.each([
    ["team member", { isTeamMember: true }, []],
    ["numeric team member", { isTeamMember: 1 }, []],
    ["unknown team flag", { isTeamMember: null }, []],
    ["onboarded non-team", { status: "onboarded" }, []],
    ["active directory link", {}, [{ id: 7, sourceApplicationId: 42, employmentStatus: "active" }]],
    ["inactive directory link", {}, [{ id: 7, sourceApplicationId: 42, employmentStatus: "inactive" }]],
  ])("rejects %s and sends staff to Employee Directory", async (_label, changes, directory) => {
    app = { ...base, ...changes }; linked = directory;
    await expect(caller().restoreApplication({ id: 42 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Employee Directory") });
    expect(app.deletedAt).toEqual(archivedAt);
    expect(updates).toEqual([]); expect(audits).toEqual([]);
  });
  it("uses the fresh directory link after acquiring the transaction lock", async () => {
    onTransaction = () => { linked = [{ id: 7, sourceApplicationId: 42, employmentStatus: "inactive" }]; };
    await expect(caller().restoreApplication({ id: 42 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Employee Directory") });
    expect(updates).toEqual([]); expect(audits).toEqual([]);
  });
  it("uses the fresh team flag after acquiring the transaction lock", async () => {
    onTransaction = () => { app = { ...base, isTeamMember: true }; };
    await expect(caller().restoreApplication({ id: 42 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Employee Directory") });
    expect(updates).toEqual([]); expect(audits).toEqual([]);
  });
  it.each(["missing", "already active"])("rejects a %s application without auditing", async (state) => {
    app = state === "missing" ? null : { ...base, deletedAt: null };
    await expect(caller().restoreApplication({ id: 42 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updates).toEqual([]); expect(audits).toEqual([]);
  });
  it("treats a failed conditional update as a conflict without auditing", async () => {
    affectedRows = 0;
    await expect(caller().restoreApplication({ id: 42 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(app?.deletedAt).toEqual(archivedAt); expect(audits).toEqual([]);
  });
});
