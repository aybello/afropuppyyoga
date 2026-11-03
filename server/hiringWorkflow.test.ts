import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { employees, jobApplications, signingTokens, staffingMutationLocks } from "../drizzle/schema";
import { getHiringWorkflow } from "../shared/hiringWorkflow";
import { hireSignedApplicant, preflightHireSignedApplicant } from "./hireSignedApplicant";
import { hiringReviewSnapshot, issueHiringReviewToken } from "./hiringDuplicateIdentity";
import { prepareHiringOffer, recordCurrentOfferSignature } from "./hiringOfferLifecycle";
const { getDb, resolveApyAccess } = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("./db", () => ({ getDb }));
vi.mock("./apyAccess", () => ({ resolveApyAccess }));
import { staffAvailabilityRouter } from "./routers/staffAvailability";
const actor = { id: 1, name: "Owner", email: "owner@example.com" };
const app = { id: 42, name: "Fictional Applicant", email: "applicant@example.com", phone: null, role: "Puppy Monitor", location: "Kitchener", status: "accepted", onboardingSentAt: null, onboardingDeliveryToken: null, isTeamMember: false, deletedAt: null };
const offer = { id: 2, applicationId: 42, signed: 1, applicantName: app.name, applicantEmail: app.email, role: app.role, location: app.location, offerLetterType: "puppy_monitor_kw", expiresAt: new Date("2099-01-01"), createdAt: new Date(), token: "fictional" };
function harness(reads: unknown[][], affectedRows = 1) {
  const updates: any[] = [], inserts: any[] = [], updatePredicates: any[] = [];
  const tx: any = {
    select: vi.fn(() => {
      let result: unknown[];
      const chain: any = { from: (table: unknown) => { result = table === staffingMutationLocks ? [] : reads.shift() ?? []; return chain; },
        where: () => chain, orderBy: () => chain, limit: () => chain, for: async () => result, then: (resolve: any) => resolve(result) };
      return chain;
    }),
    insert: (table: unknown) => ({ values: (values: unknown) => { if (table !== staffingMutationLocks) inserts.push({ table, values }); const result: any = [{ insertId: 7 }]; result.onDuplicateKeyUpdate = async () => result; return result; } }),
    update: (table: unknown) => ({ set: (values: unknown) => ({ where: async (predicate: unknown) => { updates.push({ table, values }); updatePredicates.push({ table, predicate }); return [{ affectedRows }]; } }) }),
  };
  const db = { select: tx.select, transaction: vi.fn(async (callback: any) => callback(tx)) };
  return { db, tx, updates, inserts, updatePredicates };
}
beforeEach(() => { vi.stubEnv("JWT_SECRET", "test-hiring-review-secret"); getDb.mockReset(); resolveApyAccess.mockResolvedValue({ level: "owner", canManageOperations: true }); });

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
  it.each([
    ["Movement Instructor", "KW"], ["Movement Instructor", "GUE"],
    ["Operations Specialist", "GUE"], ["Puppy Monitor", "GUE"],
  ])("hires signed %s applicants in %s without manager privileges", async (role, location) => {
    const applicant = { ...app, role, location };
    const h = harness([[applicant], [], [{ ...offer, role, location }], [applicant]]);
    await expect(hireSignedApplicant(h.db, 42, actor)).resolves.toMatchObject({ portalAccessLevel: "team_member" });
    expect(h.inserts.find((entry) => entry.table === employees)?.values).toMatchObject({ role, location, sourceApplicationId: app.id });
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
  it("requires an explicit acknowledgement and authentic token for exact duplicates", async () => {
    const selected = { ...app, phone: "4165550101" };
    const duplicate = { ...selected, id: 55 };
    const token = issueHiringReviewToken(actor.id, hiringReviewSnapshot(selected, offer, [selected, duplicate], []));
    for (const review of [undefined, { token: "forged", acknowledged: true }, { token, acknowledged: false }, { token: `${token}x`, acknowledged: true }]) {
      const h = harness([[selected], [], [offer], [selected, duplicate]]);
      await expect(hireSignedApplicant(h.db, 42, actor, selected, review as any)).rejects.toThrow("Review all matching");
      expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
    }
    const otherActor = harness([[selected], [], [offer], [selected, duplicate]]);
    await expect(hireSignedApplicant(otherActor.db, 42, { ...actor, id: 2 }, selected, { token, acknowledged: true })).rejects.toThrow("Review all matching");
  });
  it.each(["offer", "selected", "conflict", "role", "location", "archived", "addition", "removal", "ownership", "expiry"])("rejects stale review when %s changes", async (change) => {
    const selected = { ...app, phone: "4165550101" };
    const duplicate = { ...selected, id: 55 };
    const token = issueHiringReviewToken(actor.id, hiringReviewSnapshot(selected, offer, [selected, duplicate], []));
    const current = change === "offer" ? { ...offer, id: 3 } : offer;
    const changed = change === "selected" ? { ...selected, name: "Fictional  Applicant" } : selected;
    const changedConflict = change === "conflict" ? { ...duplicate, status: "rejected" }
      : change === "role" ? { ...duplicate, role: "Yoga Instructor" }
      : change === "location" ? { ...duplicate, location: "OAK" }
      : change === "archived" ? { ...duplicate, deletedAt: new Date("2024-01-01") } : duplicate;
    const records = change === "removal" ? [changed] : change === "addition" ? [changed, duplicate, { ...duplicate, id: 56 }] : [changed, changedConflict];
    const directory = change === "ownership" ? [{ ...selected, id: 7, sourceApplicationId: null, employmentStatus: "active" }] : [];
    if (change === "expiry") vi.setSystemTime(Date.now() + 601_000);
    const h = harness([[changed], directory, [current], records]);
    await expect(hireSignedApplicant(h.db, 42, actor, changed, { token, acknowledged: true })).rejects.toThrow(change === "removal" || change === "archived" ? "no longer current" : "Review all matching");
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
    vi.useRealTimers();
  });
  it("lists archived linked matches in preflight and refuses review", async () => {
    const selected = { ...app, phone: "4165550101" };
    const archived = { ...selected, id: 55, deletedAt: new Date("2020-01-01") };
    const linked = { id: 9, name: "Other", email: "other@example.com", phone: null, sourceApplicationId: 55, employmentStatus: "inactive" };
    const preview = harness([[selected], [offer], [linked], [selected, archived]]);
    const result = await preflightHireSignedApplicant(preview.db, 42, actor);
    expect(result).toMatchObject({ canReview: false, reviewToken: null, conflicts: [{ id: 55, directoryOwnerIds: [9] }] });
    const h = harness([[selected], [linked], [offer], [selected, archived]]);
    await expect(hireSignedApplicant(h.db, 42, actor)).rejects.toThrow("Another applicant");
    expect(h.updates).toEqual([]);
  });
  it("allows authorized managers to read all review details but requires a configured signing secret", async () => {
    const selected = { ...app, phone: "4165550101" };
    const duplicate = { ...selected, id: 55, status: "rejected", role: "Movement Instructor", location: "GUE" };
    const preview = harness([[selected], [offer], [], [selected, duplicate]]);
    getDb.mockResolvedValue(preview.db);
    const result = await staffAvailabilityRouter.createCaller({ user: actor } as any).preflightHireSignedApplicant({ applicationId: 42 });
    expect(result).toMatchObject({ canReview: true, selected: { id: 42, email: selected.email }, conflicts: [{ id: 55, name: duplicate.name, email: duplicate.email, phone: duplicate.phone, role: duplicate.role, location: duplicate.location, status: "rejected" }], reviewToken: expect.any(String) });
    expect(preview.updates).toEqual([]); expect(preview.inserts).toEqual([]);
    vi.stubEnv("JWT_SECRET", "");
    const noSecret = harness([[selected], [offer], [], [selected, duplicate]]);
    await expect(preflightHireSignedApplicant(noSecret.db, 42, actor)).rejects.toThrow("signing secret");
  });
  it("hires the selected signed applicant with two exact historical applications, without changing their history", async () => {
    const selected = { ...app, name: "Kayley  Example", email: "KAYLEY@example.com", phone: "(416) 555-0101" };
    const older = [
      { ...selected, id: 8, name: "  kayley\tExample ", email: "kayley@example.com", phone: "+1 416-555-0101", status: "rejected" },
      { ...selected, id: 12, name: "Ｋａｙｌｅｙ Example", email: " kayley@example.com ", phone: "4165550101", status: "reviewed" },
    ];
    const before = structuredClone(older);
    const current = { ...offer, applicantEmail: selected.email };
    const preview = harness([[selected], [current], [], [older[1], selected, older[0]]]);
    const review = await preflightHireSignedApplicant(preview.db, selected.id, actor);
    expect(review.conflicts.map((p) => p.id)).toEqual([8, 12]);
    expect(preview.inserts).toEqual([]); expect(preview.updates).toEqual([]);
    const h = harness([[selected], [], [current], [older[1], selected, older[0]]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor, selected, { token: review.reviewToken!, acknowledged: true })).resolves.toMatchObject({ id: 7, alreadyAdded: false });
    expect(older).toEqual(before);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({ table: jobApplications, values: { status: "onboarded", isTeamMember: true } });
    const sql = new MySqlDialect().sqlToQuery(h.updatePredicates[0].predicate);
    expect(sql.params).toContain(selected.id);
    expect(sql.params).not.toContain(older[0].id);
    expect(sql.params).not.toContain(older[1].id);
    expect(h.inserts.find((entry) => entry.table === employees)?.values.sourceApplicationId).toBe(selected.id);
    const action = h.inserts.find((entry) => entry.values.action)?.values;
    expect(action.applicationId).toBe(selected.id);
    expect(JSON.parse(action.details)).toMatchObject({ signingTokenId: offer.id, duplicateReview: { version: 2, canonicalApplicationId: 42, employeeId: 7, reviewed: [{ applicationId: 8, recordHash: expect.stringMatching(/^[a-f0-9]{64}$/) }, { applicationId: 12, recordHash: expect.stringMatching(/^[a-f0-9]{64}$/) }] } });
    expect(action.details).not.toContain(selected.email);
    expect(h.inserts).toHaveLength(2); // employee and audit only, no document transfer
  });
  it.each([
    ["different name", { name: "Other Applicant" }],
    ["different email and shared phone", { email: "other@example.com" }],
    ["different phone and shared email", { phone: "4165550199" }],
    ["missing email", { email: null }],
    ["missing phone", { phone: null }],
    ["invalid email", { email: "bad@example" }],
    ["invalid phone", { phone: "4165550101 ext 1" }],
    ["phone containing letters", { phone: "4165550101x" }],
    ["active team member", { isTeamMember: true }],
    ["onboarded profile", { status: "onboarded" }],
  ])("blocks ambiguous duplicate: %s", async (_reason, change) => {
    const selected = { ...app, phone: "4165550101" };
    const duplicate = { ...selected, id: 55, ...change };
    const h = harness([[selected], [], [offer], [selected, duplicate]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor)).rejects.toThrow("Another applicant");
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
  });
  it("rejects the whole operation if any one of multiple conflicts is ambiguous", async () => {
    const selected = { ...app, phone: "4165550101" };
    const h = harness([[selected], [], [offer], [selected, { ...selected, id: 8 }, { ...selected, id: 12, name: "Another Name" }]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor)).rejects.toThrow("Another applicant");
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
  });
  it.each([
    ["missing selected email", { email: null }],
    ["malformed selected email", { email: "bad@example" }],
    ["missing selected phone", { phone: null }],
    ["malformed selected phone", { phone: "4165550101 ext 1" }],
  ])("blocks duplicates when %s", async (_reason, change) => {
    const selected = { ...app, phone: "4165550101", ...change };
    const duplicate = { ...selected, id: 55 };
    const current = { ...offer, applicantEmail: selected.email ?? "" };
    const h = harness([[selected], [], [current], [selected, duplicate]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor)).rejects.toThrow();
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
  });
  it.each([false, true])("blocks an employee linked to a historical duplicate (legacy match: %s)", async (legacy) => {
    const selected = { ...app, phone: "4165550101" };
    const duplicate = { ...selected, id: 55 };
    const linked = { id: 99, sourceApplicationId: 55, name: "Unrelated", email: "other@example.com", phone: null, employmentStatus: "inactive" };
    const legacyEmployee = { ...selected, id: 7, sourceApplicationId: null, employmentStatus: "active" };
    const h = harness([[selected], legacy ? [linked, legacyEmployee] : [linked], [offer], [selected, duplicate]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor)).rejects.toThrow("Another applicant");
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
  });
  it("links a matching unlinked legacy employee while leaving safe historical applications untouched", async () => {
    const selected = { ...app, phone: "4165550101" };
    const duplicate = { ...selected, id: 55, status: "rejected" };
    const legacy = { ...selected, id: 7, sourceApplicationId: null, employmentStatus: "active" };
    const token = issueHiringReviewToken(actor.id, hiringReviewSnapshot(selected, offer, [duplicate, selected], [legacy]));
    const h = harness([[selected], [legacy], [offer], [duplicate, selected]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor, selected, { token, acknowledged: true })).resolves.toMatchObject({ id: 7 });
    expect(h.updates).toHaveLength(2);
    expect(h.updates.find((entry) => entry.table === employees)?.values.sourceApplicationId).toBe(selected.id);
    expect(JSON.parse(h.inserts.find((entry) => entry.values.action).values.details).duplicateReview.reviewed[0].applicationId).toBe(55);
    expect(h.inserts.some((entry) => entry.table === employees)).toBe(false);
  });
  it("ignores an unrelated inert archived applicant without transferring their documents", async () => {
    const selected = { ...app, phone: "4165550101" };
    const archived = { ...selected, id: 56, name: "Different", deletedAt: new Date() };
    const h = harness([[selected], [], [offer], [selected, archived]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor)).resolves.toMatchObject({ id: 7 });
    expect(h.updates).toHaveLength(1);
    const sql = new MySqlDialect().sqlToQuery(h.updatePredicates[0].predicate);
    expect(sql.params).toContain(selected.id);
    expect(sql.params).not.toContain(archived.id);
    expect(h.inserts).toHaveLength(2);
    expect(JSON.parse(h.inserts.find((entry) => entry.values.action).values.details)).not.toHaveProperty("duplicateReview");
  });
  it.each([null, { ...offer, signed: 0 }, { ...offer, applicantEmail: "other@example.com" }])("never bypasses current offer checks when duplicates exist", async (current) => {
    const selected = { ...app, phone: "4165550101" };
    const h = harness([[selected], [], current ? [current] : [], [selected, { ...selected, id: 55 }]]);
    await expect(hireSignedApplicant(h.db, selected.id, actor)).rejects.toThrow();
    expect(h.updates).toEqual([]); expect(h.inserts).toEqual([]);
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
    await expect(staffAvailabilityRouter.createCaller({ user: null } as any).preflightHireSignedApplicant({ applicationId: 42 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    resolveApyAccess.mockResolvedValue({ level: "team_member", canManageOperations: false });
    await expect(staffAvailabilityRouter.createCaller({ user: actor } as any).preflightHireSignedApplicant({ applicationId: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staffAvailabilityRouter.createCaller({ user: actor } as any).addSignedApplicantToDirectory({ applicationId: 42, confirmed: app })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("current offer lifecycle", () => {
  it("issues an Operations Manager offer with its own letter instead of a Puppy Monitor document", async () => {
    const manager = { ...app, role: "Operations Manager" };
    const h = harness([[manager], []]);
    await expect(prepareHiringOffer(h.db, 42)).resolves.toMatchObject({ offerLetterType: "operations_manager" });
    expect(h.inserts.find((entry) => entry.table === signingTokens)?.values).toMatchObject({
      offerLetterType: "operations_manager", puppyMonitorShiftPayCad: null, movementInstructorHourlyPayCad: null,
    });
  });
  it.each(["Videographer", "Photographer", "Marketing Lead"])(
    "refuses to issue any offer for the unsupported role %s and writes nothing",
    async (role) => {
      const h = harness([[{ ...app, role }], []]);
      await expect(prepareHiringOffer(h.db, 42)).rejects.toThrow(/No approved offer letter/);
      expect(h.inserts).toEqual([]);
      expect(h.updates).toEqual([]);
    }
  );
  it("stores the approved CA$60 only when creating a new Puppy Monitor offer", async () => {
    const h = harness([[app], []]);
    await expect(prepareHiringOffer(h.db, 42)).resolves.toMatchObject({ reuse: false });
    expect(h.inserts.find((entry) => entry.table === signingTokens)?.values).toMatchObject({
      puppyMonitorShiftPayCad: 60, offerLetterType: "puppy_monitor_kw",
    });
    const movement = harness([[{ ...app, role: "Movement Instructor" }], []]);
    await prepareHiringOffer(movement.db, 42);
    expect(movement.inserts.find((entry) => entry.table === signingTokens)?.values.puppyMonitorShiftPayCad).toBeNull();
    const social = harness([[{ ...app, role: "Social Media Intern", location: "REMOTE" }], []]);
    await prepareHiringOffer(social.db, 42);
    expect(social.inserts.find((entry) => entry.table === signingTokens)?.values).toMatchObject({
      offerLetterType: "social_media_intern",
      puppyMonitorShiftPayCad: null,
      movementInstructorHourlyPayCad: null,
    });
  });
  it.each([null, 60])("does not rewrite payment on a reused unsigned offer with saved amount %s", async (savedAmount) => {
    const h = harness([[app], [{ ...offer, signed: 0, puppyMonitorShiftPayCad: savedAmount }]]);
    await expect(prepareHiringOffer(h.db, 42)).resolves.toMatchObject({ reuse: true });
    expect(h.inserts).toEqual([]);
    expect(h.updates).toEqual([]);
  });
  it("repairs a mismatched unsigned Social Media offer only when the applicant details still match", async () => {
    const socialApp = { ...app, role: "Social Media Intern", location: "REMOTE" };
    const wrongOffer = { ...offer, role: socialApp.role, location: socialApp.location, signed: 0, offerLetterType: "puppy_monitor_kw" };
    const h = harness([[socialApp], [wrongOffer]]);
    await expect(prepareHiringOffer(h.db, 42)).resolves.toMatchObject({ reuse: true, offerLetterType: "social_media_intern" });
    expect(h.updates).toContainEqual({ table: signingTokens, values: expect.objectContaining({ offerLetterType: "social_media_intern", puppyMonitorShiftPayCad: null, movementInstructorHourlyPayCad: null }) });

    const signed = harness([[socialApp], [{ ...wrongOffer, signed: 1 }]]);
    await expect(prepareHiringOffer(signed.db, 42)).rejects.toThrow("already signed");
    expect(signed.updates).toEqual([]);

    const changed = harness([[{ ...socialApp, email: "changed@example.com" }], [wrongOffer]]);
    await expect(prepareHiringOffer(changed.db, 42)).resolves.toMatchObject({ reuse: false, offerLetterType: "social_media_intern" });
    expect(changed.updates).toEqual([]);
    expect(changed.inserts).toHaveLength(1);

    const expired = harness([[socialApp], [{ ...wrongOffer, expiresAt: new Date("2000-01-01") }]]);
    await expect(prepareHiringOffer(expired.db, 42)).resolves.toMatchObject({ reuse: false, offerLetterType: "social_media_intern" });
    expect(expired.updates).toEqual([]);
    expect(expired.inserts).toHaveLength(1);
  });
  it("does not rewrite an unrelated role mismatch when preparing a new offer", async () => {
    const otherApp = { ...app, role: "Operations Specialist", location: "GUE" };
    const mismatched = { ...offer, role: otherApp.role, location: otherApp.location, signed: 0, offerLetterType: "puppy_monitor_kw" };
    const h = harness([[otherApp], [mismatched]]);
    await expect(prepareHiringOffer(h.db, 42)).resolves.toMatchObject({ reuse: false, offerLetterType: "operations_specialist" });
    expect(h.updates).toEqual([]);
    expect(h.inserts).toHaveLength(1);
  });
  it.each([undefined, 50])("refuses an old signing tab that did not review the stored CA$60 amount: %s", async (displayedAmount) => {
    const h = harness([[{ ...offer, signed: 0, offerLetterType: "puppy_monitor_kw", puppyMonitorShiftPayCad: 60 }]]);
    await expect(recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test", "puppy_monitor_kw", displayedAmount)).rejects.toThrow("refresh this signing page");
    expect(h.updates).toEqual([]);
  });
  it("signs the exact current amount and preserves legacy CA$50 stored offer terms", async () => {
    for (const savedAmount of [null, 60]) {
      const record = { ...offer, signed: 0, offerLetterType: "puppy_monitor_kw", puppyMonitorShiftPayCad: savedAmount };
      const h = harness([[record], [app], [record]]);
      await recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test", "puppy_monitor_kw", savedAmount ?? undefined);
      expect(h.updates).toContainEqual({ table: signingTokens, values: expect.objectContaining({ signed: 1 }) });
      expect(h.updates.some((entry) => "puppyMonitorShiftPayCad" in entry.values)).toBe(false);
    }
  });
  it("rejects a stale page after an unsigned offer is repaired to the correct Social Media template", async () => {
    const socialApp = { ...app, role: "Social Media Intern", location: "REMOTE" };
    const repairedOffer = { ...offer, role: socialApp.role, location: socialApp.location, signed: 0, offerLetterType: "social_media_intern" };
    const preReleasePage = harness([[repairedOffer]]);
    await expect(recordCurrentOfferSignature(preReleasePage.db, "fictional", "Fictional", "test", undefined)).rejects.toThrow("current Offer Letter");
    expect(preReleasePage.updates).toEqual([]);

    const stalePage = harness([[repairedOffer]]);
    await expect(recordCurrentOfferSignature(stalePage.db, "fictional", "Fictional", "test", "puppy_monitor_kw")).rejects.toThrow("current Offer Letter");
    expect(stalePage.updates).toEqual([]);

    const currentPage = harness([[repairedOffer], [socialApp], [repairedOffer]]);
    await recordCurrentOfferSignature(currentPage.db, "fictional", "Fictional", "test", "social_media_intern");
    expect(currentPage.updates).toContainEqual({ table: signingTokens, values: expect.objectContaining({ signed: 1 }) });
  });
  it("never rewrites a signed offer while checking the submitted offer type", async () => {
    const signedOffer = { ...offer, signed: 1, offerLetterType: "puppy_monitor_kw" };
    const h = harness([[signedOffer]]);
    await expect(recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test", "social_media_intern")).rejects.toThrow("already been signed");
    expect(h.updates).toEqual([]);
  });
  it.each([
    ["a saved CA$19 rate confirmed by the page", 19, 19],
    ["an offer issued before a rate existed", null, undefined],
  ])("signs a Social Media offer showing %s", async (_label, savedAmount, confirmedAmount) => {
    const socialApp = { ...app, role: "Social Media Intern", location: "REMOTE" };
    const record = { ...offer, role: socialApp.role, location: socialApp.location, signed: 0, offerLetterType: "social_media_intern", socialMediaHourlyPayCad: savedAmount };
    const h = harness([[record], [socialApp], [record]]);
    await recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test", "social_media_intern", undefined, undefined, confirmedAmount as number | undefined);
    expect(h.updates).toContainEqual({ table: signingTokens, values: expect.objectContaining({ signed: 1 }) });
    expect(h.updates.some((entry) => "socialMediaHourlyPayCad" in entry.values)).toBe(false);
  });
  it.each([
    ["a saved rate the page did not show", 19, undefined],
    ["a rate the stored offer never carried", null, 19],
  ])("refuses a Social Media signing tab showing %s", async (_label, savedAmount, confirmedAmount) => {
    const record = { ...offer, role: "Social Media Intern", location: "REMOTE", signed: 0, offerLetterType: "social_media_intern", socialMediaHourlyPayCad: savedAmount };
    const h = harness([[record]]);
    await expect(
      recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test", "social_media_intern", undefined, undefined, confirmedAmount as number | undefined)
    ).rejects.toThrow("refresh this signing page");
    expect(h.updates).toEqual([]);
  });
  it("reuses an unsigned current offer and rejects an already-hired applicant", async () => {
    const h = harness([[app], [{ ...offer, signed: 0 }]]);
    await expect(prepareHiringOffer(h.db, 42)).resolves.toMatchObject({ reuse: true, token: "fictional" }); expect(h.inserts).toEqual([]);
    await expect(prepareHiringOffer(harness([[{ ...app, status: "onboarded" }]]).db, 42)).rejects.toThrow("already an employee");
  });
  it("does not accept an obsolete offer link or reset a hired employee", async () => {
    const h = harness([[{ ...offer, signed: 0 }], [app], [{ ...offer, id: 3 }]]);
    await expect(recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test", "puppy_monitor_kw")).rejects.toThrow("replaced"); expect(h.updates).toEqual([]);
    const hired = harness([[{ ...offer, signed: 0 }], [{ ...app, status: "onboarded", isTeamMember: true }]]);
    await expect(recordCurrentOfferSignature(hired.db, "fictional", "Fictional", "test", "puppy_monitor_kw")).rejects.toThrow("already an employee");
  });
  it("saves the signature but does not grant access until the explicit add employee action", async () => {
    const h = harness([[{ ...offer, signed: 0 }], [app], [offer]]);
    await recordCurrentOfferSignature(h.db, "fictional", "Fictional", "test", "puppy_monitor_kw");
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
