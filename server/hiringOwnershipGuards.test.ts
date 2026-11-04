import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { employeeApplicationAssociations, employees, jobApplicationActions, jobApplications, signingTokens, staffingMutationLocks } from "../drizzle/schema";
import { hireSignedApplicant, preflightHireSignedApplicant } from "./hireSignedApplicant";
import { hasHiringOwnershipClaim, hiringReviewSnapshot, inspectHiringDuplicates, issueHiringReviewToken, legacyHiringOwnershipClaims, reviewedHiringRecordHash, verifyHiringReviewToken } from "./hiringDuplicateIdentity";
import { prepareHiringOffer, recordCurrentOfferSignature, withCurrentHiringOfferDelivery } from "./hiringOfferLifecycle";
import { createOfferDocumentSnapshot } from "./offerDocumentSnapshot";

const external = vi.hoisted(() => ({
  db: { getDb: vi.fn(), getSigningTokenByToken: vi.fn() },
  resolveApyAccess: vi.fn(), sendEmail: vi.fn(), sendOfferSigningEmail: vi.fn(), sendOfferSigningSms: vi.fn(), notifyOwner: vi.fn(), recordOfferSigningOutcome: vi.fn(),
}));
vi.mock("./db", () => external.db);
vi.mock("./apyAccess", () => ({ resolveApyAccess: external.resolveApyAccess }));
vi.mock("./email", () => ({ sendEmail: external.sendEmail }));
vi.mock("./offerSigningEmail", () => ({ sendOfferSigningEmail: external.sendOfferSigningEmail }));
vi.mock("./offerSigningSms", () => ({ sendOfferSigningSms: external.sendOfferSigningSms }));
vi.mock("./offerSigningAudit", () => ({ recordOfferSigningOutcome: external.recordOfferSigningOutcome }));
vi.mock("./_core/notification", () => ({ notifyOwner: external.notifyOwner }));
import { signingRouter } from "./routers/signing";

const actor = { id: 1, name: "Owner", email: "owner@example.com" };
const historical = { id: 41, name: "Reviewed Applicant", email: "old@example.com", phone: "+14165550101", role: "Puppy Monitor", location: "Kitchener", status: "accepted", isTeamMember: false, deletedAt: null, onboardingDeliveryToken: null, onboardingSentAt: null };
const canonical = { ...historical, id: 42, name: "Updated Employee", email: "new@example.com", phone: "+14165550102", status: "onboarded", isTeamMember: true };
const employee = { ...canonical, id: 7, sourceApplicationId: canonical.id, employmentStatus: "active", endedAt: null };
const legacyReview = { version: 2, canonicalApplicationId: canonical.id, employeeId: employee.id, reviewed: [{ applicationId: historical.id, recordHash: reviewedHiringRecordHash(historical) }] };
const legacyAction = (review: unknown = legacyReview) => ({ applicationId: canonical.id, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: employee.id, duplicateReview: review }) });
const offerFor = (app = historical, signed = 1) => ({ id: 3, applicationId: app.id, signed, applicantName: app.name, applicantEmail: app.email, role: app.role, location: app.location, offerLetterType: "puppy_monitor_kw", expiresAt: new Date("2099-01-01"), createdAt: new Date("2026-01-01"), token: "fictional-ownership-token", puppyMonitorShiftPayCad: null, movementInstructorHourlyPayCad: null, socialMediaHourlyPayCad: null, signedDocumentSnapshot: null });
const association = (applicationId = historical.id, employeeId = employee.id) => ({ applicationId, employeeId, canonicalApplicationId: canonical.id, recordHash: reviewedHiringRecordHash(historical) });

