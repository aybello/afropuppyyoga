import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  communicationsLog,
  employeeApplicationAssociations,
  employees,
  jobApplicationActions,
  jobApplications,
  signingTokens,
  staffingMutationLocks,
  users,
  type User,
} from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import type { ApyAccess } from "./apyAccess";
import { reviewedHiringRecordHash } from "./hiringDuplicateIdentity";
import { recordCurrentOfferSignature } from "./hiringOfferLifecycle";
import { createOfferDocumentSnapshot, readOfferDocumentSnapshot } from "./offerDocumentSnapshot";

// The router cannot reach a real connector. Access middleware is supplied a
// fictional result; the ownership resolver itself and the PDF builder are real.
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn(), sendEmail: vi.fn(), notifyOwner: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getSigningTokenByToken: vi.fn(), createSigningToken: vi.fn(), updateSigningToken: vi.fn(), getSigningTokenByApplicationId: vi.fn(), getJobApplicationById: vi.fn(), updateJobApplication: vi.fn(), updateJobApplicationStatusIfUnclaimed: vi.fn() }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
vi.mock("./email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("./offerSigningEmail", () => ({ sendOfferSigningEmail: vi.fn() }));
vi.mock("./offerSigningSms", () => ({ sendOfferSigningSms: vi.fn() }));
vi.mock("./offerSigningAudit", () => ({ recordOfferSigningOutcome: vi.fn() }));
import { staffDocumentsRouter } from "./routers/staffDocuments";
import { signingRouter } from "./routers/signing";

const historical = {
  id: 41, name: "Fictional Applicant", email: "applicant@example.com", phone: "+14165550101",
  role: "Puppy Monitor", location: "Kitchener", status: "accepted", isTeamMember: false,
  deletedAt: null, onboardingDeliveryToken: null,
};
const canonical = {
  ...historical, id: 42, name: "  FICTIONAL   Applicant  ", email: "APPLICANT@example.com", phone: "(416) 555-0101",
  role: "Movement Instructor", status: "onboarded", isTeamMember: true,
};
const employee = { ...canonical, id: 7, name: "fictional applicant", email: "Applicant@example.com", phone: "1-416-555-0101", sourceApplicationId: canonical.id, employmentStatus: "active", endedAt: null };
const user: User = {
  id: 5, openId: "staff-email:applicant@example.com", name: canonical.name, email: canonical.email,
  role: "staff", loginMethod: "test", createdAt: new Date(0), updatedAt: new Date(0), lastSignedIn: new Date(0),
};
const access: ApyAccess = { level: "team_member", teamMember: canonical, canManageOperations: false };
const newOffer = {
  id: 3, applicationId: historical.id, token: "fictional-unsigned-token", applicantName: historical.name,
  applicantEmail: historical.email, role: historical.role, location: historical.location, offerLetterType: "puppy_monitor_kw",
  signed: 0, signedName: null, signedIp: null, signedAt: null, signedDocumentSnapshot: null,
  puppyMonitorShiftPayCad: 60, movementInstructorHourlyPayCad: null, socialMediaHourlyPayCad: null,
  createdAt: new Date("2026-01-02T00:00:00Z"), expiresAt: new Date("2099-01-01T00:00:00Z"),
};
const originalOfferSource = {
  ...newOffer, id: 2, applicationId: canonical.id, token: "fictional-original-token", applicantName: canonical.name,
  applicantEmail: canonical.email, role: canonical.role, offerLetterType: "movement_instructor",
  puppyMonitorShiftPayCad: null, movementInstructorHourlyPayCad: 22, createdAt: new Date("2026-01-01T00:00:00Z"),
};
const originalSnapshot = JSON.stringify(createOfferDocumentSnapshot(originalOfferSource));
const originalOffer = {
  ...originalOfferSource, signed: 1, signedName: canonical.name, signedIp: "192.0.2.8",
  signedAt: new Date("2026-01-01T01:00:00Z"), signedDocumentSnapshot: originalSnapshot,
};
const claims = [
  { applicationId: historical.id, employeeId: employee.id, canonicalApplicationId: canonical.id, recordHash: reviewedHiringRecordHash(historical) },
  { applicationId: canonical.id, employeeId: employee.id, canonicalApplicationId: canonical.id, recordHash: reviewedHiringRecordHash(canonical) },
];
const legacy = {
  applicationId: canonical.id, action: "employee_added_after_signature",
  details: JSON.stringify({ employeeId: employee.id, duplicateReview: { version: 2, canonicalApplicationId: canonical.id, employeeId: employee.id, reviewed: [{ applicationId: historical.id, recordHash: claims[0].recordHash }] } }),
};

type State = { user: User; apps: any[]; directory: any[]; claims: any[]; actions: any[]; offers: any[] };
const initialState = (): State => structuredClone({
  user, apps: [historical, canonical], directory: [employee], claims, actions: [legacy], offers: [newOffer, originalOffer],
});
const dialect = new MySqlDialect();

/** Staged transactions, fail-closed query fake: no connector, network, or actual SQL. */
function harness() {
  let committed = initialState();
  const writes: Array<{ table: unknown; values: any; sql: string; params: unknown[] }> = [];
  const inserts: Array<{ table: unknown; values: any }> = [];
  const postCommitAudits: any[] = [];
  const communications: any[] = [];
  const events: string[] = [];
  const db = {
    transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => {
      const staged = structuredClone(committed);
      let locked = false;
      const tx = {
        insert(table: unknown) {
          return { values(values: unknown) {
            if (table === staffingMutationLocks) {
              expect(values).toEqual({ lockName: "apy_staffing_mutation_v1" });
              return { onDuplicateKeyUpdate: async () => undefined };
            }
            if (!locked || table !== jobApplicationActions) throw new Error("Unexpected domain insert");
            inserts.push({ table, values: structuredClone(values) });
            staged.actions.push(structuredClone(values));
            return Promise.resolve([{ affectedRows: 1 }]);
          } };
        },
        select() {
          let table: unknown, condition: ReturnType<MySqlDialect["sqlToQuery"]> | undefined;
          let limit: number | undefined, ordered = false, forUpdate = false;
          const result = () => {
            if (!locked) throw new Error("Read before staffing lock");
            const sql = condition?.sql ?? "", params = condition?.params ?? [];
            let rows: any[];
            if (table === users) {
              expect(sql).toBe("(`users`.`id` = ? and `users`.`openId` = ?)");
              rows = staged.user.id === params[0] && staged.user.openId === params[1] ? [staged.user] : [];
            } else if (table === jobApplications) {
              if (sql.includes("`jobApplications`.`isTeamMember` = ?")) {
                expect(params).toEqual([true]);
                rows = staged.apps.filter(row => row.isTeamMember && row.deletedAt == null);
              } else if (sql.includes("`jobApplications`.`id` in (")) {
                rows = staged.apps.filter(row => params.includes(row.id));
              } else if (sql.includes("`jobApplications`.`id` = ?")) {
                expect(params).toHaveLength(1);
                rows = staged.apps.filter(row => row.id === params[0]);
              } else if (condition === undefined && forUpdate) {
                events.push("scan-applications-for-update");
                rows = staged.apps;
              } else throw new Error(`Unexpected applications query: ${sql}`);
            } else if (table === employees) {
              expect(condition).toBeUndefined(); rows = staged.directory;
            } else if (table === employeeApplicationAssociations) {
              expect(condition).toBeUndefined(); rows = staged.claims;
            } else if (table === jobApplicationActions) {
              expect(sql).toContain("`jobApplicationActions`.`action` = ?");
              rows = staged.actions.filter(row => params.includes(row.action) && (!sql.includes("`jobApplicationActions`.`applicationId` = ?") || params.includes(row.applicationId)));
            } else if (table === signingTokens) {
              if (sql.includes("`signingTokens`.`token` = ?")) {
                expect(params).toHaveLength(1); rows = staged.offers.filter(row => row.token === params[0]);
              } else if (sql.includes("`signingTokens`.`applicationId` in (")) {
                expect(sql).toContain("`signingTokens`.`signed` = ?");
                const byId = sql.includes("`signingTokens`.`id` = ?");
                expect(params.at(-1)).toBe(1);
                const ids = params.slice(byId ? 1 : 0, -1);
                rows = staged.offers.filter(row => row.signed === 1 && ids.includes(row.applicationId) && (!byId || row.id === params[0]));
              } else if (sql.includes("`signingTokens`.`applicationId` = ?")) {
                expect(params).toHaveLength(1); rows = staged.offers.filter(row => row.applicationId === params[0]);
              } else throw new Error(`Unexpected signing query: ${sql}`);
              if (ordered && sql.includes("`signingTokens`.`applicationId` = ?")) rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
              else if (ordered) rows = [...rows].sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime() || b.id - a.id);
            } else throw new Error("Unexpected table read");
            return structuredClone(limit === undefined ? rows : rows.slice(0, limit));
          };
          const chain: any = {
            from(value: unknown) { table = value; return chain; },
            where(value: SQL) { condition = dialect.sqlToQuery(value); return chain; },
            orderBy() { ordered = true; return chain; },
            limit(value: number) { limit = value; return chain; },
            async for(mode: string) {
              expect(mode).toBe("update");
              if (table === staffingMutationLocks) {
                expect(condition?.params).toEqual(["apy_staffing_mutation_v1"]);
                locked = true; events.push("lock"); return [{ lockName: "apy_staffing_mutation_v1" }];
              }
              forUpdate = true;
              return result();
            },
            then(resolve: (value: any[]) => unknown, reject: (error: unknown) => unknown) {
              try { return Promise.resolve(result()).then(resolve, reject); }
              catch (error) { return Promise.reject(error).then(resolve, reject); }
            },
          };
          return chain;
        },
        update(table: unknown) {
          return { set(values: any) { return { async where(predicate: SQL) {
            if (!locked) throw new Error("Write before staffing lock");
            const { sql, params } = dialect.sqlToQuery(predicate);
            writes.push({ table, values: structuredClone(values), sql, params });
            if (table === jobApplications) {
              expect(values).toEqual({ status: "accepted" });
              expect(sql).toContain("`jobApplications`.`id` = ?");
              const row = staged.apps.find(app => app.id === params[0] && !app.isTeamMember && !app.deletedAt && !app.onboardingDeliveryToken && !["onboarded", "rejected"].includes(app.status));
              if (!row) return [{ affectedRows: 0 }];
              Object.assign(row, values); return [{ affectedRows: 1 }];
            }
            if (table !== signingTokens) throw new Error("Unexpected domain update");
            expect(sql).toContain("BINARY");
            expect(sql).toContain("`signingTokens`.`expiresAt` > CURRENT_TIMESTAMP(3)");
            expect(params).toEqual([newOffer.id, historical.id, 0, newOffer.token]);
            const row = staged.offers.find(offer => offer.id === params[0] && offer.applicationId === params[1] && offer.signed === params[2] && offer.token === params[3] && offer.expiresAt > new Date());
            if (!row) return [{ affectedRows: 0 }];
            Object.assign(row, values); return [{ affectedRows: 1 }];
          } }; } };
        },
        delete() { throw new Error("Unexpected delete"); },
      };
      try { const value = await callback(tx); committed = staged; events.push("commit"); return value; }
      catch (error) { events.push("rollback"); throw error; }
    }),
    select() { throw new Error("Root connection reads are prohibited"); },
    insert(table: unknown) {
      if (table !== communicationsLog && table !== jobApplicationActions) throw new Error("Unexpected post-commit domain insert");
      return { values(values: unknown) {
        if (table === communicationsLog) communications.push(structuredClone(values));
        else { postCommitAudits.push(structuredClone(values)); committed.actions.push(structuredClone(values)); }
        return Promise.resolve([{ affectedRows: 1 }]);
      } };
    },
  };
  mocks.getDb.mockResolvedValue(db);
  const setHeader = vi.fn();
  const api = staffDocumentsRouter.createCaller({ req: { headers: {} }, res: { setHeader }, user } as TrpcContext);
  const signingApi = signingRouter.createCaller({ req: { headers: { "x-forwarded-for": "192.0.2.17" } }, res: { setHeader }, user: null } as TrpcContext);
  return { db, api, signingApi, writes, inserts, postCommitAudits, communications, events, setHeader, get state() { return structuredClone(committed); }, change(fn: (state: State) => void) { fn(committed); } };
}

