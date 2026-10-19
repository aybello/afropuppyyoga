import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";
import { employees, jobApplicationActions, jobApplications, signingTokens, staffingMutationLocks } from "../drizzle/schema";
import { canAccessHubTool, canManageOperations, getApyAccessLevel, isApprovedApyTeamRole } from "../shared/apyPermissions";
import { hireSignedApplicant } from "./hireSignedApplicant";

const actor = { id: 1, name: "Owner", email: "owner@example.com" };
const applicant = {
  id: 42, name: "Fictional Social Media Applicant", email: "intern@example.com", phone: null,
  role: "Social Media Intern", location: "REMOTE", status: "accepted", isTeamMember: false,
  onboardingSentAt: null, onboardingDeliveryToken: null, deletedAt: null,
};
const signedOffer = {
  id: 9, applicationId: applicant.id, applicantName: applicant.name, applicantEmail: applicant.email,
  role: applicant.role, location: applicant.location, offerLetterType: "social_media_intern", signed: 1,
  socialMediaHourlyPayCad: 19, signedDocumentSnapshot: "immutable signed offer and NDA",
  createdAt: new Date("2026-03-01T12:00:00Z"), signedAt: new Date("2026-03-02T12:00:00Z"),
};

type Values = Record<string, unknown>;
/** In-memory staged transaction, not a DB integration: real Drizzle SQL is inspected,
 * table/predicate mistakes fail closed, and failed callbacks discard domain writes.
 * The actual staffing-lock and hiring implementations run without module mocks.
 */
function hiringHarness(options: { role?: string; signed?: number; failAudit?: boolean } = {}) {
  const role = options.role ?? applicant.role;
  let committed = {
    applicant: { ...applicant, role },
    offer: { ...signedOffer, role, signed: options.signed ?? 1 },
    directory: [] as Values[],
    audit: [] as Values[],
  };
  const writes: Array<{ table: unknown; values: Values }> = [];
  const dialect = new MySqlDialect();
  let commits = 0, rollbacks = 0;
  const assertSql = (predicate: SQL, sql: string, params: unknown[]) => {
    const query = dialect.sqlToQuery(predicate);
    expect(query.sql.replace(/`/g, "")).toBe(sql);
    expect(query.params).toEqual(params);
  };
  const db = {
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const pending = structuredClone(committed);
      const tx = {
        select: () => {
          let table: unknown;
          let rows: unknown[] = [];
          const chain = {
            from(target: unknown) {
              table = target;
              if (table === staffingMutationLocks) rows = [{ lockName: "apy_staffing_mutation_v1" }];
              else if (table === jobApplications) rows = [structuredClone(pending.applicant)];
              else if (table === signingTokens) rows = [structuredClone(pending.offer)];
              else if (table === employees) rows = structuredClone(pending.directory);
              else throw new Error("Unexpected table read");
              return chain;
            },
            where(predicate: SQL) {
              if (table === staffingMutationLocks) {
                assertSql(predicate, "staffingMutationLocks.lockName = ?", ["apy_staffing_mutation_v1"]);
              } else if (table === jobApplications) {
                assertSql(predicate, "jobApplications.id = ?", [pending.applicant.id]);
              } else if (table === signingTokens) {
                assertSql(predicate, "signingTokens.applicationId = ?", [pending.applicant.id]);
              } else throw new Error("Unexpected filtered read");
              return chain;
            },
            orderBy(...columns: SQL[]) {
              expect(table).toBe(signingTokens);
              expect(columns.map((column) => dialect.sqlToQuery(column).sql.replace(/`/g, "")))
                .toEqual(["signingTokens.createdAt desc", "signingTokens.id desc"]);
              return chain;
            },
            limit: async (limit: number) => { expect(limit).toBe(1); return rows.slice(0, limit); },
            for: async (mode: string) => {
              expect(table).toBe(staffingMutationLocks);
              expect(mode).toBe("update");
              return rows;
            },
            then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
          };
          return chain;
        },
        update: (table: unknown) => ({ set: (values: Values) => ({
          where: async (predicate: SQL) => {
            writes.push({ table, values });
            if (table !== jobApplications) throw new Error("Unexpected update (offers must remain immutable)");
            assertSql(predicate,
              "(jobApplications.id = ? and jobApplications.appStatus = ? and jobApplications.isTeamMember = ? and jobApplications.deletedAt is null and jobApplications.onboardingDeliveryToken is null)",
              [pending.applicant.id, "accepted", false]);
            const affectedRows = pending.applicant.status === "accepted" && !pending.applicant.isTeamMember
              && pending.applicant.deletedAt === null && pending.applicant.onboardingDeliveryToken === null ? 1 : 0;
            if (affectedRows) Object.assign(pending.applicant, values);
            return [{ affectedRows }];
          },
        }) }),
        insert: (table: unknown) => ({ values: (values: Values) => {
          if (table === staffingMutationLocks) return {
            onDuplicateKeyUpdate: async (update: unknown) => {
              expect(values).toEqual({ lockName: "apy_staffing_mutation_v1" });
              expect(update).toEqual({ set: values });
              return [{ affectedRows: 1 }];
            },
          };
          writes.push({ table, values });
          if (table === employees) {
            pending.directory.push({ id: 7, ...structuredClone(values) });
            return Promise.resolve([{ insertId: 7 }]);
          }
          if (table === jobApplicationActions) {
            if (options.failAudit) throw new Error("Audit insert failed");
            pending.audit.push(structuredClone(values));
            return Promise.resolve([{ insertId: 8 }]);
          }
          throw new Error("Unexpected domain insert");
        } }),
      };
      try {
        const result = await callback(tx);
        committed = structuredClone(pending);
        commits++;
        return result;
      } catch (error) {
        rollbacks++;
        throw error;
      }
    }),
  };
  return { db, writes, get state() { return structuredClone(committed); },
    get commits() { return commits; }, get rollbacks() { return rollbacks; } };
}

