import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import {
  employeeApplicationAssociations,
  employees,
  jobApplicationActions,
  jobApplications,
  signingTokens,
  type User,
} from "../drizzle/schema";
import type { ApyAccess } from "./apyAccess";
import { getMySignedOfferApplicationIds } from "./mySignedOfferOwnership";
import { reviewedHiringRecordHash } from "./hiringDuplicateIdentity";

const member = {
  id: 42,
  name: "Current Member",
  email: "member@example.com",
  phone: "+12895550100",
  role: "Puppy Monitor",
  location: "KW",
  status: "onboarded",
  isTeamMember: true,
  deletedAt: null,
};
const user: User = {
  id: 5,
  openId: "staff-email:example",
  name: member.name,
  email: member.email,
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
const employee = {
  id: 7,
  sourceApplicationId: member.id,
  name: member.name,
  email: member.email,
  phone: member.phone,
  role: member.role,
  location: member.location,
  employmentStatus: "active",
  endedAt: null,
};
const activation = (
  ids: unknown = [41],
  overrides: Record<string, unknown> = {}
) => ({
  applicationId: member.id,
  action: "employee_and_login_activated",
  details: JSON.stringify({
    employeeId: employee.id,
    retiredDuplicateProfileIds: ids,
  }),
  ...overrides,
});

type Read = { table: unknown; rows: unknown[] };
/** Queue-backed thenable query fake: no network, real database, or mutation. */
function fakeDb(reads: Read[]) {
  const queue = [...reads];
  const queries: Array<{
    table: unknown;
    predicates: SQL[];
    limited: boolean;
  }> = [];
  const db = {
    select: vi.fn(() => {
      let rows: unknown[] = [];
      let query: (typeof queries)[number];
      const chain: any = {
        from: (table: unknown) => {
          const next = queue.shift();
          if (!next) throw new Error("Unexpected database read");
          expect(table).toBe(next.table);
          rows = next.rows;
          query = { table, predicates: [], limited: false };
          queries.push(query);
          return chain;
        },
        where: (predicate: SQL) => {
          query.predicates.push(predicate);
          return chain;
        },
        limit: () => {
          query.limited = true;
          return chain;
        },
        then: (resolve: (value: unknown[]) => unknown) =>
          Promise.resolve(rows).then(resolve),
      };
      return chain;
    }),
    insert: vi.fn(() => {
      throw new Error("Unexpected insert");
    }),
    update: vi.fn(() => {
      throw new Error("Unexpected update");
    }),
    delete: vi.fn(() => {
      throw new Error("Unexpected delete");
    }),
    transaction: vi.fn(() => {
      throw new Error("Unexpected transaction");
    }),
  };
  return { db, queries, queue };
}
function scenario({
  profiles = [member],
  directory = [employee],
  actions = [],
  associations = [],
  groupedProfiles = [],
  offers = [],
}: { profiles?: unknown[]; directory?: unknown[]; actions?: unknown[]; associations?: any[]; groupedProfiles?: unknown[]; offers?: unknown[] } = {}) {
  const needsGroupedReads = associations.some(entry => entry.employeeId === 7 && entry.canonicalApplicationId === 42 && entry.applicationId !== 42
    && associations.filter(other => other.applicationId === entry.applicationId).length === 1
    && !directory.some((other: any) => other.id !== 7 && other.sourceApplicationId === entry.applicationId)
    && !profiles.some((profile: any) => profile.id === entry.applicationId && profile.isTeamMember && !profile.deletedAt && ["accepted", "onboarded"].includes(profile.status)));
  return fakeDb([
    { table: jobApplications, rows: profiles },
    { table: employees, rows: directory },
    { table: employeeApplicationAssociations, rows: associations },
    { table: jobApplicationActions, rows: actions },
    ...(needsGroupedReads ? [{ table: jobApplications, rows: groupedProfiles }, { table: signingTokens, rows: offers }] : []),
  ]);
}
async function expectForbidden(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(TRPCError);
  await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
}

describe("getMySignedOfferApplicationIds", () => {
  const historical = { ...member, id: 41, isTeamMember: false, status: "rejected" };
  const claim = (applicationId: number, employeeId = 7, canonicalApplicationId = 42) => ({ applicationId, employeeId, canonicalApplicationId, recordHash: reviewedHiringRecordHash(historical) });
  it("includes only durable associations for the uniquely authenticated canonical employee", async () => {
    const { db } = scenario({ associations: [claim(42), claim(41), claim(40, 8)], actions: [], groupedProfiles: [historical], offers: [{ applicationId: 41, applicantName: member.name, applicantEmail: member.email }] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42, 41]);
  });
  it("withholds grouped documents when the reviewed identity changed or any signed offer has a different identity", async () => {
    for (const options of [
      { groupedProfiles: [{ ...historical, name: "Different" }], offers: [] },
      { groupedProfiles: [historical], offers: [{ applicationId: 41, applicantName: "Wrong Person", applicantEmail: member.email }] },
      { groupedProfiles: [historical], offers: [{ applicationId: 41, applicantName: member.name, applicantEmail: "wrong@example.com" }] },
    ]) {
      const { db } = scenario({ associations: [claim(42), claim(41)], actions: [], ...options });
      await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42]);
    }
  });
  const signedHistoricalOffer = { applicationId: 41, signed: 1, applicantName: member.name, applicantEmail: member.email };
  it("withholds reviewed history after both canonical and directory identities are reassigned, without blocking unclaimed activation IDs", async () => {
    const replacement = { name: "Different Person", email: "different@example.test", phone: "+14165550111" };
    const current = { ...member, ...replacement };
    const identities = new Map<number, { name: string; email: string }>();
    const { db } = scenario({ profiles: [current], directory: [{ ...employee, ...replacement }],
      associations: [claim(42), claim(41)], groupedProfiles: [historical], offers: [signedHistoricalOffer], actions: [activation([41, 40])] });
    await expect(getMySignedOfferApplicationIds(db, { ...user, email: replacement.email }, access, identities)).resolves.toEqual([42, 40]);
    expect(identities.size).toBe(0);
  });

  it.each([
    ["name", { name: "Different Person" }],
    ["email", { email: "different@example.test" }],
    ["phone", { phone: "+14165550111" }],
  ])("withholds historical documents on an individual %s mismatch in both current records", async (_field, change) => {
    const current = { ...member, ...change };
    const { db } = scenario({ profiles: [current], directory: [{ ...employee, ...change }], associations: [claim(42), claim(41)],
      groupedProfiles: [historical], offers: [signedHistoricalOffer], actions: [activation()] });
    await expect(getMySignedOfferApplicationIds(db, { ...user, email: current.email }, access)).resolves.toEqual([42]);
  });

  it.each([
    ["canonical", "name", { name: "Different Person" }],
    ["canonical", "email", { email: "different@example.test" }],
    ["canonical", "phone", { phone: "+14165550111" }],
    ["directory", "name", { name: "Different Person" }],
    ["directory", "email", { email: "different@example.test" }],
    ["directory", "phone", { phone: "+14165550111" }],
  ])("requires the %s record's %s to match independently", async (side, _field, change) => {
    const current = { ...member, ...(side === "canonical" ? change : {}) };
    const owner = { ...employee, ...(side === "directory" ? change : {}) };
    const { db } = scenario({ profiles: [current], directory: [owner], associations: [claim(42), claim(41)],
      groupedProfiles: [historical], offers: [signedHistoricalOffer], actions: [activation()] });
    await expect(getMySignedOfferApplicationIds(db, { ...user, email: current.email }, access)).resolves.toEqual([42]);
  });

  it("accepts the same reviewed person with normalized name, email and Canadian phone formatting", async () => {
    const current = { ...member, name: "  CURRENT   MEMBER ", email: " MEMBER@EXAMPLE.COM ", phone: "1 (289) 555-0100" };
    const owner = { ...employee, name: "current member", email: "member@example.com", phone: "289-555-0100" };
    const identities = new Map<number, { name: string; email: string }>();
    const { db } = scenario({ profiles: [current], directory: [owner], associations: [claim(42), claim(41)],
      groupedProfiles: [historical], offers: [signedHistoricalOffer], actions: [activation()] });
    await expect(getMySignedOfferApplicationIds(db, user, access, identities)).resolves.toEqual([42, 41]);
    expect(identities.get(41)).toEqual({ name: historical.name, email: historical.email });
    expect(identities.has(42)).toBe(false);
  });

  it("evaluates each reviewed historical profile separately and preserves the canonical id", async () => {
    const different = { ...historical, id: 40, phone: "+14165550111" };
    const identities = new Map<number, { name: string; email: string }>();
    const { db } = scenario({ associations: [claim(42), claim(41), { ...claim(40), recordHash: reviewedHiringRecordHash(different) }],
      groupedProfiles: [historical, different], offers: [signedHistoricalOffer, { ...signedHistoricalOffer, applicationId: 40 }],
      actions: [activation([41, 40])] });
    await expect(getMySignedOfferApplicationIds(db, user, access, identities)).resolves.toEqual([42, 41]);
    expect([...identities.keys()]).toEqual([41]);
  });

  it.each([
    ["canonical", { name: " " }], ["canonical", { email: null }], ["canonical", { phone: "invalid" }],
    ["directory", { name: " " }], ["directory", { email: "not-an-email" }], ["directory", { phone: null }],
    ["historical", { name: " " }], ["historical", { email: "not-an-email" }], ["historical", { phone: "+1 289 555 0100 ext 5" }],
  ])("requires complete valid identity on the %s record (%j)", async (side, change) => {
    const current = { ...member, ...(side === "canonical" ? change : {}) };
    const owner = { ...employee, ...(side === "directory" ? change : {}) };
    const prior = { ...historical, ...(side === "historical" ? change : {}) };
    const historicalClaim = { ...claim(41), recordHash: reviewedHiringRecordHash(prior) };
    const { db } = scenario({ profiles: [current], directory: [owner], associations: [claim(42), historicalClaim],
      groupedProfiles: [prior], offers: [signedHistoricalOffer], actions: [activation()] });
    const login = current.email ? { ...user, email: current.email } : { ...user, email: null, openId: `staff-phone:${member.phone}` };
    await expect(getMySignedOfferApplicationIds(db, login, access)).resolves.toEqual([42]);
  });

  it.each(["active", "inactive"])("blocks reviewed history claimed by a different %s directory owner", async status => {
    const { db } = scenario({ directory: [employee, { ...employee, id: 8, sourceApplicationId: 41, employmentStatus: status }],
      associations: [claim(42), claim(41)], actions: [activation()] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42]);
  });

  it("forbids an inactive canonical directory owner even when reviewed history is valid", async () => {
    const { db } = scenario({ directory: [{ ...employee, employmentStatus: "inactive" }],
      associations: [claim(42), claim(41)], groupedProfiles: [historical], offers: [signedHistoricalOffer], actions: [activation()] });
    await expectForbidden(getMySignedOfferApplicationIds(db, user, access));
  });

  it("does not restore a withheld reviewed claim via legacy activation evidence", async () => {
    const { db } = scenario({ associations: [claim(42), claim(41)], groupedProfiles: [historical],
      offers: [{ ...signedHistoricalOffer, applicantEmail: "different@example.test" }], actions: [activation([41])] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42]);
  });
  it("rejects conflicting canonical claims and never exposes another employee's history through legacy evidence", async () => {
    await expectForbidden(getMySignedOfferApplicationIds(scenario({ associations: [claim(42, 8)] }).db, user, access));
    const { db } = scenario({ associations: [claim(42), claim(41, 8)], actions: [activation([41, 40])] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42, 40]);
  });
  it("does not expose a grouped application if another active profile or directory row claims it", async () => {
    const { db } = scenario({ profiles: [member, { ...member, id: 41, email: "other@example.com", phone: null }], associations: [claim(42), claim(41)], actions: [] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42]);
  });
  it("returns no personal identity for an owner and performs no reads", async () => {
    const { db } = fakeDb([]);
    await expect(
      getMySignedOfferApplicationIds(
        db,
        { ...user, role: "admin" },
        {
          level: "owner",
          teamMember: null,
          canManageOperations: true,
        }
      )
    ).resolves.toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each([null, member])(
    "forbids access level none (teamMember: %j)",
    async teamMember => {
      const { db } = fakeDb([]);
      await expectForbidden(
        getMySignedOfferApplicationIds(db, user, {
          ...access,
          level: "none",
          teamMember,
        })
      );
      expect(db.select).not.toHaveBeenCalled();
    }
  );

  it("scopes live profiles and activation evidence in SQL, reads the full directory, and never writes", async () => {
    const harness = scenario();
    await expect(
      getMySignedOfferApplicationIds(harness.db, user, access)
    ).resolves.toEqual([42]);
    expect(harness.queue).toEqual([]);
    expect(harness.queries).toHaveLength(4);
    const dialect = new MySqlDialect();
    const activeSql = dialect.sqlToQuery(harness.queries[0].predicates[0]);
    expect(activeSql.sql).toContain("`jobApplications`.`isTeamMember` = ?");
    expect(activeSql.sql).toContain("`jobApplications`.`deletedAt` is null");
    expect(activeSql.params).toEqual([true]);
    expect(harness.queries[1]).toEqual({
      table: employees,
      predicates: [],
      limited: false,
    });
    expect(harness.queries[2].table).toBe(employeeApplicationAssociations);
    const auditSql = dialect.sqlToQuery(harness.queries[3].predicates[0]);
    expect(auditSql.sql).toContain(
      "`jobApplicationActions`.`applicationId` = ?"
    );
    expect(auditSql.sql).toContain("`jobApplicationActions`.`action` = ?");
    expect(auditSql.params).toEqual([42, "employee_and_login_activated"]);
    expect(harness.queries.every(query => !query.limited)).toBe(true);
    for (const method of [
      harness.db.insert,
      harness.db.update,
      harness.db.delete,
      harness.db.transaction,
    ]) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it("matches authenticated email with case and whitespace normalization, not name", async () => {
    const { db } = scenario({
      profiles: [
        { ...member, name: "Renamed Member", email: " MEMBER@EXAMPLE.COM " },
      ],
    });
    await expect(
      getMySignedOfferApplicationIds(
        db,
        { ...user, email: " member@example.com " },
        access
      )
    ).resolves.toEqual([42]);
  });

  it("supports phone-only staff identities with normalized numbers", async () => {
    const phoneMember = { ...member, email: null, phone: "(289) 555-0100" };
    const { db } = scenario({ profiles: [phoneMember] });
    await expect(
      getMySignedOfferApplicationIds(
        db,
        {
          ...user,
          email: null,
          openId: "staff-phone:1 (289) 555-0100",
        },
        { ...access, teamMember: phoneMember }
      )
    ).resolves.toEqual([42]);
  });

  it("does not count the same profile twice when both authenticated contacts match", async () => {
    const { db } = scenario();
    await expect(
      getMySignedOfferApplicationIds(
        db,
        {
          ...user,
          openId: "staff-phone:+12895550100",
        },
        access
      )
    ).resolves.toEqual([42]);
  });

  it.each([
    { email: null, openId: "oauth:2895550100" },
    { email: "other@example.com", openId: "oauth:example" },
    { email: null, openId: "staff-phone:invalid" },
    { email: " ", openId: "oauth:example" },
  ])(
    "does not authenticate from context member contacts: %j",
    async identity => {
      const { db } = scenario();
      await expectForbidden(
        getMySignedOfferApplicationIds(db, { ...user, ...identity }, access)
      );
      expect(db.select).toHaveBeenCalledTimes(1);
    }
  );

  it("rejects an unrelated active email collision even with different name and phone", async () => {
    const { db } = scenario({
      profiles: [
        member,
        {
          ...member,
          id: 99,
          name: "Someone Else",
          email: " MEMBER@EXAMPLE.COM ",
          phone: "+14165550100",
        },
      ],
    });
    await expectForbidden(getMySignedOfferApplicationIds(db, user, access));
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("rejects email and staff-phone identities resolving to different active profiles", async () => {
    const { db } = scenario({
      profiles: [
        member,
        {
          ...member,
          id: 99,
          email: "other@example.com",
          phone: "+14165550100",
        },
      ],
    });
    await expectForbidden(
      getMySignedOfferApplicationIds(
        db,
        {
          ...user,
          openId: "staff-phone:+14165550100",
        },
        access
      )
    );
  });

  it("rejects ambiguous normalized phone identities", async () => {
    const { db } = scenario({
      profiles: [
        member,
        { ...member, id: 99, email: null, phone: "289-555-0100" },
      ],
    });
    await expectForbidden(
      getMySignedOfferApplicationIds(
        db,
        {
          ...user,
          email: null,
          openId: "staff-phone:+12895550100",
        },
        access
      )
    );
  });

  it("rejects a live identity that no longer matches the context profile id", async () => {
    const { db } = scenario({ profiles: [{ ...member, id: 99 }] });
    await expectForbidden(getMySignedOfferApplicationIds(db, user, access));
  });

  it.each([null, ""])("rechecks current role permission instead of retaining stale context access (%j)", async role => {
    const { db } = scenario({ profiles: [{ ...member, role }] });
    await expectForbidden(getMySignedOfferApplicationIds(db, user, access));
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("never lets a newly administrative login impersonate an earlier member identity", async () => {
    const { db } = fakeDb([]);
    await expectForbidden(getMySignedOfferApplicationIds(db, { ...user, role: "admin" }, access));
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each(
    [
      [],
      [{ ...member, isTeamMember: false }],
      [{ ...member, deletedAt: new Date(0) }],
      [{ ...member, status: "new" }],
      [{ ...member, status: "rejected" }],
    ].map(profiles => ({ profiles }))
  )(
    "rejects missing, archived, revoked or inactive profiles (%j)",
    async ({ profiles }) => {
      const { db } = scenario({ profiles });
      await expectForbidden(getMySignedOfferApplicationIds(db, user, access));
    }
  );

  it("accepts explicitly active accepted profiles and ignores archived or non-member email collisions", async () => {
    const { db } = scenario({
      profiles: [
        { ...member, status: "accepted" },
        { ...member, id: 98, deletedAt: new Date(0) },
        { ...member, id: 99, isTeamMember: false },
      ],
    });
    await expect(
      getMySignedOfferApplicationIds(db, user, access)
    ).resolves.toEqual([42]);
  });

  it("preserves the base id after current role, name, and email change without trusting stale context fields", async () => {
    const updated = {
      ...member,
      name: "Updated Name",
      role: "Yoga Instructor",
      email: "new@example.com",
    };
    const { db } = scenario({ profiles: [updated], actions: [] });
    await expect(
      getMySignedOfferApplicationIds(
        db,
        { ...user, email: updated.email },
        access
      )
    ).resolves.toEqual([42]);
  });

  it("does not require directory contact or role equality for a direct canonical link", async () => {
    const { db } = scenario({
      directory: [
        {
          ...employee,
          name: "Old Name",
          email: "old@example.com",
          phone: null,
          role: "Old Role",
        },
      ],
    });
    await expect(
      getMySignedOfferApplicationIds(db, user, access)
    ).resolves.toEqual([42]);
  });

  it("allows manual staff their current documents but does not read unlinked historical audits", async () => {
    const { db } = scenario({ directory: [], actions: [activation()] });
    await expect(
      getMySignedOfferApplicationIds(db, user, access)
    ).resolves.toEqual([42]);
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it("does not infer a directory link from matching contacts and name", async () => {
    const { db } = scenario({
      directory: [{ ...employee, sourceApplicationId: 41 }],
    });
    await expect(
      getMySignedOfferApplicationIds(db, user, access)
    ).resolves.toEqual([42]);
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it("rejects an inactive linked directory record, even alongside unrelated active rows", async () => {
    const { db } = scenario({
      directory: [
        { ...employee, id: 8, sourceApplicationId: 99 },
        { ...employee, employmentStatus: "inactive", endedAt: new Date(0) },
      ],
    });
    await expectForbidden(getMySignedOfferApplicationIds(db, user, access));
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it("rejects multiple directory rows claiming the canonical profile rather than selecting the first", async () => {
    const { db } = scenario({ directory: [employee, { ...employee, id: 8 }] });
    await expectForbidden(getMySignedOfferApplicationIds(db, user, access));
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  const legacyHistory = { ...historical, status: "onboarded", deletedAt: new Date("2026-01-01"), phone: null };
  it.each([
    ["email-only staff", { ...member, phone: null }, { ...employee, phone: null }],
    ["changed canonical name", { ...member, name: "Updated Name" }, employee],
    ["changed directory name", member, { ...employee, name: "Updated Name" }],
    ["changed current identity", { ...member, name: "Updated Name", email: "new@example.com", phone: "+14165550111" },
      { ...employee, name: "Updated Name", email: "new@example.com", phone: "+14165550111" }],
  ])("retains audited activation history for %s without adding reviewed identity filters", async (_label, current, owner) => {
    const identities = new Map<number, { name: string; email: string }>();
    const { db, queries, queue } = scenario({ profiles: [current], directory: [owner], actions: [activation()] });
    await expect(getMySignedOfferApplicationIds(db, { ...user, email: current.email }, access, identities)).resolves.toEqual([42, 41]);
    expect(identities.size).toBe(0);
    expect(queries).toHaveLength(4);
    expect(queue).toEqual([]);
  });

  it("requires the audit rather than inferring history from matching identities", async () => {
    const { db } = scenario({ actions: [], groupedProfiles: [legacyHistory], offers: [signedHistoricalOffer] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42]);
  });

  it("cannot use legacy evidence to bypass a reviewed claim's invalid record hash", async () => {
    const { db } = scenario({ actions: [activation()], associations: [claim(41)], groupedProfiles: [legacyHistory], offers: [signedHistoricalOffer] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42]);
  });

  it("includes archived history only with explicit employee activation evidence, not contact/name similarity", async () => {
    const history = { ...member, id: 41, isTeamMember: false, deletedAt: new Date(0) };
    const profiles = [member, history, { ...history, id: 40 }];
    const without = scenario({ profiles, actions: [] });
    await expect(getMySignedOfferApplicationIds(without.db, user, access)).resolves.toEqual([42]);
    const withAudit = scenario({ profiles, actions: [activation()] });
    await expect(getMySignedOfferApplicationIds(withAudit.db, user, access)).resolves.toEqual([42, 41]);
  });

  it("unions valid historical audit IDs while keeping the canonical id first and unique", async () => {
    const { db } = scenario({ actions: [activation([42, 41, 41]), activation([40, 41])] });
    await expect(getMySignedOfferApplicationIds(db, user, access)).resolves.toEqual([42, 41, 40]);
  });

  it.each(["active", "inactive"])(
    "ignores historical IDs claimed by another %s employee",
    async employmentStatus => {
      const { db } = scenario({
        directory: [
          employee,
          { ...employee, id: 8, sourceApplicationId: 41, employmentStatus },
        ],
        actions: [activation([41, 40])],
      });
      await expect(
        getMySignedOfferApplicationIds(db, user, access)
      ).resolves.toEqual([42, 40]);
    }
  );

  it("ignores an explicitly audited historical id that is now another active profile", async () => {
    const { db } = scenario({
      profiles: [
        member,
        {
          ...member,
          id: 41,
          name: "Other Staff",
          email: "other@example.com",
          phone: null,
        },
      ],
      actions: [activation([41, 40])],
    });
    await expect(
      getMySignedOfferApplicationIds(db, user, access)
    ).resolves.toEqual([42, 40]);
  });

  it.each([
    { applicationId: 99 },
    { action: "offer_signed" },
    {
      details: JSON.stringify({
        employeeId: 8,
        retiredDuplicateProfileIds: [41],
      }),
    },
    {
      details: JSON.stringify({
        employeeId: "7",
        retiredDuplicateProfileIds: [41],
      }),
    },
    { details: JSON.stringify({ retiredDuplicateProfileIds: [41] }) },
  ])(
    "ignores wrong-scope, wrong-action, or wrong-employee evidence (%j)",
    async overrides => {
      const { db } = scenario({ actions: [activation([41], overrides)] });
      await expect(
        getMySignedOfferApplicationIds(db, user, access)
      ).resolves.toEqual([42]);
    }
  );

  it.each([null, "{", "null", "[]", "true", "7", '"text"', "{}"])(
    "ignores malformed or non-object action details: %j",
    async details => {
      const { db } = scenario({ actions: [activation([41], { details })] });
      await expect(
        getMySignedOfferApplicationIds(db, user, access)
      ).resolves.toEqual([42]);
    }
  );

  it.each(
    [
      undefined,
      null,
      "41",
      41,
      {},
      [],
      ["41"],
      [0],
      [-1],
      [1.5],
      [true],
      [null],
      [Number.MAX_SAFE_INTEGER + 1],
      [41, "40"],
      [41, -1],
      [41, {}],
    ].map(ids => ({ ids }))
  )(
    "does not coerce malformed historical ID arrays into authority: %j",
    async ({ ids }) => {
      const { db } = scenario({
        actions: [
          activation([], {
            details: JSON.stringify({
              employeeId: employee.id,
              retiredDuplicateProfileIds: ids,
            }),
          }),
        ],
      });
      await expect(
        getMySignedOfferApplicationIds(db, user, access)
      ).resolves.toEqual([42]);
    }
  );

  it("continues to honor valid evidence after malformed actions without returning tokens or signing state", async () => {
    const { db } = scenario({
      actions: [
        activation([41, "40"]),
        activation([40], { details: "not json" }),
        { ...activation([39]), token: "must-not-leak", status: "pending" },
      ],
    });
    const ids = await getMySignedOfferApplicationIds(db, user, access);
    expect(ids).toEqual([42, 39]);
    expect(ids.every(id => typeof id === "number")).toBe(true);
    expect(JSON.stringify(ids)).not.toContain("must-not-leak");
  });
});
