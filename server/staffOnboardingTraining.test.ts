import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  staffTrainingCompletionClaims,
  staffTrainingProgress,
  type StaffTrainingProgress,
  type User,
} from "../drizzle/schema";
import { modulesForRole, TRAINING_MODULES } from "../shared/trainingCatalog";
import type { ApyAccess } from "./apyAccess";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
// Exercise real teamMemberProcedure middleware, Zod parsing, and the real catalog.
import { trainingRouter } from "./routers/training";

const invoiceKey = "invoice-submission-v1";
const now = new Date("2026-06-01T12:00:00Z");
const member = {
  id: 42,
  name: "Canonical Employee",
  role: "Puppy Monitor",
  location: "KW",
  email: "profile@example.com",
  phone: "+12895550100",
};
const user: User = {
  id: 5,
  openId: "staff-email:session@example.com",
  name: "Session Display Name",
  email: "session@example.com",
  role: "staff",
  loginMethod: "test",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(0),
};
const access: ApyAccess = {
  level: "team_member",
  teamMember: member,
  canManageOperations: false,
};
const noAccess: ApyAccess = {
  level: "none",
  teamMember: null,
  canManageOperations: false,
};
const ownerAccess: ApyAccess = {
  level: "owner",
  teamMember: null,
  canManageOperations: true,
};
const staffCases = [
  {
    label: "ordinary staff",
    identity: user,
    resolved: access,
    profile: member,
  },
  {
    label: "phone-only staff",
    identity: {
      ...user,
      id: 6,
      openId: "staff-phone:+12895550100",
      email: null,
    },
    resolved: {
      ...access,
      teamMember: {
        ...member,
        id: 84,
        name: "Canonical Phone Employee",
        role: "puppy_monitor",
        location: "VAN",
        email: null,
      },
    },
    profile: {
      ...member,
      id: 84,
      name: "Canonical Phone Employee",
      role: "puppy_monitor",
      location: "VAN",
      email: null,
    },
  },
];

function progress(
  overrides: Partial<StaffTrainingProgress> = {}
): StaffTrainingProgress {
  return {
    id: 101,
    staffId: member.id,
    moduleKey: "apy-standards",
    completedAt: new Date("2026-01-01T12:00:00Z"),
    acknowledgedBy: "original@example.com",
    ...overrides,
  };
}

type Claim = Pick<StaffTrainingProgress, "staffId" | "moduleKey">;
type Write = { table: unknown; values: Record<string, unknown> };
const dialect = new MySqlDialect();

/**
 * Filter real Drizzle predicates against mixed-owner rows, rather than queueing
 * prefiltered results. Unsupported SQL/tables fail closed; a missing predicate
 * exposes all rows and makes the ownership assertions fail. Transaction writes
 * are staged, so a duplicate claim or storage failure cannot commit progress.
 * This is not a live database or a database-concurrency integration test.
 */
