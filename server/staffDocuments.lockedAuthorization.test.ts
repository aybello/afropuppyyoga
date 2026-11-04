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

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn(), buildSignedOfferPdf: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getSigningTokenByToken: vi.fn() }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
vi.mock("./signedOfferPdf", () => ({ buildSignedOfferPdf: mocks.buildSignedOfferPdf }));
// Run the real middleware, shared mutex and ownership resolver together.
import { staffDocumentsRouter } from "./routers/staffDocuments";

const member = {
  id: 42, name: "Canonical Employee", email: "member@example.com", phone: null,
  role: "Puppy Monitor", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null,
};
const user: User = {
  id: 5, openId: "staff-email:member@example.com", email: member.email, name: member.name,
  role: "staff", loginMethod: "test", createdAt: new Date(0), updatedAt: new Date(0), lastSignedIn: new Date(0),
};
const access: ApyAccess = { level: "team_member", teamMember: member, canManageOperations: false };
const employee = { id: 7, sourceApplicationId: 42, employmentStatus: "active" };
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
    currentUser: { ...user }, profiles: [{ ...member }], directory: [{ ...employee }], associations: [],
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
            expect(condition?.sql).toBe("(`jobApplications`.`isTeamMember` = ? and `jobApplications`.`deletedAt` is null)");
            expect(condition?.params).toEqual([true]);
            result = state.profiles.filter(profile => profile.isTeamMember && profile.deletedAt == null);
          } else if (table === employees) {
            expect(condition).toBeUndefined();
            result = state.directory;
          } else if (table === employeeApplicationAssociations) {
            expect(condition).toBeUndefined();
            result = state.associations;
          } else if (table === jobApplicationActions) {
            expect(condition?.params).toEqual([42, "employee_and_login_activated"]);
            result = state.actions.filter(action => action.applicationId === 42 && action.action === "employee_and_login_activated");
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
    expect(h.reads).toEqual([staffingMutationLocks, users, jobApplications, employees, employeeApplicationAssociations, jobApplicationActions, signingTokens]);
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

  it.each(["directory", "association"] as const)("withholds history reassigned through another employee's %s claim before locking", async kind => {
    const h = harness(s => {
      if (kind === "directory") s.directory.push({ id: 8, sourceApplicationId: 41, employmentStatus: "inactive" });
      else s.associations.push({ applicationId: 41, employeeId: 8, canonicalApplicationId: 99 });
    });
    await expect(h.api.mySignedOffers()).resolves.toEqual([]);
    await expect(h.api.downloadMySignedOffer({ id: 101 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
  });
});
