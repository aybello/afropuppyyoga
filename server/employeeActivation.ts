import { eq } from "drizzle-orm";
import { employeeApplicationAssociations, employees, jobApplicationActions, jobApplications, staffInvites } from "../drizzle/schema";
import { getEmployeeLoginDetails } from "./employeeLoginDetails";
import { employeeContactsMatch, isInertArchivedApplicant, resolveEmployeeLoginProfile } from "./employeeProfileResolution";
import { reviewedHiringProfileIds } from "./employeeReviewedHiringEvidence";
import { revokeTeamProfileAccess } from "./staffAccessRevocation";
import { isActiveTeamMember } from "./teamMembership";

async function assertAssociationsAvailable(tx: any, employeeId: number, ids: number[]) {
  if (!ids.length) return;
  const claims: Array<typeof employeeApplicationAssociations.$inferSelect> = await tx.select().from(employeeApplicationAssociations);
  if (claims.some(claim => ids.includes(claim.applicationId) && claim.employeeId !== employeeId)) {
    throw new Error("The matching APY HQ profile is already linked to another employee.");
  }
}
/** Explicit employee activation, inside the shared staffing transaction lock. */
export async function activateEmployeeWithAccess(tx: any, employeeId: number, actor: {
  id: number;
  name: string | null;
  email: string | null;
}, _isOwner: boolean, prepared?: {
  /** Server-verified immediately before the edit, under the same lock. Never user input. */
  canonicalId: number | null;
  duplicateIds: number[];
}) {
  const [employee]: Array<typeof employees.$inferSelect> = await tx.select().from(employees)
    .where(eq(employees.id, employeeId)).limit(1);
  if (!employee) throw new Error("Employee record not found.");
  const { role, location, email, phone } = getEmployeeLoginDetails(employee);
  const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications);
  const directory: Array<typeof employees.$inferSelect> = await tx.select().from(employees);
  const reviewedIds = await reviewedHiringProfileIds(tx, employee, profiles, directory);
  const historicalIds = new Set(prepared?.duplicateIds ?? []);
  if (Array.from(historicalIds).some((id) => reviewedIds.has(id))) {
    throw new Error("Reviewed applicant history cannot be retired as a login duplicate.");
  }
  const historical = profiles.filter((profile) => historicalIds.has(profile.id));
  if (prepared && (employee.sourceApplicationId !== prepared.canonicalId || historical.length !== historicalIds.size)) {
    throw new Error("The linked employee identity changed during editing. Reload and try again.");
  }
  if (historical.some((profile) => directory.some((other) => other.id !== employee.id && other.sourceApplicationId === profile.id))) {
    throw new Error("The matching APY HQ profile is already linked to another employee.");
  }
  const resolved = resolveEmployeeLoginProfile({ ...employee, email, phone }, profiles.filter((profile) => !historicalIds.has(profile.id)), directory, reviewedIds);
  const profile = resolved.canonical;
  const duplicates = [...resolved.duplicates, ...historical];
  await assertAssociationsAvailable(tx, employee.id, [profile?.id, ...duplicates.map(duplicate => duplicate.id)].filter((id): id is number => id !== undefined));
  for (const duplicate of duplicates) {
    // Preserve applicant/signing history. Only the redundant login capability
    // is retired, and active duplicate duties follow the existing safe path.
    if (isActiveTeamMember(duplicate)) {
      await revokeTeamProfileAccess(tx, duplicate.id, { isOwner: _isOwner, actor });
    } else {
      await tx.update(jobApplications).set({ isTeamMember: false, deletedAt: duplicate.deletedAt ?? new Date() }).where(eq(jobApplications.id, duplicate.id));
      await tx.update(staffInvites).set({ isActive: 0 }).where(eq(staffInvites.applicationId, duplicate.id));
    }
  }
  const values = { name: employee.name, email, phone, role, location,
    status: "onboarded" as const, isTeamMember: true, deletedAt: null };
  let sourceApplicationId = profile?.id ?? null;
  if (sourceApplicationId === null) {
    const result = await tx.insert(jobApplications).values({ ...values, whyAPY: "Added directly through Employee Directory activation.", experience: "" });
    sourceApplicationId = Number(result[0].insertId);
  } else {
    await tx.update(jobApplications).set(values).where(eq(jobApplications.id, sourceApplicationId));
  }
  await tx.update(employees).set({ employmentStatus: "active", endedAt: null, sourceApplicationId })
    .where(eq(employees.id, employee.id));
  await tx.insert(jobApplicationActions).values({
    applicationId: sourceApplicationId,
    action: "employee_and_login_activated",
    actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email,
    details: JSON.stringify({ employmentActivated: true, grantsApyHqAccess: true, employeeId, retiredDuplicateProfileIds: duplicates.map((duplicate) => duplicate.id) }),
  });
  // Revoked/expired invite links are not revived. Staff can request a fresh
  // email link or verify their saved phone through the existing login flow.
  return { success: true, sourceApplicationId, grantsApyHqAccess: true };
}

/** Active edits establish the duplicate relationship before changing contacts. */
export async function prepareActiveEmployeeEdit(tx: any, employee: typeof employees.$inferSelect, next: {
  name: string; email: string | null; phone: string | null; role: string; location: string;
}) {
  getEmployeeLoginDetails(next);
  const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications);
  const directory: Array<typeof employees.$inferSelect> = await tx.select().from(employees);
  const reviewedIds = await reviewedHiringProfileIds(tx, employee, profiles, directory);
  const previous = resolveEmployeeLoginProfile(employee, profiles, directory, reviewedIds);
  await assertAssociationsAvailable(tx, employee.id, [previous.canonical?.id, ...previous.duplicates.map(duplicate => duplicate.id)].filter((id): id is number => id !== undefined));
  const knownIds = new Set([previous.canonical?.id, ...previous.duplicates.map((profile) => profile.id)]);
  if (directory.some((other) => other.id !== employee.id && employeeContactsMatch(next, other))) {
    throw new Error("Another Employee Directory record uses this contact.");
  }
  if (profiles.some((profile) => {
    if (profile.id === previous.canonical?.id) return false;
    if (!reviewedIds.has(profile.id) && !knownIds.has(profile.id)) {
      return !isInertArchivedApplicant(profile, employee, directory) && employeeContactsMatch(next, profile);
    }
    // Preserve existing reviewed contact relationships, but do not use review
    // evidence or known legacy duplicates to authorize a new collision.
    return (["email", "phone"] as const).some((field) => {
      const only = (person: typeof next) => ({ name: person.name, email: field === "email" ? person.email : null, phone: field === "phone" ? person.phone : null });
      return employeeContactsMatch(only(next), only(profile)) && !employeeContactsMatch(only(employee), only(profile));
    });
  })) {
    throw new Error("Another applicant or staff profile uses this contact. Review the conflicting record before saving.");
  }
  // Canonical linking is recorded in the same transaction before the edit.
  // No access is granted here and historic duplicate fields are not rewritten.
  const canonicalId = previous.canonical?.id ?? null;
  if (employee.sourceApplicationId !== canonicalId) {
    await tx.update(employees).set({ sourceApplicationId: canonicalId }).where(eq(employees.id, employee.id));
  }
  return { canonicalId, duplicateIds: previous.duplicates.map((profile) => profile.id) };
}
