import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  employees,
  jobApplicationActions,
  jobApplications,
  type User,
} from "../drizzle/schema";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import type { ApyAccess } from "./apyAccess";
import { isActiveTeamMember } from "./teamMembership";

const activationAction = "employee_and_login_activated";
const forbidden = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "Unable to verify ownership of signed offer documents.",
  });

/**
 * Resolve document ownership, not signing state. The caller must separately
 * select completed documents and must never expose signing tokens.
 *
 * Use the caller's database handle; this helper performs reads only. Mutable
 * contact/name/role fields do not establish historical document ownership.
 */
export async function getMySignedOfferApplicationIds(
  db: any,
  user: User,
  access: ApyAccess
): Promise<number[]> {
  if (access.level === "none") throw forbidden();
  // Owners have no implicit staff identity and cannot impersonate a member.
  if (!access.teamMember) return [];

  const candidates: Array<typeof jobApplications.$inferSelect> = await db
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.isTeamMember, true),
        isNull(jobApplications.deletedAt)
      )
    );
  const activeProfiles = candidates.filter(isActiveTeamMember);
  const email = user.email?.trim().toLowerCase();
  const phone = user.openId.startsWith("staff-phone:")
    ? normalizeCanadianPhoneNumber(user.openId.slice("staff-phone:".length))
    : null;
  const matches = activeProfiles.filter(
    profile =>
      Boolean(email && profile.email?.trim().toLowerCase() === email) ||
      Boolean(
        phone && normalizeCanadianPhoneNumber(profile.phone ?? "") === phone
      )
  );
  // resolveApyAccess uses a first match; sensitive documents must reject any
  // ambiguity, including different email and phone matches for the same login.
  if (matches.length !== 1 || matches[0].id !== access.teamMember.id)
    throw forbidden();
  const member = matches[0];

  // Read the entire directory so inactive rows and other owners also count as
  // claims on a source application. Never find an employee by mutable contacts.
  const directory: Array<typeof employees.$inferSelect> = await db
    .select()
    .from(employees);
  const linked = directory.filter(
    employee => employee.sourceApplicationId === member.id
  );
  if (linked.length > 1) throw forbidden();
  const employee = linked[0];
  if (employee && employee.employmentStatus !== "active") throw forbidden();
  const owned = new Set<number>([member.id]);
  // Manually managed staff still own their current application's documents.
  if (!employee) return Array.from(owned);

  const actions: Array<typeof jobApplicationActions.$inferSelect> = await db
    .select()
    .from(jobApplicationActions)
    .where(
      and(
        eq(jobApplicationActions.applicationId, member.id),
        eq(jobApplicationActions.action, activationAction)
      )
    );
  const otherClaims = new Set(
    directory
      .filter(other => other.id !== employee.id)
      .map(other => other.sourceApplicationId)
  );
  const otherActiveIds = new Set(
    activeProfiles
      .filter(profile => profile.id !== member.id)
      .map(profile => profile.id)
  );

  for (const action of actions) {
    if (
      action.applicationId !== member.id ||
      action.action !== activationAction
    )
      continue;
    let details: unknown;
    try {
      details = JSON.parse(action.details ?? "");
    } catch {
      continue;
    }
    if (!details || typeof details !== "object" || Array.isArray(details))
      continue;
    const evidence = details as Record<string, unknown>;
    if (
      evidence.employeeId !== employee.id ||
      !Array.isArray(evidence.retiredDuplicateProfileIds)
    )
      continue;
    const historicalIds: unknown[] = evidence.retiredDuplicateProfileIds;
    // Do not coerce strings, fractions, booleans, unsafe integers, or partly
    // malformed arrays into authority for a sensitive document.
    if (
      !historicalIds.every(
        id => typeof id === "number" && Number.isSafeInteger(id) && id > 0
      )
    )
      continue;
    for (const id of historicalIds as number[]) {
      if (!otherClaims.has(id) && !otherActiveIds.has(id)) owned.add(id);
    }
  }
  return Array.from(owned);
}
