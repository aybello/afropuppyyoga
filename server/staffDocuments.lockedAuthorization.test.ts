import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
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

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn(), buildSignedOfferPdf: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getSigningTokenByToken: vi.fn() }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
vi.mock("./signedOfferPdf", () => ({ buildSignedOfferPdf: mocks.buildSignedOfferPdf }));
// Run the real middleware, shared mutex and ownership resolver together.
import { staffDocumentsRouter } from "./routers/staffDocuments";

const member = {
  id: 42, name: "Canonical Employee", email: "member@example.com", phone: "+12895550100",
  role: "Puppy Monitor", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null,
};
const user: User = {
  id: 5, openId: "staff-email:member@example.com", email: member.email, name: member.name,
  role: "staff", loginMethod: "test", createdAt: new Date(0), updatedAt: new Date(0), lastSignedIn: new Date(0),
};
const access: ApyAccess = { level: "team_member", teamMember: member, canManageOperations: false };
const employee = { id: 7, sourceApplicationId: 42, employmentStatus: "active", name: member.name, email: member.email, phone: member.phone };
const historical = { ...member, id: 41, phone: null, isTeamMember: false, deletedAt: new Date("2026-02-01") };
const record = {
  id: 101, applicationId: 41, signed: 1, signedName: member.name, signedAt: new Date("2026-01-01"),
  applicantName: member.name, applicantEmail: member.email, signedDocumentSnapshot: "original snapshot",
  role: member.role, location: member.location,
};

type State = {
  currentUser: User;
  profiles: any[];
  directory: any[];
  associations: any[];
  actions: any[];
  records: any[];
};
function harness(changeAfterMiddleware?: (state: State) => void) {
  const state: State = {
    currentUser: { ...user }, profiles: [{ ...member }, { ...historical }], directory: [{ ...employee }], associations: [],
    actions: [{ applicationId: 42, action: "employee_and_login_activated", details: JSON.stringify({ employeeId: 7, retiredDuplicateProfileIds: [41] }) }],
    records: [structuredClone(record)],
  };
  const dialect = new MySqlDialect();
  const reads: unknown[] = [];
  let locked = false;
  const tx = {
    insert: vi.fn((table: unknown) => {
      expect(table).toBe(staffingMutationLocks);
      return { values: (values: unknown) => {
        expect(values).toEqual({ lockName: "apy_staffing_mutation_v1" });
        return { onDuplicateKeyUpdate: async () => undefined };
      } };
    }),
    select: vi.fn(() => {
      let table: unknown;
      let condition: ReturnType<MySqlDialect["sqlToQuery"]> | undefined;
      let limit: number | undefined;
      const chain: any = {
        from(selected: unknown) {
          table = selected;
          if (table !== staffingMutationLocks) expect(locked).toBe(true);
          reads.push(table);
          return chain;
        },
        where(sql: SQL) { condition = dialect.sqlToQuery(sql); return chain; },
        limit(value: number) { limit = value; return chain; },
        orderBy: () => chain,
        async for(mode: string) {
          expect(table).toBe(staffingMutationLocks);
          expect(mode).toBe("update");
          expect(condition?.params).toEqual(["apy_staffing_mutation_v1"]);
          changeAfterMiddleware?.(state);
          locked = true;
          return [{ lockName: "apy_staffing_mutation_v1" }];
        },
        then(resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) {
          expect(locked).toBe(true);
          let result: unknown[];
          if (table === users) {
            expect(condition?.sql).toBe("(`users`.`id` = ? and `users`.`openId` = ?)");
            expect(condition?.params).toEqual([user.id, user.openId]);
            expect(limit).toBe(1);
            result = state.currentUser.id === user.id && state.currentUser.openId === user.openId ? [state.currentUser] : [];
          } else if (table === jobApplications) {
            if (condition?.sql === "(`jobApplications`.`isTeamMember` = ? and `jobApplications`.`deletedAt` is null)") {
              expect(condition.params).toEqual([true]);
              result = state.profiles.filter(profile => profile.isTeamMember && profile.deletedAt == null);
            } else {
              expect(condition?.sql).toContain("`jobApplications`.`id` in (");
              result = state.profiles.filter(profile => condition?.params.includes(profile.id));
            }
          } else if (table === employees) {
            expect(condition).toBeUndefined();
            result = state.directory;
          } else if (table === employeeApplicationAssociations) {
            expect(condition).toBeUndefined();
            result = state.associations;
          } else if (table === jobApplicationActions) {
            if (condition?.params[0] === "offer_signed") {
              expect(condition.params).toEqual(["offer_signed"]);
              result = state.actions.filter(action => action.action === "offer_signed");
            } else {
              expect(condition?.params).toEqual([42, "employee_and_login_activated"]);
              result = state.actions.filter(action => action.applicationId === 42 && action.action === "employee_and_login_activated");
            }
          } else if (table === signingTokens) {
            const params = condition!.params;
            const downloading = limit === 1;
            const ownedIds = params.slice(downloading ? 1 : 0, -1);
            expect(params.at(-1)).toBe(1);
            expect(condition!.sql).toContain("`signingTokens`.`applicationId` in (");
            expect(condition!.sql).toContain("`signingTokens`.`signed` = ?");
            if (downloading) expect(condition!.sql).toContain("`signingTokens`.`id` = ?");
            result = state.records.filter(row => row.signed === 1 && ownedIds.includes(row.applicationId) && (!downloading || row.id === params[0]));
          } else {
            throw new Error("Unexpected table read");
          }
          return Promise.resolve(result.slice(0, limit)).then(resolve, reject);
        },
      };
      return chain;
    }),
  };
  const db = {
    select: vi.fn(() => { throw new Error("Root connection read is prohibited"); }),
    transaction: vi.fn(async (callback: (connection: typeof tx) => Promise<unknown>) => {
      try { return await callback(tx); }
      finally { locked = false; }
    }),
  };
  mocks.getDb.mockResolvedValue(db);
  const setHeader = vi.fn();
  const api = staffDocumentsRouter.createCaller({ req: { headers: {} }, res: { setHeader }, user } as TrpcContext);
  return { api, db, reads, state, isLocked: () => locked };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolveApyAccess.mockResolvedValue(access);
  mocks.buildSignedOfferPdf.mockResolvedValue(Buffer.from("%PDF-locked"));
});

