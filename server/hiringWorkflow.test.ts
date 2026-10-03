import { beforeEach, describe, expect, it, vi } from "vitest";
import { employees, jobApplications, signingTokens, staffingMutationLocks } from "../drizzle/schema";
import { getHiringWorkflow } from "../shared/hiringWorkflow";
import { hireSignedApplicant } from "./hireSignedApplicant";
import { prepareHiringOffer, recordCurrentOfferSignature } from "./hiringOfferLifecycle";
const { getDb, resolveApyAccess } = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("./db", () => ({ getDb }));
vi.mock("./apyAccess", () => ({ resolveApyAccess }));
import { staffAvailabilityRouter } from "./routers/staffAvailability";
const actor = { id: 1, name: "Owner", email: "owner@example.com" };
const app = { id: 42, name: "Fictional Applicant", email: "applicant@example.com", phone: null, role: "Puppy Monitor", location: "Kitchener", status: "accepted", onboardingSentAt: null, onboardingDeliveryToken: null, isTeamMember: false, deletedAt: null };
const offer = { id: 2, applicationId: 42, signed: 1, applicantName: app.name, applicantEmail: app.email, role: app.role, location: app.location, expiresAt: new Date("2099-01-01"), createdAt: new Date(), token: "fictional" };
function harness(reads: unknown[][], affectedRows = 1) {
  const updates: any[] = [], inserts: any[] = [];
  const tx: any = {
    select: vi.fn(() => {
      let result: unknown[];
      const chain: any = { from: (table: unknown) => { result = table === staffingMutationLocks ? [] : reads.shift() ?? []; return chain; },
        where: () => chain, orderBy: () => chain, limit: async () => result, for: async () => result, then: (resolve: any) => resolve(result) };
      return chain;
    }),
    insert: (table: unknown) => ({ values: (values: unknown) => { if (table !== staffingMutationLocks) inserts.push({ table, values }); const result: any = [{ insertId: 7 }]; result.onDuplicateKeyUpdate = async () => result; return result; } }),
    update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); return [{ affectedRows }]; } }) }),
  };
  const db = { transaction: vi.fn(async (callback: any) => callback(tx)) };
  return { db, tx, updates, inserts };
}
beforeEach(() => { getDb.mockReset(); resolveApyAccess.mockResolvedValue({ level: "owner", canManageOperations: true }); });

