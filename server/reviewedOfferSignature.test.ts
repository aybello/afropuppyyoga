import { describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { employeeApplicationAssociations, employees, jobApplicationActions, jobApplications, signingTokens, staffingMutationLocks } from "../drizzle/schema";
import { recordCurrentOfferSignature } from "./hiringOfferLifecycle";
import { reviewedHiringRecordHash } from "./hiringDuplicateIdentity";
import { createOfferDocumentSnapshot } from "./offerDocumentSnapshot";

const target = { id: 41, name: "Fictional Applicant", email: "fictional@example.com", phone: "+14165550101", role: "Puppy Monitor", location: "Kitchener", status: "accepted", isTeamMember: false, deletedAt: null, onboardingDeliveryToken: null };
const canonical = { ...target, id: 42, role: "Movement Instructor", status: "onboarded", isTeamMember: true };
const employee = { ...canonical, id: 7, sourceApplicationId: 42, employmentStatus: "active", endedAt: null };
const claim = { applicationId: 41, employeeId: 7, canonicalApplicationId: 42, recordHash: reviewedHiringRecordHash(target) };
const canonicalClaim = { applicationId: 42, employeeId: 7, canonicalApplicationId: 42, recordHash: reviewedHiringRecordHash(canonical) };
const third = { ...target, id: 43, role: "Puppy Monitor" };
const thirdClaim = { applicationId: 43, employeeId: 7, canonicalApplicationId: 42, recordHash: reviewedHiringRecordHash(third) };
const offer = { id: 3, applicationId: 41, token: "fictional-token", applicantName: target.name, applicantEmail: target.email, role: target.role, location: target.location, offerLetterType: "puppy_monitor_kw", signed: 0, signedName: null, signedIp: null, signedAt: null, signedDocumentSnapshot: null, puppyMonitorShiftPayCad: 60, movementInstructorHourlyPayCad: null, socialMediaHourlyPayCad: null, createdAt: new Date("2026-01-01"), expiresAt: new Date("2099-01-01") };
const signedOffer = { ...offer, id: 2, applicationId: 42, token: "another-signed-offer", role: "Movement Instructor", offerLetterType: "movement_instructor", signed: 1, signedName: canonical.name, signedDocumentSnapshot: "existing immutable snapshot" };
const legacy = { applicationId: 42, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 7, duplicateReview: { version: 2, canonicalApplicationId: 42, employeeId: 7, reviewed: [{ applicationId: 41, recordHash: claim.recordHash }, { applicationId: 43, recordHash: thirdClaim.recordHash }] } }) };
type State = { apps: any[]; directory: any[]; claims: any[]; actions: any[]; offers: any[] };
const base = (): State => structuredClone({ apps: [target, canonical, third], directory: [employee], claims: [claim, canonicalClaim, thirdClaim], actions: [legacy], offers: [offer, signedOffer] });
const dialect = new MySqlDialect();