function sign(h: ReturnType<typeof harness>) {
  return recordCurrentOfferSignature(h.db, newOffer.token, historical.name, "192.0.2.17", newOffer.offerLetterType, 60, undefined, undefined, createOfferDocumentSnapshot(newOffer).sha256);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolveApyAccess.mockResolvedValue(access);
});

describe("reviewed association signing to My Documents (isolated integration)", () => {
  it("retains and downloads both signed documents for the active canonical employee without changing prior records or re-signing", async () => {
    const h = harness();
    const before = h.state;
    const snapshot = createOfferDocumentSnapshot(newOffer);
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([originalOffer.id]);

    await expect(sign(h)).resolves.toMatchObject({ id: newOffer.id, signed: 0 });
    expect(h.events.filter(event => event === "scan-applications-for-update")).toHaveLength(1);
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0]).toMatchObject({ table: signingTokens, values: { signed: 1, signedName: historical.name, signedIp: "192.0.2.17", signedDocumentSnapshot: JSON.stringify(snapshot) } });
    const signed = h.state.offers.find(row => row.id === newOffer.id);
    expect(signed.signedAt).toBeInstanceOf(Date);
    expect(readOfferDocumentSnapshot(signed.signedDocumentSnapshot)).toEqual(snapshot);
    expect(h.state.offers.find(row => row.id === originalOffer.id)).toEqual(originalOffer);
    expect(h.state.offers.find(row => row.id === originalOffer.id).signedDocumentSnapshot).toBe(originalSnapshot);
    expect({ apps: h.state.apps, directory: h.state.directory, claims: h.state.claims }).toEqual({ apps: before.apps, directory: before.directory, claims: before.claims });
    expect(h.state.apps.map(app => app.role)).toEqual([historical.role, canonical.role]);
    expect(h.state.directory[0].role).toBe(employee.role);
    const expectedAudit = { applicationId: historical.id, action: "offer_signed", fromStatus: "accepted", toStatus: "accepted", actorName: historical.name, details: JSON.stringify({ signingTokenId: newOffer.id, signedIp: "192.0.2.17", reviewedIdentityGuardVersion: 1 }) };
    expect(h.inserts).toEqual([{ table: jobApplicationActions, values: expectedAudit }]);
    expect(h.state.actions).toEqual([...before.actions, expectedAudit]);

    const listed = await h.api.mySignedOffers();
    expect(listed.map(row => row.id)).toEqual([newOffer.id, originalOffer.id]);
    expect(listed.every(row => row.hasOriginalSnapshot)).toBe(true);
    expect(JSON.stringify(listed)).not.toContain(newOffer.token);
    expect(JSON.stringify(listed)).not.toContain(originalOffer.token);
    for (const id of [newOffer.id, originalOffer.id]) {
      const download = await h.api.downloadMySignedOffer({ id });
      expect(download.filename).toBe(`APY-signed-offer-and-NDA-${id}.pdf`);
      expect(download.mimeType).toBe("application/pdf");
      expect(Buffer.from(download.base64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    }
    expect(h.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    const after = h.state;
    await expect(sign(h)).rejects.toThrow("already been signed");
    expect(h.events.at(-1)).toBe("rollback");
    expect(h.writes).toHaveLength(1);
    expect(h.inserts).toHaveLength(1);
    expect(h.state).toEqual(after);
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([newOffer.id, originalOffer.id]);
    expect(h.state).toEqual(after);
  });

  it("signs through the public route and blocks only the new guarded token after a complete identity reassignment", async () => {
    const h = harness();
    // An earlier unmarked completion on the very same reviewed application.
    // It is deliberately not synthesized as guarded evidence by the test.
    const legacySource = {
      ...newOffer, id: 1, token: "fictional-legacy-token", signed: 1,
      signedName: historical.name, signedIp: "192.0.2.8", signedAt: new Date("2025-12-31T12:00:00Z"),
      createdAt: new Date("2025-12-31T00:00:00Z"),
    };
    const legacySnapshot = JSON.stringify(createOfferDocumentSnapshot(legacySource));
    const legacyOffer = { ...legacySource, signedDocumentSnapshot: legacySnapshot };
    const legacyAudit = { applicationId: historical.id, action: "offer_signed", details: JSON.stringify({ signingTokenId: legacyOffer.id, signedIp: legacyOffer.signedIp }) };
    h.change(state => { state.offers.push(legacyOffer); state.actions.push(legacyAudit); });
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([originalOffer.id, legacyOffer.id]);

    // Unknown client properties are stripped by the public input schema; the
    // audited token ID and version must come exclusively from the transaction.
    await expect(h.signingApi.submitSignature({
      token: newOffer.token, signedName: historical.name, confirmedOfferLetterType: newOffer.offerLetterType,
      confirmedPuppyMonitorShiftPayCad: 60, confirmedDocumentSha256: createOfferDocumentSnapshot(newOffer).sha256,
      reviewedIdentityGuardVersion: 999, signingTokenId: legacyOffer.id,
    } as any)).resolves.toEqual({ success: true });
    expect(h.inserts).toHaveLength(1);
    expect(JSON.parse(h.inserts[0].values.details)).toEqual({ signingTokenId: newOffer.id, signedIp: "192.0.2.17", reviewedIdentityGuardVersion: 1 });
    expect(h.postCommitAudits).toEqual([]);
    expect(h.state.actions).toContainEqual(legacyAudit);
    expect(h.communications).toHaveLength(1);
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.notifyOwner).toHaveBeenCalledOnce();
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([newOffer.id, originalOffer.id, legacyOffer.id]);
    for (const id of [newOffer.id, originalOffer.id, legacyOffer.id]) {
      const pdf = await h.api.downloadMySignedOffer({ id });
      expect(Buffer.from(pdf.base64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    }

    h.change(state => {
      const replacement = { name: "Another Fictional Person", email: "replacement@example.test", phone: "+14165550199" };
      Object.assign(state.apps.find(app => app.id === canonical.id), replacement);
      Object.assign(state.directory[0], replacement);
      state.user.email = replacement.email;
    });
    const beforeRead = h.state;
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([originalOffer.id, legacyOffer.id]);
    await expect(h.api.downloadMySignedOffer({ id: newOffer.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(h.api.downloadMySignedOffer({ id: newOffer.id, reviewedIdentityGuardVersion: 0 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    for (const id of [legacyOffer.id, originalOffer.id]) {
      const pdf = await h.api.downloadMySignedOffer({ id });
      expect(Buffer.from(pdf.base64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    }
    expect(h.state).toEqual(beforeRead);
    expect(h.state.offers.find(row => row.id === legacyOffer.id).signedDocumentSnapshot).toBe(legacySnapshot);
    expect(h.writes).toHaveLength(1);
  });

  it("keeps an unrelated unassociated signature unmarked despite client-supplied marker fields", async () => {
    const h = harness();
    h.change(state => {
      state.apps = [state.apps.find(app => app.id === historical.id)];
      state.directory = []; state.claims = []; state.actions = [];
      state.offers = [state.offers.find(offer => offer.id === newOffer.id)];
    });
    await expect(h.signingApi.submitSignature({
      token: newOffer.token, signedName: historical.name, confirmedOfferLetterType: newOffer.offerLetterType,
      confirmedPuppyMonitorShiftPayCad: 60, confirmedDocumentSha256: createOfferDocumentSnapshot(newOffer).sha256,
      reviewedIdentityGuardVersion: 1, signingTokenId: 999,
    } as any)).resolves.toEqual({ success: true });
    expect(h.inserts).toEqual([]);
    expect(h.writes.map(write => write.table)).toEqual([jobApplications, signingTokens]);
    expect(h.postCommitAudits).toEqual([{
      applicationId: historical.id, action: "offer_signed", fromStatus: "accepted", toStatus: "accepted", actorName: historical.name,
      details: JSON.stringify({ signingTokenId: newOffer.id, signedIp: "192.0.2.17" }),
    }]);
    expect(h.state.actions).toEqual(h.postCommitAudits);
    expect(h.communications).toHaveLength(1);
  });

  it.each([
    ["historical", "name", "Different Person"],
    ["historical", "email", "changed@example.com"],
    ["historical", "phone", "+14165550102"],
    ["canonical", "name", "Different Person"],
    ["canonical", "email", "changed@example.com"],
    ["canonical", "phone", "+14165550102"],
    ["employee", "name", "Different Person"],
    ["employee", "email", "changed@example.com"],
    ["employee", "phone", "+14165550102"],
  ])("denies signing when the %s current %s is stale", async (subject, field, value) => {
    const h = harness();
    h.change(state => {
      const record = subject === "employee" ? state.directory[0] : state.apps.find(app => app.id === (subject === "historical" ? historical.id : canonical.id));
      record[field] = value;
      if (subject === "historical") {
        // Even refreshed review evidence cannot authorize a current mismatch.
        const hash = reviewedHiringRecordHash(record);
        state.claims.find(claim => claim.applicationId === historical.id).recordHash = hash;
        const details = JSON.parse(state.actions[0].details);
        details.duplicateReview.reviewed[0].recordHash = hash;
        state.actions[0].details = JSON.stringify(details);
      }
    });
    const before = h.state;
    await expect(sign(h)).rejects.toThrow(/reviewed ownership could not be verified/i);
    expect(h.events).toContain("scan-applications-for-update");
    expect(h.events.at(-1)).toBe("rollback");
    expect(h.writes).toHaveLength(0);
    expect(h.inserts).toHaveLength(0);
    expect(h.state).toEqual(before);
  });

  it("denies signing when a scanned application shares contact but has a different identity", async () => {
    const h = harness();
    h.change(state => { state.apps.push({ ...historical, id: 99, name: "Different Person", phone: "+14165550109" }); });
    const before = h.state;
    await expect(sign(h)).rejects.toThrow(/reviewed ownership could not be verified/i);
    expect(h.events).toContain("scan-applications-for-update");
    expect(h.events.at(-1)).toBe("rollback");
    expect(h.writes).toHaveLength(0);
    expect(h.inserts).toHaveLength(0);
    expect(h.state).toEqual(before);
  });

  it("denies an exact-identity scanned application without durable reviewed ownership", async () => {
    const h = harness();
    h.change(state => { state.apps.push({ ...historical, id: 99 }); });
    const before = h.state;
    await expect(sign(h)).rejects.toThrow(/reviewed ownership could not be verified/i);
    expect(h.events).toContain("scan-applications-for-update");
    expect(h.events.at(-1)).toBe("rollback");
    expect(h.writes).toHaveLength(0);
    expect(h.inserts).toHaveLength(0);
    expect(h.state).toEqual(before);
  });

  it("allows an inert archived contact match without granting it an association", async () => {
    const h = harness();
    h.change(state => { state.apps.push({ ...historical, id: 99, name: "Different Person", deletedAt: new Date("2025-01-01T00:00:00Z") }); });
    const before = h.state;
    await expect(sign(h)).resolves.toMatchObject({ id: newOffer.id, signed: 0 });
    expect(h.events).toContain("scan-applications-for-update");
    expect(h.state.apps).toEqual(before.apps);
    expect(h.state.claims).toEqual(before.claims);
    expect(h.inserts).toHaveLength(1);
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([newOffer.id, originalOffer.id]);
  });

  it("withholds the reviewed offer if its reviewed identity changes, while keeping the canonical document", async () => {
    const h = harness();
    await sign(h);
    h.change(state => { state.apps.find(app => app.id === historical.id).email = "changed@example.com"; });
    const beforeRead = h.state;
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([originalOffer.id]);
    await expect(h.api.downloadMySignedOffer({ id: newOffer.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(h.state).toEqual(beforeRead);
    expect(h.writes).toHaveLength(1);
  });

  it("rejects the canonical login after its linked employee becomes inactive", async () => {
    const h = harness();
    await sign(h);
    h.change(state => { state.directory[0].employmentStatus = "inactive"; });
    const beforeRead = h.state;
    await expect(h.api.mySignedOffers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(h.api.downloadMySignedOffer({ id: originalOffer.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.state).toEqual(beforeRead);
    expect(h.writes).toHaveLength(1);
  });
});