function trainingDb(
  records: StaffTrainingProgress[] = [],
  options: { claims?: Claim[]; progressError?: Error } = {}
) {
  let committed = {
    progress: structuredClone(records),
    claims: structuredClone(options.claims ?? []),
  };
  const writes: Write[] = [];
  function predicate(condition: SQL): (row: StaffTrainingProgress) => boolean {
    const { sql, params } = dialect.sqlToQuery(condition);
    const terms = sql.replace(/[()]/g, "").split(/\s+and\s+/i);
    if (terms.length !== params.length)
      throw new Error(`Unsupported training predicate: ${sql}`);
    const checks = terms.map((term, index) => {
      const match =
        /^`staffTrainingProgress`\.`(staffId|moduleKey)` = \?$/.exec(
          term.trim()
        );
      if (!match) throw new Error(`Unsupported training predicate: ${sql}`);
      const column = match[1] as "staffId" | "moduleKey";
      return (row: StaffTrainingProgress) => row[column] === params[index];
    });
    return row => checks.every(check => check(row));
  }
  const db = {
    select: vi.fn(() => {
      let filter = (_row: StaffTrainingProgress) => true;
      let maximum: number | undefined;
      const chain = {
        from(table: unknown) {
          expect(table).toBe(staffTrainingProgress);
          return chain;
        },
        where(condition: SQL) {
          filter = predicate(condition);
          return chain;
        },
        limit(count: number) {
          maximum = count;
          return chain;
        },
        then<TResult1 = StaffTrainingProgress[], TResult2 = never>(
          resolve?:
            | ((
                rows: StaffTrainingProgress[]
              ) => TResult1 | PromiseLike<TResult1>)
            | null,
          reject?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null
        ): Promise<TResult1 | TResult2> {
          return Promise.resolve(
            structuredClone(committed.progress.filter(filter).slice(0, maximum))
          ).then(resolve, reject);
        },
      };
      return chain;
    }),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const pending = structuredClone(committed);
      const tx = {
        insert(table: unknown) {
          return {
            async values(values: Record<string, unknown>) {
              writes.push({ table, values: structuredClone(values) });
              if (table === staffTrainingCompletionClaims) {
                const claim = values as Claim;
                if (
                  pending.claims.some(
                    row =>
                      row.staffId === claim.staffId &&
                      row.moduleKey === claim.moduleKey
                  )
                ) {
                  throw new Error("ER_DUP_ENTRY: Duplicate staff/module claim");
                }
                pending.claims.push(structuredClone(claim));
              } else if (table === staffTrainingProgress) {
                if (options.progressError) throw options.progressError;
                pending.progress.push({
                  id: Math.max(0, ...pending.progress.map(row => row.id)) + 1,
                  completedAt: new Date(now),
                  acknowledgedBy: null,
                  ...structuredClone(values),
                } as StaffTrainingProgress);
              } else {
                throw new Error("Unexpected training table write");
              }
            },
          };
        },
      };
      const result = await callback(tx);
      committed = pending;
      return result;
    }),
  };
  return {
    db,
    writes,
    get state() {
      return structuredClone(committed);
    },
  };
}

function caller(
  identity: User | null = user,
  injectedAccess: ApyAccess = ownerAccess
) {
  const setHeader = vi.fn();
  const ctx = {
    req: { headers: {} },
    res: { setHeader },
    user: identity,
    apyAccess: injectedAccess,
  } as unknown as TrpcContext;
  return { api: trainingRouter.createCaller(ctx), setHeader };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getDb.mockResolvedValue(trainingDb().db);
  mocks.resolveApyAccess.mockResolvedValue(access);
});