/** All reads/writes are staged in memory; no connector or database is used. */
function harness(initial: State = base(), hooks: { afterLock?: (s: State) => void; signatureAffected?: number; onSignature?: (s: State) => void; auditFails?: boolean } = {}) {
  let committed = structuredClone(initial);
  const calls: any[] = [], reads: any[] = [], events: string[] = [];
  const db = { transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
    const state = structuredClone(committed);
    const tableRows = (table: unknown) => table === jobApplications ? state.apps : table === employees ? state.directory : table === employeeApplicationAssociations ? state.claims : table === jobApplicationActions ? state.actions : table === signingTokens ? state.offers : [];
    let locked = false;
    const tx = {
      insert: (table: unknown) => ({ values: (values: any) => {
        if (table === staffingMutationLocks) return { onDuplicateKeyUpdate: async () => [{ affectedRows: 1 }] };
        if (table !== jobApplicationActions) throw new Error("Unexpected domain insert");
        calls.push({ table, values, locked });
        if (hooks.auditFails) throw new Error("audit unavailable");
        state.actions.push(values);
        return Promise.resolve([{ affectedRows: 1 }]);
      } }),
      select: () => {
        let table: unknown, predicate: any, ordered = false;
        const result = () => {
          let rows = tableRows(table);
          if (predicate && table === signingTokens) {
            const params = dialect.sqlToQuery(predicate).params;
            rows = rows.filter((r: any) => params.includes(r.token) || params.includes(r.applicationId));
          } else if (predicate && table === jobApplications) {
            const params = dialect.sqlToQuery(predicate).params;
            rows = rows.filter((r: any) => params.includes(r.id));
          } else if (predicate && table === jobApplicationActions) rows = rows.filter((r: any) => r.action === "employee_added_after_signature");
          if (ordered) rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
          return structuredClone(rows);
        };
        const chain: any = {
          from: (v: unknown) => { table = v; return chain; }, where: (p: any) => { predicate = p; return chain; },
          orderBy: () => { ordered = true; return chain; }, limit: () => chain,
          for: async (mode: string) => {
            if (mode !== "update") throw new Error("Expected row lock");
            if (table === staffingMutationLocks) { locked = true; events.push("lock"); hooks.afterLock?.(state); }
            else reads.push({ table, locked, unfiltered: !predicate });
            return result();
          },
          then: (resolve: any) => resolve(result()),
        };
        return chain;
      },
      update: (table: unknown) => ({ set: (values: any) => ({ where: async (predicate: any) => {
        calls.push({ table, values, predicate: dialect.sqlToQuery(predicate), locked });
        if (table === signingTokens) {
          hooks.onSignature?.(state);
          const affected = hooks.signatureAffected ?? 1;
          if (affected === 1) Object.assign(state.offers.find((row: any) => row.id === offer.id), values);
          return [{ affectedRows: affected }];
        }
        if (table === jobApplications) { Object.assign(state.apps.find((row: any) => row.id === target.id), values); return [{ affectedRows: 1 }]; }
        throw new Error("Unexpected update");
      } }) }),
    };
    try { const result = await fn(tx); committed = state; events.push("commit"); return result; }
    catch (error) { events.push("rollback"); throw error; }
  }) };
  return { db, calls, reads, events, get state() { return structuredClone(committed); } };
}
function sign(h: ReturnType<typeof harness>, options: { token?: string; digest?: string | null; type?: string; amount?: number } = {}) {
  return recordCurrentOfferSignature(h.db, options.token ?? offer.token, target.name, "192.0.2.17", options.type ?? offer.offerLetterType,
    options.amount ?? 60, undefined, undefined, options.digest === null ? undefined : options.digest ?? createOfferDocumentSnapshot(offer).sha256);
}

