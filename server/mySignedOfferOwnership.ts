import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  employeeApplicationAssociations,
  employees,
  jobApplicationActions,
  jobApplications,
  signingTokens,
  type User,
} from "../drizzle/schema";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { getApyAccessLevel } from "../shared/apyPermissions";
import type { ApyAccess } from "./apyAccess";
import { isActiveTeamMember } from "./teamMembership";
import { hasValidReviewedIdentity, reviewedHiringRecordHash } from "./hiringDuplicateIdentity";
import { signedOfferIdentityMatches } from "./signedOfferIdentity";

const activationAction = "employee_and_login_activated";
const forbidden = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "Unable to verify ownership of signed offer documents.",
  });

/**
 * Query under the same staffing lock as ownership and offer selection. A marker
 * is never accepted from the caller. Scan all signing audits so a marked token
 * cannot lose its guard merely by being moved to a different application.
 * A completely missing/deleted audit is indistinguishable from legacy data;
 * the signing transaction and audit retention are therefore security invariants.
 */
export async function filterGuardedSignedOffers<T extends { id: number; applicationId: number }>(
  db: any, records: T[], guardedReviewedIds: Set<number>,
): Promise<T[]> {
  if (!records.length) return records;
  const actions: Array<typeof jobApplicationActions.$inferSelect> = await db.select().from(jobApplicationActions)
    .where(eq(jobApplicationActions.action, "offer_signed"));
  const blockedApplications = new Set<number>();
  const markerByToken = new Map<number, { applicationId: number; valid: boolean; count: number }>();
  for (const action of actions) {
    if (action.action !== "offer_signed") continue;
    let details: unknown;
    try { details = JSON.parse(action.details ?? ""); }
    catch {
      // Unrelated malformed legacy details were not previously authoritative.
      // An identifiable broken marker cannot be safely assigned to a token.
      if (action.details?.includes("reviewedIdentityGuardVersion")) blockedApplications.add(action.applicationId);
      continue;
    }
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      if (action.details?.includes("reviewedIdentityGuardVersion")) blockedApplications.add(action.applicationId);
      continue;
    }
    const evidence = details as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(evidence, "reviewedIdentityGuardVersion")) continue;
    const id = evidence.signingTokenId;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
      blockedApplications.add(action.applicationId);
      continue;
    }
    const previous = markerByToken.get(id);
    markerByToken.set(id, {
      applicationId: action.applicationId,
      valid: evidence.reviewedIdentityGuardVersion === 1 && !previous,
      count: (previous?.count ?? 0) + 1,
    });
  }
  return records.filter(record => {
    if (blockedApplications.has(record.applicationId)) return false;
    const marker = markerByToken.get(record.id);
    return !marker || (marker.valid && marker.count === 1 && marker.applicationId === record.applicationId
      && guardedReviewedIds.has(record.applicationId));
  });
}

/**
 * Resolve document ownership, not signing state. The caller must separately
 * select completed documents and must never expose signing tokens.
 *
 * Pass the shared staffing-lock transaction and its revalidated authenticated
 * user. Keep completed-document selection in that same transaction; IDs returned
 * here alone are not a durable authorization grant. This helper performs reads
 * only. Baseline ownership is unchanged; guardedReviewedIds is additional
 * eligibility for newly signed, server-audit-marked reviewed offers only.
 */