describe("staffDocuments real locked ownership integration (no live database)", () => {
  it.each(["list", "download"] as const)("selects legacy historical documents for the active canonical employee in one %s transaction", async operation => {
    const h = harness();
    if (operation === "list") expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([101]);
    else {
      mocks.buildSignedOfferPdf.mockImplementation(async selected => {
        expect(h.isLocked()).toBe(false);
        expect(selected).toEqual(record);
        return Buffer.from("%PDF-locked");
      });
      expect((await h.api.downloadMySignedOffer({ id: 101 })).filename).toBe("APY-signed-offer-and-NDA-101.pdf");
    }
    expect(h.reads).toEqual([staffingMutationLocks, users, jobApplications, employees, employeeApplicationAssociations, jobApplicationActions, signingTokens, jobApplicationActions]);
    expect(h.db.transaction).toHaveBeenCalledOnce();
    expect(h.db.select).not.toHaveBeenCalled();
  });

  it.each([
    { label: "revoked membership", change: (s: State) => { s.profiles[0].isTeamMember = false; } },
    { label: "archived profile", change: (s: State) => { s.profiles[0].deletedAt = new Date(); } },
    { label: "inactive profile", change: (s: State) => { s.profiles[0].status = "rejected"; } },
    { label: "removed role permission", change: (s: State) => { s.profiles[0].role = null; } },
    { label: "departed canonical employee", change: (s: State) => { s.directory[0].employmentStatus = "inactive"; } },
    { label: "canonical login reassignment", change: (s: State) => { s.profiles[0].id = 99; } },
    { label: "changed authenticated email", change: (s: State) => { s.currentUser.email = "other@example.com"; } },
    { label: "conflicting canonical ownership", change: (s: State) => { s.associations.push({ applicationId: 42, employeeId: 8, canonicalApplicationId: 42 }); } },
  ])("rejects $label committed before lock acquisition despite earlier middleware permission", async ({ change }) => {
    const h = harness(change);
    await expect(h.api.mySignedOffers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(h.api.downloadMySignedOffer({ id: 101 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.reads).not.toContain(signingTokens);
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
  });

  it.each([
    { label: "email-only member", change: (s: State) => { s.profiles[0].phone = null; s.directory[0].phone = null; } },
    { label: "changed member name", change: (s: State) => { s.profiles[0].name = "Updated Name"; } },
    { label: "changed directory name", change: (s: State) => { s.directory[0].name = "Updated Name"; } },
  ])("retains activation-only list and download for $label", async ({ change }) => {
    const h = harness(change);
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([101]);
    expect((await h.api.downloadMySignedOffer({ id: 101 })).filename).toBe("APY-signed-offer-and-NDA-101.pdf");
  });

  it("documents the pre-existing activation reassignment risk rather than treating it as remediated", async () => {
    const h = harness(s => {
      Object.assign(s.profiles[0], { name: "Another Person", email: "another@example.com", phone: "+14165550111" });
      Object.assign(s.directory[0], { name: "Another Person", email: "another@example.com", phone: "+14165550111" });
      s.currentUser.email = "another@example.com";
    });
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([101]);
    expect((await h.api.downloadMySignedOffer({ id: 101 })).filename).toBe("APY-signed-offer-and-NDA-101.pdf");
  });

  it.each(["directory", "association"] as const)("withholds history reassigned through another employee's %s claim before locking", async kind => {
    const h = harness(s => {
      if (kind === "directory") s.directory.push({ id: 8, sourceApplicationId: 41, employmentStatus: "inactive" });
      else s.associations.push({ applicationId: 41, employeeId: 8, canonicalApplicationId: 99 });
    });
    await expect(h.api.mySignedOffers()).resolves.toEqual([]);
    await expect(h.api.downloadMySignedOffer({ id: 101 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
  });
  const reviewed = (s: State) => {
    s.profiles[1].phone = member.phone;
    s.associations = [
      { applicationId: 42, employeeId: 7, canonicalApplicationId: 42, recordHash: reviewedHiringRecordHash(s.profiles[0]) },
      { applicationId: 41, employeeId: 7, canonicalApplicationId: 42, recordHash: reviewedHiringRecordHash(s.profiles[1]) },
    ];
    s.records = [{ ...record, id: 101 }, { ...record, id: 102 }];
    s.actions = s.actions.filter(action => action.action !== "offer_signed");
    s.actions.push({ applicationId: 41, action: "offer_signed", details: JSON.stringify({ signingTokenId: 102, signedIp: "192.0.2.1", reviewedIdentityGuardVersion: 1 }) });
  };

  it("lists and downloads both a marked new offer and unmarked legacy offer for the reviewed person", async () => {
    const h = harness(reviewed);
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([101, 102]);
    expect((await h.api.downloadMySignedOffer({ id: 101 })).filename).toContain("101");
    expect((await h.api.downloadMySignedOffer({ id: 102 })).filename).toContain("102");
  });

  it.each([
    ["email-only member", (s: State) => { s.profiles[0].phone = null; s.directory[0].phone = null; }],
    ["name edit", (s: State) => { s.directory[0].name = "New Name"; }],
    ["email edit", (s: State) => { s.profiles[0].email = "new@example.test"; s.currentUser.email = "new@example.test"; }],
    ["complete reassignment", (s: State) => {
      const replacement = { name: "Different Person", email: "different@example.test", phone: "+14165550111" };
      Object.assign(s.profiles[0], replacement); Object.assign(s.directory[0], replacement); s.currentUser.email = replacement.email;
    }],
  ])("retains unmarked reviewed offer, but hides marked offer for %s", async (_label, edit) => {
    const h = harness(s => { reviewed(s); edit(s); });
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([101]);
    expect((await h.api.downloadMySignedOffer({ id: 101 })).filename).toContain("101");
    await expect(h.api.downloadMySignedOffer({ id: 102 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["unknown version", (s: State) => { s.actions.at(-1).details = JSON.stringify({ signingTokenId: 102, reviewedIdentityGuardVersion: 2 }); }],
    ["null version", (s: State) => { s.actions.at(-1).details = JSON.stringify({ signingTokenId: 102, reviewedIdentityGuardVersion: null }); }],
    ["duplicate marker", (s: State) => { s.actions.push(structuredClone(s.actions.at(-1))); }],
    ["cross-application marker", (s: State) => { s.actions.at(-1).applicationId = 99; }],
    ["moved marked offer", (s: State) => { s.records[1].applicationId = 42; }],
  ])("fails closed for a %s while retaining the unrelated unmarked token", async (_label, mutate) => {
    const h = harness(s => { reviewed(s); mutate(s); });
    expect((await h.api.mySignedOffers()).map(row => row.id)).toEqual([101]);
    await expect(h.api.downloadMySignedOffer({ id: 102 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
  });

  it.each([
    JSON.stringify({ signingTokenId: "102", reviewedIdentityGuardVersion: 1 }),
    JSON.stringify({ reviewedIdentityGuardVersion: 1 }),
    '{"reviewedIdentityGuardVersion":1,',
  ])("fails closed for an unassignable or malformed marker within its application: %s", async details => {
    const h = harness(s => { reviewed(s); s.actions.at(-1).details = details; });
    expect(await h.api.mySignedOffers()).toEqual([]);
    await expect(h.api.downloadMySignedOffer({ id: 101 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(h.api.downloadMySignedOffer({ id: 102 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
  });

  it("does not trust a client-supplied guard flag", async () => {
    const h = harness(reviewed);
    await expect(h.api.downloadMySignedOffer({ id: 102, reviewedIdentityGuardVersion: 1 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
  });

});
