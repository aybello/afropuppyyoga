import { beforeEach, describe, expect, it, vi } from "vitest";
import { classStaffAssignments, employees, jobApplicationActions, jobApplications, staffingMutationLocks, weekendLeadershipCoverage } from "../drizzle/schema";
import { hiringReviewEvidence, hiringReviewSnapshot } from "./hiringDuplicateIdentity";

const { getDb, resolveApyAccess } = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("./db", () => ({ getDb, getUserByOpenId: vi.fn(), upsertUser: vi.fn() }));
vi.mock("./apyAccess", () => ({ resolveApyAccess }));
import { staffAvailabilityRouter } from "./routers/staffAvailability";

const actor = { id: 1, name: "Owner", email: "owner@example.com", openId: "owner", role: "admin", loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const profile = { id: 42, name: "Example Employee", email: "employee@example.com", phone: "+12895550100", role: "Puppy Monitor", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null };
const employee = { id: 7, sourceApplicationId: 42, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, location: profile.location, employmentStatus: "active", endedAt: null };
const input = { id: 42, name: profile.name, email: profile.email, phone: profile.phone, role: "Puppy Monitor" as const, location: "KW" as const };
const context = () => ({ user: actor, req: {}, res: {} } as any);

type Fixture = { profiles?: any[]; directory?: any[]; actions?: any[]; assignments?: any[]; coverage?: any[] };
function harness({ profiles = [profile], directory = [], actions = [], assignments = [], coverage = [] }: Fixture = {}) {
  const writes: Array<{ operation: string; table: any; values?: any }> = [];
  const tx: any = {
    select: vi.fn(() => {
      let table: any;
      const data = () => table === jobApplications ? profiles : table === employees ? directory : table === jobApplicationActions ? actions : table === classStaffAssignments ? assignments : table === weekendLeadershipCoverage ? coverage : [];
      const chain: any = {
        from: (value: any) => { table = value; return chain; },
        where: () => chain, innerJoin: () => chain,
        limit: async () => data().slice(0, 1), for: async () => [],
        then: (resolve: (value: any[]) => void) => resolve(data()),
      };
      return chain;
    }),
    update: vi.fn((table: any) => ({ set: (values: any) => ({ where: async () => { writes.push({ operation: "update", table, values }); } }) })),
    insert: vi.fn((table: any) => ({ values: (values: any) => {
      if (table !== staffingMutationLocks) writes.push({ operation: "insert", table, values });
      return { onDuplicateKeyUpdate: async () => undefined };
    } })),
    delete: vi.fn((table: any) => ({ where: async () => { writes.push({ operation: "delete", table }); } })),
  };
  const db = { transaction: vi.fn(async (callback) => callback(tx)) };
  getDb.mockResolvedValue(db);
  return { db, tx, writes };
}
const edit = (values = input) => staffAvailabilityRouter.createCaller(context()).updateTeamMember(values);

beforeEach(() => {
  getDb.mockReset();
  resolveApyAccess.mockReset().mockResolvedValue({ level: "owner", teamMember: null, canManageOperations: true });
});

describe("team profile edits protect login identity", () => {
  it.each([
    { email: "  EMPLOYEE@example.com  ", phone: null },
    { email: "other@example.com", phone: "(289) 555-0100" },
  ])("rejects normalized contact collisions with any other unarchived team profile: %j", async (contact) => {
    const other = { ...profile, id: 43, name: "Another", status: "new", ...contact };
    const h = harness({ profiles: [profile, other] });
    await expect(edit()).rejects.toThrow("Another active APY HQ profile");
    expect(h.writes).toEqual([]);
  });

  it("does not permit same-person active duplicates, including when already sharing the contact", async () => {
    const h = harness({ profiles: [profile, { ...profile, id: 43 }], directory: [employee] });
    await expect(edit()).rejects.toThrow("Another active APY HQ profile");
    expect(h.writes).toEqual([]);
  });

  it.each(["active", "inactive"])('rejects a collision with another %s Directory row even when unlinked', async (employmentStatus) => {
    const h = harness({ directory: [{ ...employee, id: 8, sourceApplicationId: null, email: "different@example.com", phone: "1 (289) 555-0100", employmentStatus }] });
    await expect(edit()).rejects.toThrow("Another Employee Directory record");
    expect(h.writes).toEqual([]);
  });

  it("rejects multiple Directory records linked to the selected profile", async () => {
    const h = harness({ directory: [employee, { ...employee, id: 8, email: "other@example.com", phone: null }] });
    await expect(edit()).rejects.toThrow("multiple Employee Directory records");
    expect(h.writes).toEqual([]);
  });

  it("allows a legacy unlinked edit with repeat non-team and archived applicant history", async () => {
    const history = { ...profile, id: 41, status: "accepted", isTeamMember: false };
    const archived = { ...profile, id: 40, deletedAt: new Date() };
    const h = harness({ profiles: [profile, history, archived] });
    await expect(edit({ ...input, name: "Corrected Name", email: "EMPLOYEE@example.com", phone: "(289) 555-0100" })).resolves.toMatchObject({ success: true, roleChanged: false });
    expect(h.writes).toEqual([
      { operation: "update", table: jobApplications, values: expect.objectContaining({ name: "Corrected Name", email: "employee@example.com", phone: "+12895550100" }) },
      { operation: "update", table: employees, values: expect.objectContaining({ name: "Corrected Name" }) },
    ]);
  });

  it("uses the locked transaction for linked preparation and preserves valid reviewed hiring history", async () => {
    const historical = { ...profile, id: 41, status: "accepted", isTeamMember: false };
    const review = hiringReviewEvidence(hiringReviewSnapshot({ ...profile, status: "accepted", isTeamMember: false }, null, [historical], []), employee.id);
    const action = { applicationId: 42, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 7, duplicateReview: review }) };
    const h = harness({ profiles: [profile, historical], directory: [employee], actions: [action] });
    await expect(edit()).resolves.toMatchObject({ success: true });
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.tx.select).toHaveBeenCalled();
    expect(h.writes).toHaveLength(2);
    expect(h.writes.map((w) => w.table)).toEqual([jobApplications, employees]);
  });

  it("does not reintroduce a previously reviewed contact that is no longer on the employee", async () => {
    const historical = { ...profile, id: 41, status: "accepted", isTeamMember: false };
    const review = hiringReviewEvidence(hiringReviewSnapshot({ ...profile, status: "accepted", isTeamMember: false }, null, [historical], []), employee.id);
    const action = { applicationId: 42, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 7, duplicateReview: review }) };
    const current = { ...employee, email: "new@example.com", phone: "+14165550100" };
    const canonical = { ...profile, email: current.email, phone: current.phone };
    const h = harness({ profiles: [canonical, historical], directory: [current], actions: [action] });
    await expect(edit({ ...input, email: profile.email, phone: current.phone })).rejects.toThrow("Another applicant");
    expect(h.writes).toEqual([]);
  });

  it("rejects stale reviewed evidence before any domain writes", async () => {
    const historical = { ...profile, id: 41, status: "accepted", isTeamMember: false };
    const review = hiringReviewEvidence(hiringReviewSnapshot({ ...profile, status: "accepted", isTeamMember: false }, null, [historical], []), employee.id);
    const action = { applicationId: 42, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 7, duplicateReview: review }) };
    const h = harness({ profiles: [profile, { ...historical, name: "Changed" }], directory: [employee], actions: [action] });
    await expect(edit()).rejects.toThrow("history changed");
    expect(h.writes).toEqual([]);
  });

  it("rejects new unreviewed applicant collisions for a linked active employee", async () => {
    const other = { ...profile, id: 41, status: "accepted", isTeamMember: false, name: "Applicant", email: "new@example.com", phone: null };
    const h = harness({ profiles: [profile, other], directory: [employee] });
    await expect(edit({ ...input, email: "new@example.com" })).rejects.toThrow("Another applicant");
    expect(h.writes).toEqual([]);
  });

  it("retains inactive duplicate history without retiring it or activating access", async () => {
    const duplicate = { ...profile, id: 41, isTeamMember: false };
    const h = harness({ profiles: [profile, duplicate], directory: [employee] });
    await expect(edit({ ...input, name: "New Name" })).resolves.toMatchObject({ success: true });
    expect(h.writes).toHaveLength(2);
    expect(h.writes.every((entry) => entry.operation === "update" && !('isTeamMember' in entry.values))).toBe(true);
  });

  it("records a linked employee's role change without reactivating or modifying duplicate history", async () => {
    const duplicate = { ...profile, id: 41, isTeamMember: false };
    const h = harness({ profiles: [profile, duplicate], directory: [employee] });
    await expect(edit({ ...input, role: "Yoga Instructor" as any })).resolves.toMatchObject({ roleChanged: true });
    expect(h.writes.filter((entry) => entry.operation === "update").map((entry) => entry.table)).toEqual([jobApplications, employees]);
    expect(h.writes.filter((entry) => entry.operation === "insert")).toEqual([
      { operation: "insert", table: jobApplicationActions, values: expect.objectContaining({ applicationId: 42, action: "employee_role_changed" }) },
    ]);
  });

  it("retains the role-change audit and duty retirement for an unlinked legacy team member", async () => {
    const assignment = { id: 55, staffId: 42, scheduleId: 10, staffName: profile.name, classDate: "2099-01-01" };
    const h = harness({ assignments: [assignment] });
    await expect(edit({ ...input, role: "Yoga Instructor" as any })).resolves.toMatchObject({ roleChanged: true, retiredClassAssignments: 1 });
    expect(h.writes).toContainEqual({ operation: "insert", table: jobApplicationActions, values: expect.objectContaining({ applicationId: 42, action: "employee_role_changed" }) });
    expect(h.writes).toContainEqual({ operation: "insert", table: jobApplicationActions, values: expect.objectContaining({ applicationId: 42, action: "staff_duties_retired_role_change" }) });
    expect(h.writes).toContainEqual({ operation: "delete", table: classStaffAssignments });
  });
});
