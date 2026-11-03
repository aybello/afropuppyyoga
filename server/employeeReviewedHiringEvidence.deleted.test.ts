import { describe, expect, it, vi } from "vitest";
import { employees, jobApplicationActions, jobApplications } from "../drizzle/schema";
import { activateEmployeeWithAccess, prepareActiveEmployeeEdit } from "./employeeActivation";
import { reviewedHiringProfileIds } from "./employeeReviewedHiringEvidence";
import { reviewedHiringRecordHash } from "./hiringDuplicateIdentity";

const canonical = { id: 42, name: "Example Employee", email: "employee@example.com", phone: "+12895550100", role: "Puppy Monitor", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null };
const employee = { id: 7, sourceApplicationId: 42, name: canonical.name, email: canonical.email, phone: canonical.phone, role: canonical.role, location: canonical.location, employmentStatus: "active", endedAt: null };
const historical = { ...canonical, id: 41, status: "accepted", isTeamMember: false };
const second = { ...historical, id: 40 };
const evidence = (record = historical) => ({ applicationId: record.id, recordHash: reviewedHiringRecordHash(record) });
const review = (reviewed: unknown[] = [evidence()]) => ({ version: 2, canonicalApplicationId: 42, employeeId: 7, reviewed });
const action = (duplicateReview: unknown = review()) => ({ applicationId: 42, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 7, duplicateReview }) });
const error = "Reviewed applicant history changed or is no longer safe";

function harness(profiles = [canonical], directory = [employee], actions = [action()]) {
  const writes: Array<{ table: unknown; values: any }> = [];
  const tx = {
    select: vi.fn(() => {
      let table: unknown;
      const rows = () => table === jobApplications ? profiles : table === employees ? directory : table === jobApplicationActions ? actions : [];
      const chain: any = {
        from: (next: unknown) => { table = next; return chain; },
        where: () => chain,
        limit: async (count: number) => rows().slice(0, count),
        then: (resolve: (value: any[]) => void) => resolve(rows()),
      };
      return chain;
    }),
    update: vi.fn((table: unknown) => ({ set: (values: any) => ({ where: async () => { writes.push({ table, values }); } }) })),
    insert: vi.fn((table: unknown) => ({ values: async (values: any) => { writes.push({ table, values }); return [{ insertId: 100 }]; } })),
  };
  return { tx, writes };
}

const resolve = (profiles = [canonical], directory = [employee], actions = [action()]) =>
  reviewedHiringProfileIds(harness(profiles, directory, actions).tx, employee, profiles, directory);

describe("permanently deleted reviewed hiring history", () => {
  it("skips an unowned missing record and never returns its ID as reviewed", async () => {
    await expect(resolve()).resolves.toEqual(new Set());
  });

  it("still returns valid existing reviewed IDs in a mixed history", async () => {
    await expect(resolve([canonical, second], [employee], [action(review([evidence(), evidence(second)]))]))
      .resolves.toEqual(new Set([second.id]));
  });

  it("fails closed when any directory entry claims the missing ID", async () => {
    await expect(resolve([canonical], [employee, { ...employee, id: 8, sourceApplicationId: 41 }])).rejects.toThrow(error);
  });

  it.each([
    { ...review(), version: 1 },
    { ...review(), canonicalApplicationId: 43 },
    { ...review(), employeeId: 8 },
    { ...review(), reviewed: [] },
    { ...review(), reviewed: null },
    review([null]),
    review([{ ...evidence(), applicationId: 0 }]),
    review([{ ...evidence(), applicationId: 42 }]),
    review([evidence(), evidence()]),
    review([{ ...evidence(), recordHash: "not-a-hash" }]),
    review([{ ...evidence(), recordHash: "A".repeat(64) }]),
  ])("rejects malformed matching evidence even when the record is missing: %j", async (invalid) => {
    await expect(resolve([canonical], [employee], [action(invalid)])).rejects.toThrow(error);
  });

  it("ignores unrelated action rows, as before", async () => {
    const rows = [
      { ...action(null), applicationId: 99 },
      { ...action(null), action: "other" },
      { ...action(null), details: JSON.stringify({ employeeId: 8, duplicateReview: null }) },
      { ...action(null), details: "invalid JSON" },
    ];
    await expect(resolve([canonical], [employee], rows)).resolves.toEqual(new Set());
  });

  it.each([
    { ...historical, name: "" },
    { ...historical, email: "bad" },
    { ...historical, phone: null },
    { ...historical, name: "Changed Name" },
    { ...historical, isTeamMember: true },
    { ...historical, isTeamMember: null },
    { ...historical, status: "onboarded" },
  ])("retains validation for an existing reviewed record: %j", async (changed) => {
    await expect(resolve([canonical, changed])).rejects.toThrow(error);
  });

  it("rejects an existing reviewed record claimed by a directory entry", async () => {
    await expect(resolve([canonical, historical], [employee, { ...employee, id: 8, sourceApplicationId: 41 }])).rejects.toThrow(error);
  });

  it("allows edit preparation without writes or access grants to the missing record", async () => {
    const { tx, writes } = harness();
    await expect(prepareActiveEmployeeEdit(tx, employee as any, employee)).resolves.toEqual({ canonicalId: 42, duplicateIds: [] });
    expect(writes).toEqual([]);
  });

  it("allows activation while writing only the canonical profile, employee, and activation audit", async () => {
    const { tx, writes } = harness();
    await expect(activateEmployeeWithAccess(tx, employee.id, { id: 1, name: "Owner", email: "owner@example.com" }, true))
      .resolves.toEqual({ success: true, sourceApplicationId: 42, grantsApyHqAccess: true });
    expect(writes.map((write) => write.table)).toEqual([jobApplications, employees, jobApplicationActions]);
    expect(writes[0].values).toMatchObject({ isTeamMember: true, status: "onboarded" });
    expect(writes[2].values).toMatchObject({ applicationId: 42, action: "employee_and_login_activated" });
    expect(JSON.parse(writes[2].values.details).retiredDuplicateProfileIds).toEqual([]);
  });

  it("blocks edit and activation before writes when the missing ID is claimed", async () => {
    const directory = [employee, { ...employee, id: 8, sourceApplicationId: 41 }];
    const edit = harness([canonical], directory);
    await expect(prepareActiveEmployeeEdit(edit.tx, employee as any, employee)).rejects.toThrow(error);
    expect(edit.writes).toEqual([]);
    const activation = harness([canonical], directory);
    await expect(activateEmployeeWithAccess(activation.tx, employee.id, { id: 1, name: "Owner", email: "owner@example.com" }, true)).rejects.toThrow(error);
    expect(activation.writes).toEqual([]);
  });
});