describe("Social Media Intern team-only access", () => {
  it.each([
    "Social Media Intern", "social media intern", "  SOCIAL   MEDIA\tINTERN  ",
    "social_media_intern", "Social-Media-Intern",
  ])("approves the normalized role %j", (role) => {
    expect(isApprovedApyTeamRole(role)).toBe(true);
    expect(getApyAccessLevel(role)).toBe("team_member");
  });

  it("allows team tools without operations management, operations tools, or owner tools", () => {
    const level = getApyAccessLevel("Social Media Intern");
    expect(level).toBe("team_member");
    expect(canManageOperations(level)).toBe(false);
    expect(canAccessHubTool(level, "team")).toBe(true);
    expect(canAccessHubTool(level, "operations")).toBe(false);
    expect(canAccessHubTool(level, "owner")).toBe(false);
  });

  it("preserves existing Operations Manager approval and manager privileges", () => {
    expect(isApprovedApyTeamRole("Operations Manager")).toBe(true);
    const level = getApyAccessLevel("Operations Manager");
    expect(level).toBe("operations_manager");
    expect(canManageOperations(level)).toBe(true);
    expect(canAccessHubTool(level, "team")).toBe(true);
    expect(canAccessHubTool(level, "operations")).toBe(true);
    expect(canAccessHubTool(level, "owner")).toBe(false);
  });

  it("rejects unknown and empty roles at the approved-role gate", () => {
    for (const role of ["Social Media Intern Manager", "Event Host", "", null, undefined]) {
      expect(isApprovedApyTeamRole(role)).toBe(false);
    }
  });
});

describe("signed Social Media Intern hiring", () => {
  it("saves Directory and team access on the canonical REMOTE application without changing its signed offer", async () => {
    const h = hiringHarness();
    const before = h.state;
    await expect(hireSignedApplicant(h.db, applicant.id, actor, applicant)).resolves.toEqual({
      success: true, id: 7, alreadyAdded: false, grantsApyHqAccess: true,
      grantsPortalAccess: true, portalAccessLevel: "team_member",
    });
    const state = h.state;
    expect(state.applicant).toEqual({ ...before.applicant, status: "onboarded", isTeamMember: true });
    expect(state.directory).toEqual([{
      id: 7, sourceApplicationId: applicant.id, name: applicant.name, email: applicant.email, phone: null,
      role: "Social Media Intern", location: "REMOTE", employmentStatus: "active", endedAt: null,
    }]);
    expect(state.audit).toEqual([{
      applicationId: applicant.id, action: "employee_added_after_signature", fromStatus: "accepted", toStatus: "onboarded",
      actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email, details: expect.any(String),
    }]);
    expect(JSON.parse(state.audit[0].details as string)).toEqual({
      employeeId: 7, signingTokenId: signedOffer.id, grantsPortalAccess: true, portalAccessLevel: "team_member",
      onboardingDocumentsSent: false, trainingCompleted: false,
    });
    expect(state.offer).toEqual(before.offer);
    expect(h.writes.map((write) => write.table)).toEqual([jobApplications, employees, jobApplicationActions]);
    expect(h.writes.some((write) => write.table === signingTokens)).toBe(false);
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.commits).toBe(1);
    expect(h.rollbacks).toBe(0);
  });

  it("rejects a signed but unsupported role without saving access or Directory changes", async () => {
    const h = hiringHarness({ role: "Social Media Intern Manager" });
    const before = h.state;
    await expect(hireSignedApplicant(h.db, applicant.id, actor)).rejects.toThrow("supported staff role");
    expect(h.state).toEqual(before);
    expect(h.writes).toEqual([]);
    expect(h.commits).toBe(0);
    expect(h.rollbacks).toBe(1);
  });

  it("does not grant an accepted intern access before the current offer is signed", async () => {
    const h = hiringHarness({ signed: 0 });
    const before = h.state;
    await expect(hireSignedApplicant(h.db, applicant.id, actor)).rejects.toThrow("sign their current Offer Letter and NDA");
    expect(h.state).toEqual(before);
    expect(h.writes).toEqual([]);
    expect(h.commits).toBe(0);
  });

  it("rolls back staged Directory and team-access writes when the audit insert fails", async () => {
    const h = hiringHarness({ failAudit: true });
    const before = h.state;
    await expect(hireSignedApplicant(h.db, applicant.id, actor)).rejects.toThrow("Audit insert failed");
    expect(h.writes.map((write) => write.table)).toEqual([jobApplications, employees, jobApplicationActions]);
    expect(h.state).toEqual(before);
    expect(h.commits).toBe(0);
    expect(h.rollbacks).toBe(1);
  });
});