export async function getMySignedOfferApplicationIds(
  db: any,
  user: User,
  access: ApyAccess,
  reviewedIdentities: Map<number, { name: string; email: string }> = new Map(),
  guardedReviewedIds: Set<number> = new Set()
): Promise<number[]> {
  if (access.level === "none") throw forbidden();
  // Owners have no implicit staff identity and cannot impersonate a member.
  if (!access.teamMember) return [];
  if (user.role === "admin") throw forbidden();

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
  // Do not retain middleware's earlier permission after a locked role change,
  // or derive elevated authority from the current member's role.
  if (getApyAccessLevel(member.role) === "none") throw forbidden();

  // Read the entire directory so inactive rows and other owners also count as
  // claims on a source application. Never find an employee by mutable contacts.
  const directory: Array<typeof employees.$inferSelect> = await db
    .select()
    .from(employees);
  // Read all ownership claims, including inactive employees; partial views can
  // hide conflicts between a legacy source link and an association.
  const associations: Array<typeof employeeApplicationAssociations.$inferSelect> = await db
    .select().from(employeeApplicationAssociations);
  const linked = directory.filter(
    employee => employee.sourceApplicationId === member.id
  );
  if (linked.length > 1) throw forbidden();
  const employee = linked[0];
  const memberClaims = associations.filter(entry => entry.applicationId === member.id);
  if (memberClaims.length && (!employee || memberClaims.length !== 1 || memberClaims[0].employeeId !== employee.id || memberClaims[0].canonicalApplicationId !== member.id)) throw forbidden();
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
  const claimsByApplication = new Map<number, typeof associations>();
  for (const entry of associations) {
    const list = claimsByApplication.get(entry.applicationId) ?? [];
    list.push(entry);
    claimsByApplication.set(entry.applicationId, list);
  }
  const groupedCandidates = associations.filter(entry => entry.employeeId === employee.id && entry.canonicalApplicationId === member.id && entry.applicationId !== member.id
    && claimsByApplication.get(entry.applicationId)?.length === 1 && !otherClaims.has(entry.applicationId) && !otherActiveIds.has(entry.applicationId));
  // A signing token has its own identity snapshot. A reviewed application can
  // have older offers created for different details; never expose such offers.
  const safeGroupedIds = new Set<number>();
  if (groupedCandidates.length) {
    const ids = groupedCandidates.map(entry => entry.applicationId);
    const groupedProfiles: Array<typeof jobApplications.$inferSelect> = await db.select().from(jobApplications).where(inArray(jobApplications.id, ids));
    const offers: Array<typeof signingTokens.$inferSelect> = await db.select().from(signingTokens).where(and(inArray(signingTokens.applicationId, ids), eq(signingTokens.signed, 1)));
    const normalizedName = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    for (const entry of groupedCandidates) {
      const profile = groupedProfiles.find(p => p.id === entry.applicationId);
      if (!profile || reviewedHiringRecordHash(profile) !== entry.recordHash || !profile.email?.trim() || !profile.name?.trim()) continue;
      const matchingOffers = offers.filter(offer => offer.applicationId === entry.applicationId);
      if (matchingOffers.every(offer => typeof offer.applicantName === "string" && normalizedName(offer.applicantName) === normalizedName(profile.name)
        && typeof offer.applicantEmail === "string" && offer.applicantEmail.trim().toLowerCase() === profile.email!.trim().toLowerCase())) {
        safeGroupedIds.add(entry.applicationId);
        reviewedIdentities.set(entry.applicationId, { name: profile.name, email: profile.email });
        // This stronger rule is deliberately NOT used for baseline ownership.
        // Each value is explicitly checked before normalization: contact edits,
        // missing fields and incomplete identities fail closed for marked offers.
        if (employee.endedAt == null && hasValidReviewedIdentity(profile)
          && hasValidReviewedIdentity(member) && hasValidReviewedIdentity(employee)
          && typeof profile.email === "string" && typeof profile.phone === "string"
          && typeof member.phone === "string" && typeof employee.phone === "string"
          && signedOfferIdentityMatches({ applicantName: member.name, applicantEmail: member.email }, { name: profile.name, email: profile.email })
          && signedOfferIdentityMatches({ applicantName: employee.name, applicantEmail: employee.email }, { name: profile.name, email: profile.email })
          && normalizeCanadianPhoneNumber(member.phone) === normalizeCanadianPhoneNumber(profile.phone)
          && normalizeCanadianPhoneNumber(employee.phone) === normalizeCanadianPhoneNumber(profile.phone)) {
          guardedReviewedIds.add(entry.applicationId);
        }
      }
    }
  }
  for (const entry of associations) {
    if (entry.employeeId !== employee.id || entry.canonicalApplicationId !== member.id) continue;
    if (claimsByApplication.get(entry.applicationId)?.length !== 1 || otherClaims.has(entry.applicationId) || otherActiveIds.has(entry.applicationId)) continue;
    if (entry.applicationId === member.id || safeGroupedIds.has(entry.applicationId)) owned.add(entry.applicationId);
  }

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
      const claims = claimsByApplication.get(id) ?? [];
      if (!otherClaims.has(id) && !otherActiveIds.has(id) && claims.every(claim => claim.employeeId === employee.id && claim.canonicalApplicationId === member.id)
        && (!claims.length || id === member.id || safeGroupedIds.has(id))) owned.add(id);
    }
  }
  return Array.from(owned);
}