/** Table-based in-memory double: never connects to a database. */
function harness({ selected = historical, profiles = [canonical, historical], directory = [employee], offers = [offerFor(selected)], claims = [] as any[], actions = [legacyAction()] as any[], afterLock = undefined as (() => void) | undefined } = {}) {
  const tables = new Map<unknown, any[]>([[jobApplications, profiles], [employees, directory], [signingTokens, offers], [employeeApplicationAssociations, claims], [jobApplicationActions, actions], [staffingMutationLocks, [{ lockName: "apy_staffing_mutation_v1" }]]]);
  const writes: Array<{ table: unknown; values: any }> = [];
  const reads: Array<{ table: unknown; locked: boolean }> = [];
  const events: string[] = [];
  let lockAcquired = false;
  const tx: any = {
    select: vi.fn(() => {
      let table: unknown, predicate: any;
      const result = () => {
        const rows = tables.get(table) ?? [];
        if (table === jobApplications && predicate) {
          const params = new MySqlDialect().sqlToQuery(predicate).params;
          return rows.filter(row => params.includes(row.id));
        }
        return rows;
      };
      const chain: any = {
        from: (next: unknown) => { table = next; reads.push({ table, locked: lockAcquired }); return chain; },
        where: (next: unknown) => { predicate = next; return chain; },
        limit: () => chain, orderBy: () => chain,
        for: async (mode: string) => {
          expect(mode).toBe("update");
          if (table === staffingMutationLocks) { lockAcquired = true; events.push("lock"); afterLock?.(); }
          return result();
        },
        then: (resolve: any) => resolve(result()),
      };
      return chain;
    }),
    insert: (table: unknown) => ({ values: (values: any) => {
      const result: any = [{ insertId: 100 }];
      result.onDuplicateKeyUpdate = async () => result;
      if (table !== staffingMutationLocks) writes.push({ table, values });
      return result;
    } }),
    update: (table: unknown) => ({ set: (values: any) => ({ where: async () => { writes.push({ table, values }); return [{ affectedRows: 1 }]; } }) }),
  };
  const db = { select: tx.select, transaction: vi.fn(async (callback: any) => { try { return await callback(tx); } finally { lockAcquired = false; events.push("release"); } }) };
  return { db, writes, reads, events, claims, tables, selected };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("JWT_SECRET", "isolated-ownership-review-secret");
  external.db.getDb.mockRejectedValue(new Error("Unexpected external database access"));
  external.resolveApyAccess.mockResolvedValue({ level: "owner", canManageOperations: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("contact-independent reviewed hiring ownership", () => {
  it.each(["active", "inactive"])("blocks a legacy reviewed ID after its %s owner changes all contacts, without associations or backfill", async employmentStatus => {
    const directory = [{ ...employee, employmentStatus }];
    const before = structuredClone({ canonical, historical, directory, actions: [legacyAction()], offer: offerFor() });
    const preflight = harness({ directory });
    await expect(preflightHireSignedApplicant(preflight.db, historical.id, actor)).resolves.toMatchObject({ eligible: false, canReview: false, reviewToken: null, conflicts: [], eligibilityReason: expect.stringContaining("already has an employee") });
    expect(preflight.writes).toEqual([]);
    const mutation = harness({ directory });
    await expect(hireSignedApplicant(mutation.db, historical.id, actor, historical)).rejects.toThrow("already has an employee");
    expect(mutation.writes).toEqual([]);
    expect({ canonical, historical, directory, actions: [legacyAction()], offer: offerFor() }).toEqual(before);
    expect(mutation.reads.filter(read => read.table === jobApplicationActions)).toEqual([{ table: jobApplicationActions, locked: true }]);
  });

  it.each(["missing employee", "changed source"])("blocks a second hire of a pre-migration reviewed ID after contact changes and %s", async change => {
    const changed = { ...historical, name: "Changed Historical Applicant", email: "changed@example.com", phone: "+14165550103" };
    const directory = change === "missing employee" ? [] : [{ ...employee, sourceApplicationId: 99, employmentStatus: "inactive" }];
    const h = harness({ selected: changed, profiles: [canonical, changed], directory, offers: [offerFor(changed)] });
    const before = structuredClone({ directory, profiles: [canonical, changed], actions: [legacyAction()], offers: [offerFor(changed)] });
    await expect(preflightHireSignedApplicant(h.db, changed.id, actor)).resolves.toMatchObject({ eligible: false, canReview: false, reviewToken: null, conflicts: [], eligibilityReason: expect.stringContaining("Employee Directory") });
    await expect(hireSignedApplicant(h.db, changed.id, actor, changed)).rejects.toThrow("already has an employee");
    expect(h.writes).toEqual([]); expect(h.claims).toEqual([]);
    expect({ directory, profiles: [canonical, changed], actions: [legacyAction()], offers: [offerFor(changed)] }).toEqual(before);
    expect(h.reads.filter(read => read.table === jobApplicationActions).at(-1)).toEqual({ table: jobApplicationActions, locked: true });
  });

  it("keeps both canonical and reviewed IDs claimed without a directory parent", () => {
    const claims = legacyHiringOwnershipClaims([legacyAction()]);
    expect(claims).toEqual([
      { applicationId: 42, employeeId: 7, canonicalApplicationId: 42 },
      { applicationId: 41, employeeId: 7, canonicalApplicationId: 42 },
    ]);
    expect(hasHiringOwnershipClaim(new Set([canonical.id]), [], [], [legacyAction()])).toBe(true);
    expect(hasHiringOwnershipClaim(new Set([historical.id]), [], [], [legacyAction()])).toBe(true);
    expect(hasHiringOwnershipClaim(new Set([55]), [], [], [legacyAction()])).toBe(false);
  });

  it("does not release a legacy claim when the reviewed record's identity hash changes", async () => {
    const changed = { ...historical, name: "Changed Applicant", email: "changed@example.com", phone: "+14165550103" };
    expect(reviewedHiringRecordHash(changed)).not.toBe(legacyReview.reviewed[0].recordHash);
    const h = harness({ selected: changed, profiles: [canonical, changed], offers: [offerFor(changed)] });
    await expect(preflightHireSignedApplicant(h.db, changed.id, actor)).resolves.toMatchObject({ eligible: false, reviewToken: null });
    await expect(hireSignedApplicant(h.db, changed.id, actor, changed)).rejects.toThrow("already has an employee");
    expect(h.writes).toEqual([]);
  });

  it("blocks a new canonical selection if any current duplicate has a legacy owner", async () => {
    const selected = { ...historical, id: 55 };
    const token = issueHiringReviewToken(actor.id, hiringReviewSnapshot(selected, offerFor(selected), [canonical, historical, selected], [employee]));
    const h = harness({ selected, profiles: [canonical, historical, selected] });
    await expect(preflightHireSignedApplicant(h.db, selected.id, actor)).resolves.toMatchObject({ eligible: false, reviewToken: null });
    await expect(hireSignedApplicant(h.db, selected.id, actor, selected, { token, acknowledged: true })).rejects.toThrow("already has an employee");
    expect(h.writes).toEqual([]);
  });

  it("accumulates claims from every validated envelope rather than overwriting earlier reviews", () => {
    const later = { ...legacyReview, reviewed: [{ applicationId: 60, recordHash: "f".repeat(64) }] };
    expect(hasHiringOwnershipClaim(new Set([41]), [employee], [], [legacyAction(), legacyAction(later)])).toBe(true);
    expect(hasHiringOwnershipClaim(new Set([60]), [employee], [], [legacyAction(), legacyAction(later)])).toBe(true);
  });

  it.each([
    null, { ...legacyReview, version: 1 }, { ...legacyReview, employeeId: 8 },
    { ...legacyReview, canonicalApplicationId: 99 }, { ...legacyReview, reviewed: [] },
    { ...legacyReview, reviewed: [legacyReview.reviewed[0], legacyReview.reviewed[0]] },
    { ...legacyReview, reviewed: [{ applicationId: "41", recordHash: "a".repeat(64) }] },
    { ...legacyReview, reviewed: [{ applicationId: 41, recordHash: "not-a-hash" }] },
    { ...legacyReview, reviewed: [{ applicationId: 41, recordHash: "a".repeat(64) }, null] },
  ])("fails closed for a malformed matching audit envelope: %j", async invalid => {
    const h = harness({ actions: [legacyAction(invalid)] });
    await expect(preflightHireSignedApplicant(h.db, historical.id, actor)).rejects.toThrow("ownership could not be verified");
    await expect(hireSignedApplicant(h.db, historical.id, actor)).rejects.toThrow("ownership could not be verified");
    expect(h.writes).toEqual([]);
  });

  it("does not infer ownership or insert associations from same contacts or unrelated audit rows", async () => {
    const unrelated = [
      { ...legacyAction(), action: "other" },
      { ...legacyAction(), applicationId: 99, details: JSON.stringify({ employeeId: 99, duplicateReview: {
        version: 2, employeeId: 99, canonicalApplicationId: 99, reviewed: [{ applicationId: 60, recordHash: "a".repeat(64) }],
      } }) },
      { ...legacyAction(), details: JSON.stringify({ employeeId: 7 }) },
      { ...legacyAction(), details: "invalid JSON" },
    ];
    expect(hasHiringOwnershipClaim(new Set([historical.id]), [employee], [], unrelated)).toBe(false);
    const h = harness({ directory: [], profiles: [historical], actions: unrelated });
    await expect(hireSignedApplicant(h.db, historical.id, actor)).resolves.toMatchObject({ alreadyAdded: false });
    expect(h.writes.some(write => write.table === employeeApplicationAssociations)).toBe(false);
  });
});

describe("preflight delivery-token privacy", () => {
  it("exposes only booleans for selected and conflicting delivery claims", async () => {
    const selected = { ...historical, id: 55, onboardingDeliveryToken: "selected-private-delivery" as any };
    const conflict = { ...historical, onboardingDeliveryToken: "conflict-private-delivery" as any };
    const h = harness({ selected, profiles: [selected, conflict], directory: [], actions: [] });
    const result = await preflightHireSignedApplicant(h.db, selected.id, actor);
    expect(result.selected.onboardingDeliveryToken).toBe(true);
    expect(result.conflicts[0].onboardingDeliveryToken).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/selected-private-delivery|conflict-private-delivery/);
    expect(h.writes).toEqual([]);
    expect(inspectHiringDuplicates(historical, [historical, { ...historical, id: 55 }], []).selected.onboardingDeliveryToken).toBe(false);
  });

  it.each(["selected", "conflict"])("privately binds the raw %s token, so replacing a non-empty claim invalidates the digest", target => {
    const selected = { ...historical, id: 55, onboardingDeliveryToken: "selected-a" as any };
    const conflict = { ...historical, onboardingDeliveryToken: "conflict-a" as any };
    const offer = offerFor(selected);
    const original = hiringReviewSnapshot(selected, offer, [selected, conflict], []);
    const token = issueHiringReviewToken(actor.id, original);
    const nextSelected = target === "selected" ? { ...selected, onboardingDeliveryToken: "selected-b" } : selected;
    const nextConflict = target === "conflict" ? { ...conflict, onboardingDeliveryToken: "conflict-b" } : conflict;
    expect(inspectHiringDuplicates(selected, [selected, conflict], [])).toEqual(inspectHiringDuplicates(nextSelected, [nextSelected, nextConflict], []));
    expect(verifyHiringReviewToken(token, actor.id, original)).toBe(true);
    expect(verifyHiringReviewToken(token, actor.id, hiringReviewSnapshot(nextSelected, offer, [nextSelected, nextConflict], []))).toBe(false);
    const publicTokenPayload = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
    expect(publicTokenPayload).not.toMatch(/selected-a|conflict-a|old@example/);
  });
});

describe("offer/signature ownership lock guards", () => {
  it.each(["association", "legacy", "source"])("rejects offer creation and reuse for a %s-owned noncanonical applicant without mutating documents/access", async kind => {
    for (const offers of [[], [offerFor(historical, 0)]]) {
      const claims = kind === "association" ? [association()] : [];
      const directory = kind === "source" ? [{ ...employee, sourceApplicationId: historical.id }] : [employee];
      const actions = kind === "legacy" ? [legacyAction()] : [];
      const h = harness({ offers, claims, directory, actions });
      const before = structuredClone({ historical, claims, offers, directory, actions });
      await expect(prepareHiringOffer(h.db, historical.id)).rejects.toThrow(/already belongs to an employee/);
      expect(h.writes).toEqual([]);
      expect({ historical, claims, offers, directory, actions }).toEqual(before);
      expect(h.db.transaction).toHaveBeenCalledTimes(1);
      expect(h.reads.filter(read => read.table === employeeApplicationAssociations)).toEqual([{ table: employeeApplicationAssociations, locked: true }]);
    }
  });

  it.each(["association", "legacy"])("rejects a preexisting current signing link after a %s claim is established", async kind => {
    const record = offerFor(historical, 0);
    const claims = kind === "association" ? [association()] : [];
    const actions = kind === "legacy" ? [legacyAction()] : [];
    const h = harness({ offers: [record], claims, actions });
    const before = structuredClone({ historical, record, claims, actions });
    await expect(recordCurrentOfferSignature(h.db, record.token, historical.name, "192.0.2.1", record.offerLetterType, undefined, undefined, undefined, createOfferDocumentSnapshot(record).sha256)).rejects.toThrow(/already belongs to an employee/);
    expect(h.writes).toEqual([]);
    expect({ historical, record, claims, actions }).toEqual(before);
  });

  it.each(["offer", "signature"])("observes an association established while %s waits to acquire the shared lock", async operation => {
    const record = offerFor(historical, 0);
    const claims: any[] = [];
    const h = harness({ offers: [record], claims, actions: [], afterLock: () => claims.push(association()) });
    const result = operation === "offer" ? prepareHiringOffer(h.db, historical.id) : recordCurrentOfferSignature(h.db, record.token, historical.name, "192.0.2.1", record.offerLetterType);
    await expect(result).rejects.toThrow(/already belongs to an employee/);
    expect(h.events).toEqual(["lock", "release"]);
    expect(h.writes).toEqual([]);
  });

  it("rejects association claims even if the owner is inactive or the applicant hash changed", async () => {
    const changed = { ...historical, name: "Updated Historical Record", email: "changed@example.com" };
    const record = offerFor(changed, 0);
    const h = harness({ selected: changed, profiles: [canonical, changed], directory: [{ ...employee, employmentStatus: "inactive" }], offers: [record], claims: [association()], actions: [] });
    await expect(prepareHiringOffer(h.db, changed.id)).rejects.toThrow("already belongs");
    await expect(recordCurrentOfferSignature(h.db, record.token, changed.name, "192.0.2.1", record.offerLetterType)).rejects.toThrow("already belongs");
    expect(h.writes).toEqual([]);
  });

  it("rechecks ownership before a delayed dispatch and never invokes the provider callback for a newly claimed applicant", async () => {
    const record = offerFor(historical, 0);
    const claims: any[] = [];
    const h = harness({ offers: [record], claims, actions: [] });
    await prepareHiringOffer(h.db, historical.id);
    claims.push(association());
    const dispatch = vi.fn();
    await expect(withCurrentHiringOfferDelivery(h.db, historical.id, record.token, historical, dispatch)).rejects.toThrow("already belongs");
    expect(dispatch).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
  });

  it("keeps the shared staffing lock until asynchronous provider dispatch completes", async () => {
    const record = offerFor(historical, 0);
    const h = harness({ offers: [record], directory: [], actions: [] });
    let complete!: () => void;
    const pending = new Promise<void>(resolve => { complete = resolve; });
    let entered!: () => void;
    const providerEntered = new Promise<void>(resolve => { entered = resolve; });
    const delivery = withCurrentHiringOfferDelivery(h.db, historical.id, record.token, historical, async () => {
      expect(h.events).toEqual(["lock"]);
      entered();
      await pending;
      expect(h.events).toEqual(["lock"]);
      return "sent";
    });
    await providerEntered;
    expect(h.events).toEqual(["lock"]);
    complete();
    await expect(delivery).resolves.toBe("sent");
    expect(h.events).toEqual(["lock", "release"]);
    expect(h.writes).toEqual([]);
  });

  it.each(["signed", "replacement", "email", "phone"])("rejects a prepared delivery after %s changes", async change => {
    const current = change === "email" ? { ...historical, email: "new-recipient@example.com" }
      : change === "phone" ? { ...historical, phone: "+14165550199" } : historical;
    const record = { ...offerFor(current, change === "signed" ? 1 : 0), token: change === "replacement" ? "replacement-token" : "fictional-ownership-token" };
    const h = harness({ selected: current, profiles: [current], offers: [record], directory: [], actions: [] });
    const dispatch = vi.fn();
    await expect(withCurrentHiringOfferDelivery(h.db, historical.id, "fictional-ownership-token", historical, dispatch)).rejects.toThrow("Refresh before sending");
    expect(dispatch).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
  });

  it("still signs an unclaimed applicant without granting login, changing compensation, or inserting associations", async () => {
    const record = offerFor(historical, 0);
    const h = harness({ profiles: [historical], directory: [], offers: [record], claims: [], actions: [] });
    await expect(recordCurrentOfferSignature(h.db, record.token, historical.name, "192.0.2.1", record.offerLetterType, undefined, undefined, undefined, createOfferDocumentSnapshot(record).sha256)).resolves.toEqual(record);
    expect(h.writes).toHaveLength(2);
    expect(h.writes[0]).toEqual({ table: jobApplications, values: { status: "accepted" } });
    expect(h.writes[1]).toMatchObject({ table: signingTokens, values: { signed: 1, signedDocumentSnapshot: expect.any(String) } });
    expect(JSON.stringify(h.writes.map(write => write.values))).not.toMatch(/isTeamMember|puppyMonitorShiftPayCad/);
  });
});

describe("signing router ownership rejection without outbound effects", () => {
  it.each(["association", "legacy"])("does not email/text an offer or notify after a %s ownership rejection", async kind => {
    const record = offerFor(historical, 0);
    const h = harness({ offers: [record], claims: kind === "association" ? [association()] : [], actions: kind === "legacy" ? [legacyAction()] : [] });
    external.db.getDb.mockResolvedValue(h.db);
    const caller = signingRouter.createCaller({ user: actor, res: { setHeader: vi.fn() } } as never);
    await expect(caller.createSigningRequest({ applicationId: historical.id, requestKey: "123e4567-e89b-42d3-a456-426614174000" })).rejects.toThrow("already belongs");
    expect(h.writes).toEqual([]);
    expect(external.sendOfferSigningEmail).not.toHaveBeenCalled();
    expect(external.sendOfferSigningSms).not.toHaveBeenCalled();
    expect(external.recordOfferSigningOutcome).not.toHaveBeenCalled();
    expect(external.notifyOwner).not.toHaveBeenCalled();
  });

  it("rejects the preexisting public signature link before writes, confirmation mail or owner notification", async () => {
    const record = offerFor(historical, 0);
    const h = harness({ offers: [record], claims: [association()], actions: [] });
    external.db.getDb.mockResolvedValue(h.db);
    const caller = signingRouter.createCaller({ user: null, req: { headers: {} } } as never);
    await expect(caller.submitSignature({ token: record.token, signedName: historical.name, confirmedOfferLetterType: record.offerLetterType, confirmedDocumentSha256: createOfferDocumentSnapshot(record).sha256 })).rejects.toThrow("already belongs");
    expect(h.writes).toEqual([]);
    expect(external.sendEmail).not.toHaveBeenCalled();
    expect(external.notifyOwner).not.toHaveBeenCalled();
  });

  it("leaves completed signing/document reads available without granting fresh signing authority", async () => {
    const record = { ...offerFor(), signedName: historical.name, signedAt: new Date("2026-01-02") };
    external.db.getSigningTokenByToken.mockResolvedValue(record);
    const response = { setHeader: vi.fn() };
    const caller = signingRouter.createCaller({ user: null, res: response } as never);
    await expect(caller.getSigningRequest({ token: record.token })).resolves.toMatchObject({ signed: true, signedName: historical.name, signedAt: record.signedAt, offerHtml: null, ndaHtml: null });
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(external.db.getDb).not.toHaveBeenCalled();
    expect(external.sendEmail).not.toHaveBeenCalled();
  });
});