describe("signed offer to employee", () => {
  it("enables login and adds one employee without onboarding documents, but never marks training complete", async () => {
    const h = harness([[app], [], [offer], [app]]);
    await expect(hireSignedApplicant(h.db, 42, actor)).resolves.toMatchObject({ id: 7, grantsPortalAccess: true, portalAccessLevel: "team_member" });
    expect(h.updates).toContainEqual({ table: jobApplications, values: expect.objectContaining({ status: "onboarded", isTeamMember: true }) });
    expect(h.inserts.filter((entry) => entry.table === employees)).toHaveLength(1);
    expect(h.inserts.some((entry) => entry.table === jobApplications)).toBe(false);
    expect(JSON.stringify(h.updates.map((entry) => entry.values))).not.toContain('onboardingSentAt');
    expect(h.inserts.find((entry) => entry.values.action)?.values.details).toContain('"trainingCompleted":false');
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
  });
  it.each([{ phone: "+14165550101" }, { email: "changed@example.com" }, { role: "Operations Manager" }, { name: "Another Name" }, { location: "HAM" }])("rejects a stale identity or assignment confirmation %j", async (change) => {
    const h = harness([[{ ...app, ...change }]]);
    await expect(hireSignedApplicant(h.db, 42, actor, app)).rejects.toThrow("changed after you opened confirmation");
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
  });
  it("keeps Operations Manager access explicit and role-specific", async () => {
    const manager = { ...app, role: "Operations Manager" };
    await expect(hireSignedApplicant(harness([[manager], [], [{ ...offer, role: manager.role }], [manager]]).db, 42, actor)).resolves.toMatchObject({ portalAccessLevel: "operations_manager" });
  });
  it.each([null, { ...offer, signed: 0 }])("rejects absent or current unsigned offers even if an older offer was signed", async (current) => {
    const h = harness([[app], [], current ? [current] : []]);
    await expect(hireSignedApplicant(h.db, 42, actor)).rejects.toThrow("current Offer Letter");
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
  });
  it.each([{ role: "Yoga Instructor" }, { location: "Hamilton" }, { applicantEmail: "other@example.com" }])("rejects changed signed assignment or identity %j", async (change) => {
    const h = harness([[app], [], [{ ...offer, ...change }]]);
    await expect(hireSignedApplicant(h.db, 42, actor)).rejects.toThrow("differ from the signed offer");
    expect(h.updates).toEqual([]);
  });
  it("returns the existing employee on a retry without duplicate insertion or reactivating a departed hire", async () => {
    const active = { id: 7, sourceApplicationId: 42, employmentStatus: "active" };
    const h = harness([[{ ...app, status: "onboarded", isTeamMember: true }], [active]]);
    await expect(hireSignedApplicant(h.db, 42, actor)).resolves.toMatchObject({ id: 7, alreadyAdded: true });
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
    await expect(hireSignedApplicant(harness([[app], [{ ...active, employmentStatus: "inactive" }]]).db, 42, actor)).rejects.toThrow("Manage or restore");
  });
  it.each([{ status: "rejected" }, { deletedAt: new Date() }, { onboardingDeliveryToken: "pending" }])("rejects closed or changing applications %j", async (change) => {
    const h = harness([[{ ...app, ...change }], []]);
    await expect(hireSignedApplicant(h.db, 42, actor)).rejects.toThrow(); expect(h.updates).toEqual([]);
  });
  it("does not steal a different employee's contact or reactivate an inactive contact match", async () => {
    for (const change of [{ name: "Different Person" }, { sourceApplicationId: 9 }, { employmentStatus: "inactive" }]) {
      const h = harness([[app], [{ ...app, id: 7, sourceApplicationId: null, employmentStatus: "active", ...change }], [offer]]);
      await expect(hireSignedApplicant(h.db, 42, actor)).rejects.toThrow("existing employee"); expect(h.updates).toEqual([]);
    }
  });
  it("links a matching active legacy Directory row rather than duplicating it", async () => {
    const h = harness([[app], [{ ...app, id: 7, sourceApplicationId: null, employmentStatus: "active" }], [offer], [app]]);
    await expect(hireSignedApplicant(h.db, 42, actor)).resolves.toMatchObject({ id: 7 });
    expect(h.inserts.some((entry) => entry.table === employees)).toBe(false);
  });
  it("blocks another live applicant with the same contact", async () => {
    const h = harness([[app], [], [offer], [app, { ...app, id: 55 }]]);
    await expect(hireSignedApplicant(h.db, 42, actor)).rejects.toThrow("Another applicant"); expect(h.updates).toEqual([]);
  });
  it("does not insert an employee when a stale status transition loses its race", async () => {
    const h = harness([[app], [], [offer], [app]], 0);
    await expect(hireSignedApplicant(h.db, 42, actor)).rejects.toThrow("applicant changed"); expect(h.inserts).toEqual([]);
  });
  it("requires old open tabs to reload without granting access", async () => {
    await expect(staffAvailabilityRouter.createCaller({ user: actor } as any).markOnboardedAndAddToEmployeeDirectory({ applicationId: 42 })).rejects.toThrow("Refresh Applications");
    expect(getDb).not.toHaveBeenCalled();
  });
  it("denies anonymous and non-management callers before reading employee records", async () => {
    await expect(staffAvailabilityRouter.createCaller({ user: null } as any).addSignedApplicantToDirectory({ applicationId: 42, confirmed: app })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    resolveApyAccess.mockResolvedValue({ level: "team_member", canManageOperations: false });
    await expect(staffAvailabilityRouter.createCaller({ user: actor } as any).addSignedApplicantToDirectory({ applicationId: 42, confirmed: app })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("current offer lifecycle", () => {
  it("reuses an unsigned current offer and rejects an already-hired applicant", async () => {
    const h = harness([[app], [{ ...offer, signed: 0 }]]);
    await expect(prepareHiringOffer(h.db, 42)).resolves.toMatchObject({ reuse: true, token: "fictional" }); expect(h.inserts).toEqual([]);
    await expect(prepareHiringOffer(harness([[{ ...app, status: "onboarded" }]]).db, 42)).rejects.toThrow("already an employee");
  });
  it("does not accept an obsolete offer link or reset a hired employee", async () => {
    const h = harness([[{ ...offer, signed: 0 }], [app], [{ ...offer, id: 3 }]]);
    await expect(recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test")).rejects.toThrow("replaced"); expect(h.updates).toEqual([]);
    const hired = harness([[{ ...offer, signed: 0 }], [{ ...app, status: "onboarded", isTeamMember: true }]]);
    await expect(recordCurrentOfferSignature(hired.db, "fictional", "Fictional", "test")).rejects.toThrow("already an employee");
  });
  it("saves the signature but does not grant access until the explicit add employee action", async () => {
    const h = harness([[{ ...offer, signed: 0 }], [app], [offer]]);
    await recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test");
    expect(h.updates).toContainEqual({ table: jobApplications, values: { status: "accepted" } });
    expect(h.updates).toContainEqual({ table: signingTokens, values: expect.objectContaining({ signed: 1 }) });
    expect(h.inserts).toEqual([]);
  });
});

describe("clear hiring stages", () => {
  const base = { status: "new", signingStatus: null, onboardingSentAt: null, onboardingDeliveryToken: null };
  it("shows the signed offer as ready to hire before documents have been sent", () => {
    expect(getHiringWorkflow({ ...base, status: "accepted", signingStatus: "signed" })).toMatchObject({ stage: "signed", canAddEmployee: true, canSendDocuments: false });
    expect(getHiringWorkflow({ ...base, status: "accepted", signingStatus: "pending_signature" })).toMatchObject({ stage: "offer", canAddEmployee: false });
  });
  it("separates employee activation, documents and training without claiming completion", () => {
    const hired = { ...base, status: "onboarded", employeeId: 7, employeeStatus: "active", signingStatus: "signed" };
    expect(getHiringWorkflow(hired)).toMatchObject({ stage: "employee", canAddEmployee: false, canSendDocuments: true, canSendOffer: false });
    expect(getHiringWorkflow({ ...hired, onboardingSentAt: new Date() })).toMatchObject({ stage: "onboarding", next: expect.stringContaining("does not mean training is complete") });
    expect(getHiringWorkflow({ ...hired, employeeStatus: "inactive" }).canSendDocuments).toBe(false);
  });
  it("does not report offer delivery solely from an unsigned token", () => {
    expect(getHiringWorkflow({ ...base, signingStatus: "pending_signature" }).label).toContain("delivery not confirmed");
    expect(getHiringWorkflow({ ...base, signingStatus: "pending_signature", offerSentAt: new Date() }).label).toBe("Offer sent, awaiting signature");
  });
});