describe("reviewed associated current offer signature (isolated)", () => {
  it("signs only the target offer with the exact reviewed snapshot, leaving the existing hire and signed offer unchanged", async () => {
    const input = base(), h = harness(input), snapshot = createOfferDocumentSnapshot(offer);
    await expect(sign(h)).resolves.toMatchObject({ id: offer.id, signed: 0, associatedAuditRecorded: true });
    expect(h.events).toEqual(["lock", "commit"]);
    expect(h.calls).toHaveLength(2);
    expect(h.calls[0]).toMatchObject({ table: signingTokens, locked: true, values: { signed: 1, signedName: target.name, signedIp: "192.0.2.17", signedDocumentSnapshot: JSON.stringify(snapshot) } });
    expect(h.calls[1]).toEqual({ table: jobApplicationActions, locked: true, values: { applicationId: 41, action: "offer_signed", fromStatus: "accepted", toStatus: "accepted", actorName: target.name, details: JSON.stringify({ signingTokenId: 3, signedIp: "192.0.2.17" }) } });
    expect(h.calls[0].predicate.sql).toMatch(/applicationId.*signed.*BINARY.*token.*expiresAt/);
    expect(h.calls[0].predicate.params.slice(0, 4)).toEqual([3, 41, 0, offer.token]);
    expect(h.state.apps).toEqual(input.apps); expect(h.state.directory).toEqual(input.directory);
    expect(h.state.claims).toEqual(input.claims); expect(h.state.actions).toEqual([...input.actions, h.calls[1].values]);
    expect(h.state.offers.find(row => row.id === 2)).toEqual(input.offers.find(row => row.id === 2));
    expect(h.reads.every(read => read.locked)).toBe(true);
    for (const table of [jobApplications, signingTokens, employees, employeeApplicationAssociations, jobApplicationActions]) expect(h.reads.some(read => read.table === table)).toBe(true);
    expect(h.reads.some(read => read.table === jobApplications && read.unfiltered)).toBe(true);
  });

  it("accepts normalized names, emails and differently formatted valid phones for all three identities", async () => {
    const state = base();
    state.apps[1].name = "  Ｆｉｃｔｉｏｎａｌ\tApplicant ";
    state.apps[1].email = " FICTIONAL@EXAMPLE.COM ";
    state.apps[1].phone = "(416) 555-0101";
    state.directory[0].phone = "+1 (416) 555-0101";
    // Canonical review hashes bind the raw pre-onboarding record, which may
    // legitimately differ from normalized post-onboarding fields.
    expect(state.claims[1].recordHash).not.toBe(reviewedHiringRecordHash(state.apps[1]));
    const h = harness(state);
    await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: true });
    expect(h.state.claims[1]).toEqual(state.claims[1]);
  });

  it.each(["target", "canonical", "employee"] as const)("requires every valid identity field on %s to match", async which => {
    for (const [field, bad] of [["name", "Other Person"], ["email", "other@example.com"], ["phone", "+14165550199"], ["name", ""], ["email", "bad email"], ["phone", "not a phone"], ["name", null], ["email", null], ["phone", null]] as const) {
      const state = base();
      const subject = which === "target" ? state.apps[0] : which === "canonical" ? state.apps[1] : state.directory[0];
      subject[field] = bad;
      if (which === "target") {
        // Isolate the current cross-record check from the reviewed-hash guard.
        state.claims[0].recordHash = reviewedHiringRecordHash(subject);
        const details = JSON.parse(state.actions[0].details);
        details.duplicateReview.reviewed[0].recordHash = state.claims[0].recordHash;
        state.actions[0].details = JSON.stringify(details);
        if (field === "name" && bad) state.offers[0].applicantName = bad;
        if (field === "email" && bad) state.offers[0].applicantEmail = bad;
      }
      const h = harness(state);
      const digest = createOfferDocumentSnapshot(state.offers[0]).sha256;
      await expect(sign(h, { digest }), `${which} ${field}=${bad}`).rejects.toThrow();
      expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
    }
  });

  it.each([
    ["unlinked active applicant sharing email", { ...target, id: 44, name: "Different Person", phone: "+14165550199" }],
    ["unlinked active applicant sharing phone", { ...target, id: 44, name: "Different Person", email: "other@example.com", phone: "(416) 555-0101" }],
    ["unlinked active legacy staff profile", { ...canonical, id: 44 }],
    ["unlinked same-person applicant", { ...target, id: 44 }],
    ["archived team profile", { ...canonical, id: 44, deletedAt: new Date("2020-01-01") }],
  ])("rejects %s without committed writes", async (_label, conflict) => {
    const state = base(); state.apps.push(conflict); const h = harness(state);
    await expect(sign(h)).rejects.toThrow();
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });

  it.each([
    ["missing third association", (s: State) => { s.claims = s.claims.filter(c => c.applicationId !== 43); }],
    ["stale third hash", (s: State) => { s.claims[2].recordHash = "0".repeat(64); }],
    ["third identity changed", (s: State) => { s.apps[2].name = "Other Person"; }],
    ["third claimed by another employee", (s: State) => { s.claims.push({ ...thirdClaim, employeeId: 8 }); }],
  ] as Array<[string, (state: State) => void]>)("rejects %s", async (_label, change) => {
    const state = base(); change(state); const h = harness(state);
    await expect(sign(h)).rejects.toThrow(); expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });

  it.each([
    ["missing associated application", (s: State) => { s.apps = s.apps.filter(a => a.id !== 43); }],
    ["duplicate associated application", (s: State) => { s.apps.push({ ...s.apps[2] }); }],
    ["reassigned application with stale hash", (s: State) => {
      Object.assign(s.apps[2], { name: "Different Person", email: "different@example.test", phone: "+14165550199" });
    }],
    ["reassigned application with a current hash", (s: State) => {
      Object.assign(s.apps[2], { name: "Different Person", email: "different@example.test", phone: "+14165550199" });
      s.claims[2].recordHash = reviewedHiringRecordHash(s.apps[2]);
    }],
    ["normalized same identity with stale raw hash", (s: State) => {
      Object.assign(s.apps[2], { name: " FICTIONAL Applicant ", email: " FICTIONAL@EXAMPLE.COM ", phone: "(416) 555-0101" });
    }],
  ] as Array<[string, (state: State) => void]>)("fails closed on %s independently of legacy evidence", async (_label, change) => {
    const state = base(); state.actions = []; change(state); const h = harness(state);
    await expect(sign(h)).rejects.toThrow("reviewed ownership could not be verified");
    expect(h.calls).toEqual([]); expect(h.events).toEqual(["lock", "rollback"]); expect(h.state).toEqual(state);
  });

  it("accepts three legitimately reviewed fictional Alexia records with distinct normalized representations", async () => {
    const state = base();
    for (const record of [...state.apps, state.directory[0]]) {
      Object.assign(record, { name: "Alexia Example", email: "alexia@example.test", phone: "+14165550101" });
    }
    Object.assign(state.apps[2], { name: "  Ａｌｅｘｉａ\tExample ", email: " ALEXIA@EXAMPLE.TEST ", phone: "(416) 555-0101" });
    for (const entry of state.claims) entry.recordHash = reviewedHiringRecordHash(state.apps.find(a => a.id === entry.applicationId));
    state.actions = []; // Durable associations alone are sufficient.
    Object.assign(state.offers[0], { applicantName: state.apps[0].name, applicantEmail: state.apps[0].email });
    const h = harness(state);
    const snapshot = createOfferDocumentSnapshot(state.offers[0]);
    await expect(recordCurrentOfferSignature(h.db, offer.token, "Alexia Example", "192.0.2.17", offer.offerLetterType, 60, undefined, undefined, snapshot.sha256))
      .resolves.toMatchObject({ associatedAuditRecorded: true });
    expect(h.state.apps).toEqual(state.apps); expect(h.state.claims).toEqual(state.claims);
    expect(h.state.offers[1]).toEqual(state.offers[1]);
    expect(h.calls.map(call => call.table)).toEqual([signingTokens, jobApplicationActions]);
  });

  it("ignores an unlinked inert archived applicant even if a contact matches", async () => {
    const state = base(); state.apps.push({ ...target, id: 44, name: "Different Person", deletedAt: new Date("2020-01-01") });
    const h = harness(state); await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: true });
  });

  it.each([null, "null", " \nnull\t"])("signs the reviewed offer despite unrelated null details %j", async details => {
    const state = base();
    state.apps.push({ ...target, id: 44, name: "Different Person", deletedAt: new Date("2020-01-01") });
    state.actions.push({ applicationId: 99, action: "employee_added_after_signature", details });
    const h = harness(state);
    await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: true });
    expect(h.calls.map(call => call.table)).toEqual([signingTokens, jobApplicationActions]);
    expect(h.state.apps).toEqual(state.apps); expect(h.state.claims).toEqual(state.claims);
  });

  it.each([null, "null"])("rejects reviewed signing when known or indirectly related actions have null details %j", async details => {
    for (const id of [41, 42, 43, 80]) {
      const state = base();
      if (id === 80) state.actions.push({ applicationId: 42, action: "employee_added_after_signature", details: JSON.stringify({
        employeeId: 7, duplicateReview: { version: 2, employeeId: 7, canonicalApplicationId: 42, reviewed: [{ applicationId: 80, recordHash: "a".repeat(64) }] },
      }) });
      state.actions.unshift({ applicationId: id, action: "employee_added_after_signature", details });
      const h = harness(state);
      await expect(sign(h), `application ${id}`).rejects.toThrow("reviewed ownership could not be verified");
      expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
    }
  });

  it("ignores a provably unrelated malformed review for both related and archived-inert checks", async () => {
    const state = base();
    state.apps.push({ ...target, id: 44, name: "Different Person", deletedAt: new Date("2020-01-01") });
    state.actions.push({ applicationId: 99, action: "employee_added_after_signature", details: JSON.stringify({
      employeeId: 8, duplicateReview: { version: "invalid", employeeId: 9, canonicalApplicationId: 98,
        reviewed: [{ applicationId: 100, recordHash: null }, { applicationId: 100, recordHash: "invalid" }] },
    }) });
    const h = harness(state);
    await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: true });
    expect(h.state.apps).toEqual(state.apps); expect(h.state.claims).toEqual(state.claims);
  });

  it("does not treat duplicate unrelated non-claim fields as related evidence", async () => {
    const state = base();
    state.actions.push({ applicationId: 99, action: "employee_added_after_signature", details:
      '{"employeeId":8,"duplicateReview":{"version":1,"version":2,"employeeId":8,"canonicalApplicationId":99,"reviewed":[{"applicationId":100,"recordHash":"invalid"}]}}' });
    const h = harness(state); await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: true });
  });

  it("rejects an archived applicant with a conflicting legacy ownership claim", async () => {
    const state = base(); state.apps.push({ ...target, id: 44, deletedAt: new Date("2020-01-01") });
    state.actions.push({ applicationId: 99, action: "employee_added_after_signature", details: JSON.stringify({
      employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99,
        reviewed: [{ applicationId: 44, recordHash: reviewedHiringRecordHash(state.apps[3]) }] },
    }) });
    const h = harness(state); await expect(sign(h)).rejects.toThrow();
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });

  it.each([
    ["invalid JSON on a different row", '{"employeeId":8,"duplicateReview":'],
    ["missing reviewed ID", JSON.stringify({ employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ recordHash: "a".repeat(64) }] } })],
    ["duplicate escaped claim key", '{"employeeId":8,"duplicateReview":{"version":2,"employeeId":8,"canonicalApplicationId":99,"reviewed":[{"applicationId":41,"application\\u0049d":100,"recordHash":"' + "a".repeat(64) + '"}]}}'],
  ])("fails closed on ambiguous %s before writing", async (_label, details) => {
    const state = base(); state.actions.push({ applicationId: 99, action: "employee_added_after_signature", details });
    const h = harness(state); await expect(sign(h)).rejects.toThrow("reviewed ownership could not be verified");
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });

  it.each([false, true])("rejects a legacy conflict connected indirectly through a reviewed ID (reverse=%s)", async reverse => {
    const state = base();
    const bridge = { applicationId: 42, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 7,
      duplicateReview: { version: 2, employeeId: 7, canonicalApplicationId: 42, reviewed: [{ applicationId: 80, recordHash: "a".repeat(64) }] } }) };
    const conflict = { applicationId: 99, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 8,
      duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: 80, recordHash: "a".repeat(64) }] } }) };
    state.actions.push(...(reverse ? [conflict, bridge] : [bridge, conflict]));
    const h = harness(state); await expect(sign(h)).rejects.toThrow("reviewed ownership could not be verified");
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });

  it.each([
    ["absent association", (s: State) => { s.claims = []; s.actions = [legacy]; }],
    ["duplicate target association", (s: State) => { s.claims.push({ ...claim }); }],
    ["invalid reviewed hash", (s: State) => { s.claims[0].recordHash = "0".repeat(64); }],
    ["malformed hash", (s: State) => { s.claims[0].recordHash = null; }],
    ["changed identity", (s: State) => { s.apps[0].phone = "+14165550199"; }],
    ["missing owner", (s: State) => { s.directory = []; }],
    ["inactive owner", (s: State) => { s.directory[0].employmentStatus = "inactive"; }],
    ["owner ended", (s: State) => { s.directory[0].endedAt = new Date(); }],
    ["changed employee source", (s: State) => { s.directory[0].sourceApplicationId = 99; }],
    ["self canonical", (s: State) => { s.claims[0].canonicalApplicationId = 41; }],
    ["missing canonical", (s: State) => { s.apps = [s.apps[0]]; }],
    ["archived canonical", (s: State) => { s.apps[1].deletedAt = new Date(); }],
    ["not team canonical", (s: State) => { s.apps[1].isTeamMember = false; }],
    ["not onboarded canonical", (s: State) => { s.apps[1].status = "accepted"; }],
    ["invalid team profile contact", (s: State) => { s.apps[1].email = "invalid"; s.apps[1].phone = null; }],
    ["duplicate source owner", (s: State) => { s.directory.push({ ...employee, id: 8 }); }],
    ["target owned as a source", (s: State) => { s.directory.push({ ...employee, id: 8, sourceApplicationId: 41 }); }],
    ["directory contact collision", (s: State) => { s.directory.push({ ...employee, id: 8, sourceApplicationId: 99 }); }],
    ["conflicting canonical association", (s: State) => { s.claims.push({ ...canonicalClaim, employeeId: 8 }); }],
    ["conflicting additional association", (s: State) => { s.claims.push({ ...claim, applicationId: 44 }, { ...claim, applicationId: 44, employeeId: 8 }); }],
    ["contradictory legacy claim", (s: State) => { s.actions.push({ ...legacy, applicationId: 99, details: JSON.stringify({ employeeId: 8, duplicateReview: { version: 2, canonicalApplicationId: 99, employeeId: 8, reviewed: [{ applicationId: 41, recordHash: claim.recordHash }] } }) }); }],
    ["contradictory legacy hash", (s: State) => { const v = JSON.parse(s.actions[0].details); v.duplicateReview.reviewed[0].recordHash = "0".repeat(64); s.actions[0].details = JSON.stringify(v); }],
    ["additional reviewed association legacy hash conflict", (s: State) => { s.claims.push({ ...claim, applicationId: 55 }); const v = JSON.parse(s.actions[0].details); v.duplicateReview.reviewed.push({ applicationId: 55, recordHash: "0".repeat(64) }); s.actions[0].details = JSON.stringify(v); }],
    ["malformed related legacy", (s: State) => { s.actions[0].details = "not json"; }],
    ["malformed legacy envelope", (s: State) => { s.actions[0].details = JSON.stringify({ employeeId: 7, duplicateReview: null }); }],
    ["malformed string target in unrelated envelope", (s: State) => { s.actions.push({ applicationId: 99, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: "8", duplicateReview: { reviewed: [{ applicationId: "41" }] } }) }); }],
    ["target not accepted", (s: State) => { s.apps[0].status = "reviewed"; }],
    ["target archived", (s: State) => { s.apps[0].deletedAt = new Date(); }],
    ["target team member", (s: State) => { s.apps[0].isTeamMember = true; }],
    ["target onboarding claim", (s: State) => { s.apps[0].onboardingDeliveryToken = "pending"; }],
  ] as Array<[string, (state: State) => void]>)("rejects %s without committed writes", async (_label, change) => {
    const state = base(); change(state); const h = harness(state);
    await expect(sign(h)).rejects.toThrow(); expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });

  it.each([
    ["expired", (s: State) => { s.offers[0].expiresAt = new Date("2000-01-01"); }],
    ["invalid expiry", (s: State) => { s.offers[0].expiresAt = new Date(NaN); }],
    ["already signed", (s: State) => { s.offers[0].signed = 1; }],
    ["invalid signed state", (s: State) => { s.offers[0].signed = 2; }],
    ["stale snapshot", (s: State) => { s.offers[0].signedDocumentSnapshot = "previous snapshot"; }],
    ["stale signature metadata", (s: State) => { s.offers[0].signedName = "Someone"; }],
    ["changed saved role", (s: State) => { s.offers[0].role = "Movement Instructor"; }],
    ["changed saved location", (s: State) => { s.offers[0].location = "Hamilton"; }],
    ["changed saved name", (s: State) => { s.offers[0].applicantName = "Someone Else"; }],
    ["changed saved email", (s: State) => { s.offers[0].applicantEmail = "else@example.com"; }],
    ["wrong template", (s: State) => { s.offers[0].offerLetterType = "puppy_monitor_hamilton"; }],
    ["unsupported payment", (s: State) => { s.offers[0].puppyMonitorShiftPayCad = 61; }],
    ["unrelated compensation on offer", (s: State) => { s.offers[0].movementInstructorHourlyPayCad = 22; }],
    ["newer offer", (s: State) => { s.offers.push({ ...offer, id: 4, token: "replacement", createdAt: new Date("2026-01-02") }); }],
    ["same timestamp higher id", (s: State) => { s.offers.push({ ...offer, id: 4, token: "replacement" }); }],
  ] as Array<[string, (state: State) => void]>)("rejects %s without a signature", async (_label, change) => {
    const state = base(); change(state); const h = harness(state);
    const current = state.offers[0];
    let digest = createOfferDocumentSnapshot(offer).sha256;
    try { digest = createOfferDocumentSnapshot(current).sha256; } catch { /* Unsupported payments must fail in lifecycle. */ }
    await expect(sign(h, { digest, type: current.offerLetterType })).rejects.toThrow();
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });

  it.each([
    { digest: null }, { digest: "0".repeat(64) }, { type: "movement_instructor" }, { amount: 50 }, { token: "FICTIONAL-token" },
  ])("rejects missing or mismatched token/document/type/payment confirmation %j", async input => {
    const h = harness(); await expect(sign(h, input)).rejects.toThrow(); expect(h.calls).toEqual([]);
  });

  it("reads association changes after waiting for the staffing mutex", async () => {
    const h = harness(base(), { afterLock: s => { s.claims[0].recordHash = "0".repeat(64); } });
    await expect(sign(h)).rejects.toThrow(); expect(h.events).toEqual(["lock", "rollback"]); expect(h.calls).toEqual([]);
  });
  it("observes a reassigned third application after waiting for the staffing mutex", async () => {
    const state = base(); state.actions = [];
    const h = harness(state, { afterLock: s => {
      Object.assign(s.apps[2], { name: "Different Person", email: "different@example.test", phone: "+14165550199" });
    } });
    await expect(sign(h)).rejects.toThrow("reviewed ownership could not be verified");
    expect(h.events).toEqual(["lock", "rollback"]); expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });
  it("sees a conflicting application inserted before acquiring the staffing mutex", async () => {
    const h = harness(base(), { afterLock: s => { s.apps.push({ ...target, id: 44, name: "Other Person" }); } });
    await expect(sign(h)).rejects.toThrow(); expect(h.events).toEqual(["lock", "rollback"]); expect(h.calls).toEqual([]);
  });
  it("observes replacement inserted before the staffing lock is acquired", async () => {
    const h = harness(base(), { afterLock: s => { s.offers.push({ ...offer, id: 4, token: "replacement", createdAt: new Date("2026-01-02") }); } });
    await expect(sign(h)).rejects.toThrow("replaced"); expect(h.events).toEqual(["lock", "rollback"]); expect(h.calls).toEqual([]);
  });
  it("enforces strict expiry at signature time using the database clock", async () => {
    const h = harness(); await sign(h);
    expect(h.calls[0].predicate.sql).toContain("`signingTokens`.`expiresAt` > CURRENT_TIMESTAMP(3)");
  });
  it.each([
    ["different name", { applicantName: "Someone Else" }],
    ["different email", { applicantEmail: "else@example.com" }],
    ["missing name", { applicantName: null }],
    ["missing email", { applicantEmail: null }],
  ])("rejects any prior target signed offer with %s before writing", async (_label, mismatch) => {
    const state = base();
    state.offers.push({ ...offer, id: 1, token: "old-bad", signed: 1, createdAt: new Date("2025-01-01"), ...mismatch });
    state.offers.push({ ...offer, id: 2_000, token: "old-good", signed: 1, createdAt: new Date("2025-02-01") });
    const h = harness(state);
    await expect(sign(h)).rejects.toThrow("reviewed ownership could not be verified");
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });
  it("accepts historical signed target identities under the same normalization as visibility", async () => {
    const state = base();
    state.offers.push({ ...offer, id: 1, token: "old-good", signed: 1, createdAt: new Date("2025-01-01"), applicantName: "  Ｆｉｃｔｉｏｎａｌ\t Applicant  ", applicantEmail: " FICTIONAL@EXAMPLE.COM " });
    const h = harness(state); await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: true });
  });
  it.each([null, new Date("2025-01-01")])("does not infer canonical delivery state from its token and sent timestamp %s", async sentAt => {
    const state = base(); state.apps[1].onboardingDeliveryToken = "possibly-legacy-or-pending"; state.apps[1].onboardingSentAt = sentAt;
    const h = harness(state); await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: true });
    expect(h.state.apps[1]).toEqual(state.apps[1]);
  });
  it("rolls back the signature if the transactional audit insertion fails", async () => {
    const state = base(), h = harness(state, { auditFails: true });
    await expect(sign(h)).rejects.toThrow("audit unavailable");
    expect(h.calls.map(call => call.table)).toEqual([signingTokens, jobApplicationActions]);
    expect(h.events).toEqual(["lock", "rollback"]); expect(h.state).toEqual(state);
  });
  it("rolls back if the guarded signature write loses a race", async () => {
    const state = base(), h = harness(state, { signatureAffected: 0 });
    await expect(sign(h)).rejects.toThrow("offer changed"); expect(h.events).toEqual(["lock", "rollback"]); expect(h.state).toEqual(state);
  });
  it("retains normal unclaimed signing and does not add an association", async () => {
    const state = base(); state.apps = [state.apps[0]]; state.claims = []; state.directory = []; state.actions = []; state.offers = [state.offers[0]];
    const h = harness(state); await expect(sign(h)).resolves.toMatchObject({ id: 3, associatedAuditRecorded: false });
    expect(h.calls.map(call => call.table)).toEqual([jobApplications, signingTokens]); expect(h.state.claims).toEqual([]);
  });
  it.each([null, "null", " \nnull\t"])("allows an unclaimed signer with unrelated null details %j", async details => {
    const state = base(); state.apps = [state.apps[0]]; state.claims = []; state.directory = []; state.offers = [state.offers[0]];
    state.actions = [{ applicationId: 99, action: "employee_added_after_signature", details }];
    const h = harness(state); await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: false });
    expect(h.calls.map(call => call.table)).toEqual([jobApplications, signingTokens]);
    expect(h.state.claims).toEqual([]); expect(h.state.actions).toEqual(state.actions);
  });
  it.each([null, "null"])("blocks an unclaimed signer when their own action has null details %j", async details => {
    const state = base(); state.apps = [state.apps[0]]; state.claims = []; state.directory = []; state.offers = [state.offers[0]];
    state.actions = [{ applicationId: 41, action: "employee_added_after_signature", details }];
    const h = harness(state); await expect(sign(h)).rejects.toThrow("reviewed ownership could not be verified");
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });
  it("allows an unclaimed signer when malformed review fields are demonstrably unrelated", async () => {
    const state = base(); state.apps = [state.apps[0]]; state.claims = []; state.directory = []; state.offers = [state.offers[0]];
    state.actions = [{ applicationId: 99, action: "employee_added_after_signature", details: JSON.stringify({ employeeId: 8,
      duplicateReview: { version: "bad", employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: 100, recordHash: null }] } }) }];
    const h = harness(state); await expect(sign(h)).resolves.toMatchObject({ associatedAuditRecorded: false });
    expect(h.calls.map(call => call.table)).toEqual([jobApplications, signingTokens]); expect(h.state.claims).toEqual([]);
  });
  it.each([
    ["ambiguous historical evidence", { applicationId: 99, action: "employee_added_after_signature", details: "not json" }],
    ["reviewed historical ownership", legacy],
  ])("blocks an unclaimed signer with %s", async (_label, action) => {
    const state = base(); state.apps = [state.apps[0]]; state.claims = []; state.directory = []; state.actions = [action]; state.offers = [state.offers[0]];
    const h = harness(state); await expect(sign(h)).rejects.toThrow();
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });
  it("blocks an unassociated signer when the application is the source of an employee", async () => {
    const state = base(); state.apps = [state.apps[0]]; state.claims = []; state.directory = [{ ...employee, sourceApplicationId: 41 }]; state.actions = []; state.offers = [state.offers[0]];
    const h = harness(state); await expect(sign(h)).rejects.toThrow("already belongs to an employee");
    expect(h.calls).toEqual([]); expect(h.state).toEqual(state);
  });
});