describe("staff onboarding training: real teamMemberProcedure authorization", () => {
  it.each(["myTraining", "complete"] as const)(
    "rejects anonymous %s despite injected owner access",
    async operation => {
      const { api } = caller(null);
      await expect(
        operation === "myTraining"
          ? api.myTraining()
          : api.complete({ moduleKey: invoiceKey })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(mocks.resolveApyAccess).not.toHaveBeenCalled();
      expect(mocks.getDb).not.toHaveBeenCalled();
    }
  );

  it.each(["myTraining", "complete"] as const)(
    "rejects inactive/nonmember %s before accessing storage",
    async operation => {
      mocks.resolveApyAccess.mockResolvedValue(noAccess);
      const { api } = caller();
      await expect(
        operation === "myTraining"
          ? api.myTraining()
          : api.complete({ moduleKey: invoiceKey })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(user);
      expect(mocks.getDb).not.toHaveBeenCalled();
    }
  );
});

describe("staff onboarding training: canonical profile and own progress", () => {
  it.each(staffCases)(
    "returns $label's canonical profile, location, assigned modules and only their progress",
    async ({ identity, resolved, profile }) => {
      // A second resolver call must not replace the middleware's authorized snapshot.
      mocks.resolveApyAccess
        .mockResolvedValue(noAccess)
        .mockResolvedValueOnce(resolved);
      const h = trainingDb([
        progress({ id: 1, staffId: 999, moduleKey: "yoga-class-flow" }),
        progress({ id: 2, staffId: identity.id, moduleKey: "safety-welfare" }),
        progress({ id: 3, staffId: profile.id, moduleKey: "apy-standards" }),
        progress({ id: 4, staffId: profile.id, moduleKey: invoiceKey }),
        progress({
          id: 5,
          staffId: profile.id - 1,
          moduleKey: "pm-puppy-care",
        }),
      ]);
      mocks.getDb.mockResolvedValue(h.db);
      const before = h.state;
      const { api, setHeader } = caller(identity);
      await expect(api.myTraining()).resolves.toEqual({
        staff: {
          id: profile.id,
          name: profile.name,
          role: profile.role,
          location: profile.location,
        },
        modules: modulesForRole(profile.role),
        completedKeys: ["apy-standards", invoiceKey],
        adminPreview: false,
        canManageTraining: false,
      });
      expect(
        modulesForRole(profile.role).filter(module => module.key === invoiceKey)
      ).toHaveLength(1);
      expect(
        modulesForRole(profile.role).some(
          module => module.key === "yoga-class-flow"
        )
      ).toBe(false);
      expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(identity);
      expect(h.state).toEqual(before);
      expect(h.db.transaction).not.toHaveBeenCalled();
      expect(setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "private, no-store"
      );
    }
  );

  it("lets an owner preview the catalog but never save without an active canonical team profile", async () => {
    const owner: User = { ...user, role: "admin" };
    mocks.resolveApyAccess.mockResolvedValue(ownerAccess);
    const h = trainingDb([
      progress(),
      progress({ id: 102, staffId: owner.id, moduleKey: invoiceKey }),
    ]);
    mocks.getDb.mockResolvedValue(h.db);
    const before = h.state;
    const { api } = caller(owner, access);
    await expect(api.myTraining()).resolves.toEqual({
      staff: null,
      modules: TRAINING_MODULES,
      completedKeys: [],
      adminPreview: true,
      canManageTraining: true,
    });
    await expect(api.complete({ moduleKey: invoiceKey })).rejects.toThrow(
      "Your login is not linked to an active APY team profile."
    );
    expect(mocks.resolveApyAccess).toHaveBeenCalledTimes(2);
    expect(mocks.resolveApyAccess).toHaveBeenNthCalledWith(1, owner);
    expect(mocks.resolveApyAccess).toHaveBeenNthCalledWith(2, owner);
    expect(h.db.select).not.toHaveBeenCalled();
    expect(h.db.transaction).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
    expect(h.state).toEqual(before);
  });
});

describe("staff onboarding training: invoice completion ownership and persistence", () => {
  it.each(staffCases)(
    "saves assigned invoice training for $label using only canonical staffId and the session acknowledgement",
    async ({ identity, resolved, profile }) => {
      mocks.resolveApyAccess
        .mockResolvedValue(noAccess)
        .mockResolvedValueOnce(resolved);
      const h = trainingDb([
        progress({ id: 1, staffId: profile.id, moduleKey: "apy-standards" }),
        progress({ id: 2, staffId: 999, moduleKey: invoiceKey }),
        progress({ id: 3, staffId: identity.id, moduleKey: invoiceKey }),
      ]);
      mocks.getDb.mockResolvedValue(h.db);
      const before = h.state;
      const { api, setHeader } = caller(identity);
      // Model an untrusted transport payload; Zod must strip all extra identity and audit fields.
      const payload = {
        moduleKey: invoiceKey,
        staffId: 999,
        applicationId: 999,
        userId: 999,
        acknowledgedBy: "attacker@example.com",
        completedAt: "2099-01-01T00:00:00Z",
        role: "Operations Manager",
        location: "REMOTE",
      };
      await expect(api.complete(payload)).resolves.toEqual({ success: true });
      expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(identity);
      expect(h.db.transaction).toHaveBeenCalledTimes(1);
      expect(h.writes).toEqual([
        {
          table: staffTrainingCompletionClaims,
          values: { staffId: profile.id, moduleKey: invoiceKey },
        },
        {
          table: staffTrainingProgress,
          values: {
            staffId: profile.id,
            moduleKey: invoiceKey,
            acknowledgedBy: identity.email,
          },
        },
      ]);
      expect(h.state).toEqual({
        claims: [{ staffId: profile.id, moduleKey: invoiceKey }],
        progress: [
          ...before.progress,
          {
            id: 4,
            staffId: profile.id,
            moduleKey: invoiceKey,
            acknowledgedBy: identity.email,
            completedAt: now,
          },
        ],
      });
      expect(setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "private, no-store"
      );
    }
  );

  it.each(["yoga-class-flow", "not-a-real-module"])(
    "rejects unassigned module %s without any write",
    async moduleKey => {
      const h = trainingDb([progress()]);
      mocks.getDb.mockResolvedValue(h.db);
      const before = h.state;
      const payload = { moduleKey, staffId: 999, role: "Yoga Instructor" };
      await expect(caller().api.complete(payload)).rejects.toThrow(
        "This module is not assigned to your role."
      );
      expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(user);
      expect(h.db.select).not.toHaveBeenCalled();
      expect(h.db.transaction).not.toHaveBeenCalled();
      expect(h.writes).toEqual([]);
      expect(h.state).toEqual(before);
    }
  );

  it("keeps the original historic invoice row, timestamp and acknowledgement unchanged on repeated completion", async () => {
    const original = progress({ id: 7, moduleKey: invoiceKey });
    // Legacy progress may predate completion claims and must not be rewritten or backfilled.
    const h = trainingDb([
      progress({ id: 1, staffId: 999, moduleKey: invoiceKey }),
      progress({ id: 2, moduleKey: "apy-standards" }),
      original,
    ]);
    mocks.getDb.mockResolvedValue(h.db);
    const before = h.state;
    const { api } = caller();
    await expect(api.complete({ moduleKey: invoiceKey })).resolves.toEqual({
      success: true,
    });
    await expect(api.complete({ moduleKey: invoiceKey })).resolves.toEqual({
      success: true,
    });
    expect(h.state).toEqual(before);
    expect(
      h.state.progress.filter(
        row => row.staffId === member.id && row.moduleKey === invoiceKey
      )
    ).toEqual([original]);
    expect(h.db.transaction).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
    expect(mocks.resolveApyAccess).toHaveBeenCalledTimes(2);
  });

  it("treats a duplicate completion claim as a stale retry without inserting a second progress row", async () => {
    const claim = { staffId: member.id, moduleKey: invoiceKey };
    const h = trainingDb([], { claims: [claim] });
    mocks.getDb.mockResolvedValue(h.db);
    const before = h.state;
    await expect(
      caller().api.complete({ moduleKey: invoiceKey })
    ).resolves.toEqual({ success: true });
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.writes).toEqual([
      { table: staffTrainingCompletionClaims, values: claim },
    ]);
    expect(h.state).toEqual(before);
  });

  it("propagates nonduplicate storage errors and rolls back the staged completion claim", async () => {
    const h = trainingDb([progress()], {
      progressError: new Error("Training storage failed"),
    });
    mocks.getDb.mockResolvedValue(h.db);
    const before = h.state;
    await expect(
      caller().api.complete({ moduleKey: invoiceKey })
    ).rejects.toThrow("Training storage failed");
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.writes.map(write => write.table)).toEqual([
      staffTrainingCompletionClaims,
      staffTrainingProgress,
    ]);
    expect(h.state).toEqual(before);
  });

  it.each(["", "x".repeat(129)])(
    "rejects an invalid module key before training storage access",
    async moduleKey => {
      await expect(caller().api.complete({ moduleKey })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mocks.getDb).not.toHaveBeenCalled();
    }
  );

  it.each(["myTraining", "complete"] as const)(
    "reports unavailable storage for %s without pretending success",
    async operation => {
      mocks.getDb.mockResolvedValue(null);
      const { api } = caller();
      await expect(
        operation === "myTraining"
          ? api.myTraining()
          : api.complete({ moduleKey: invoiceKey })
      ).rejects.toThrow("Database unavailable");
      expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(user);
      expect(mocks.getDb).toHaveBeenCalledTimes(1);
    }
  );
});
