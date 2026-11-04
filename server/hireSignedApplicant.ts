import { and, desc, eq, isNull } from "drizzle-orm";
import { employeeApplicationAssociations, employees, jobApplicationActions, jobApplications, signingTokens } from "../drizzle/schema";
import { isApprovedApyTeamRole, isOperationsManagerRole, normalizeApyRole } from "../shared/apyPermissions";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { employeeContactsMatch } from "./employeeProfileResolution";
import { hasHiringOwnershipClaim, hiringReviewEvidence, hiringReviewSnapshot, inspectHiringDuplicates, issueHiringReviewToken, reviewedHiringRecordHash, verifyHiringReviewToken } from "./hiringDuplicateIdentity";
import { withStaffingMutationLock } from "./staffingMutationLock";

type Actor = { id: number; name: string | null; email: string | null };
export type HiringConfirmation = { name: string; email: string; phone: string | null; role: string; location: string };
export type DuplicateReview = { token: string; acknowledged: true };
const MAX_REVIEWED_DUPLICATES = 100; // Keeps hashed evidence comfortably below MySQL TEXT's 65,535-byte limit.
const TOO_MANY_MATCHES = "Too many matching applications to review here. Resolve duplicate records before granting access.";
type DirectoryRecord = typeof employees.$inferSelect;
type DirectoryPreview = { id: number; name: string; email: string | null; phone: string | null; role: string; location: string; employmentStatus: string; sourceApplicationId: number | null };
const directoryView = (e: DirectoryRecord): DirectoryPreview => ({ id: e.id, name: e.name, email: e.email, phone: e.phone, role: e.role, location: e.location, employmentStatus: e.employmentStatus, sourceApplicationId: e.sourceApplicationId });
function directoryMatches(app: typeof jobApplications.$inferSelect, directory: DirectoryRecord[]) {
  const email = app.email?.trim().toLowerCase() ?? null;
  const phone = normalizeCanadianPhoneNumber(app.phone ?? "");
  const matches = directory.filter((employee) => employeeContactsMatch({ ...app, email, phone }, employee)).sort((a, b) => a.id - b.id);
  const match = matches[0];
  const normalizeName = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const blocked = matches.length > 1 || Boolean(match && (match.sourceApplicationId !== null || match.employmentStatus !== "active" || normalizeName(match.name) !== normalizeName(app.name)
    || (match.email && email && match.email.trim().toLowerCase() !== email)
    || (match.phone && phone && normalizeCanadianPhoneNumber(match.phone) !== phone)));
  return { matches, match, blocked };
}

/** Read-only preview; the mutation always rechecks under the staffing lock. */
export async function preflightHireSignedApplicant(db: any, applicationId: number, actor: Actor) {
  const [app]: Array<typeof jobApplications.$inferSelect> = await db.select().from(jobApplications).where(eq(jobApplications.id, applicationId)).limit(1);
  if (!app || app.deletedAt) throw new Error("This application is no longer available.");
  const [offer]: Array<typeof signingTokens.$inferSelect> = await db.select().from(signingTokens).where(eq(signingTokens.applicationId, app.id))
    .orderBy(desc(signingTokens.createdAt), desc(signingTokens.id)).limit(1);
  const directory: Array<typeof employees.$inferSelect> = await db.select().from(employees);
  const profiles: Array<typeof jobApplications.$inferSelect> = await db.select().from(jobApplications);
  const associations: Array<typeof employeeApplicationAssociations.$inferSelect> = await db.select().from(employeeApplicationAssociations);
  const actions: Array<typeof jobApplicationActions.$inferSelect> = await db.select().from(jobApplicationActions).where(eq(jobApplicationActions.action, "employee_added_after_signature"));
  const inspection = inspectHiringDuplicates(app, profiles, directory);
  const contact = directoryMatches(app, directory);
  const validOffer = Boolean(offer && offer.signed === 1 && normalizeApyRole(offer.role) === normalizeApyRole(app.role)
    && offer.location === app.location && offer.applicantEmail.trim().toLowerCase() === app.email?.trim().toLowerCase());
  const reviewedIds = new Set([app.id, ...inspection.conflicts.map((entry) => entry.id)]);
  const eligibilityReason = hasHiringOwnershipClaim(reviewedIds, directory, associations, actions) ? "This person already has an employee record. Manage or restore access from Employee Directory."
    : app.status !== "accepted" || app.isTeamMember || app.onboardingDeliveryToken ? "Select a signed, accepted applicant with no pending email delivery before adding an employee."
    : !offer || offer.signed !== 1 ? "Wait for the applicant to sign their current Offer Letter and NDA before adding them."
    : !validOffer ? "The current applicant details differ from the signed offer. Review the offer and assignment first."
    : !isApprovedApyTeamRole(app.role) ? "Choose a supported staff role before adding an employee with login access."
    : !(app.email?.trim().toLowerCase() || normalizeCanadianPhoneNumber(app.phone ?? "")) ? "Add a valid email or phone before granting login access."
    : contact.blocked ? "An existing employee uses these contacts. Review or restore that Directory record rather than creating a duplicate."
    : inspection.conflicts.length > MAX_REVIEWED_DUPLICATES ? TOO_MANY_MATCHES
    : inspection.conflicts.length && !inspection.canReview ? "Another applicant or staff profile uses these contacts. Review the conflicting record before granting access."
    : null;
  const canReview = inspection.canReview && !eligibilityReason;
  const reviewToken = canReview ? issueHiringReviewToken(actor.id, hiringReviewSnapshot(app, offer, profiles, directory, associations)) : null;
  return { ...inspection, canReview, reviewToken, eligible: !eligibilityReason, eligibilityReason,
    directoryMatches: contact.matches.map(directoryView), prospectiveReuse: !contact.blocked && contact.match ? directoryView(contact.match) : null };
}
/** Adding an employee enables login, but never claims their onboarding or training is complete. */
export async function hireSignedApplicant(db: any, applicationId: number, actor: Actor, confirmed?: HiringConfirmation, duplicateReview?: DuplicateReview, expectedDirectory?: DirectoryPreview | null) {
  return withStaffingMutationLock(db, async (tx) => {
    const [app]: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications)
      .where(eq(jobApplications.id, applicationId)).limit(1).for("update");
    if (!app || app.deletedAt) throw new Error("This application is no longer available.");
    if (confirmed && (confirmed.name !== app.name || confirmed.email !== (app.email ?? "")
      || (confirmed.phone ?? "") !== (app.phone ?? "") || confirmed.role !== app.role || confirmed.location !== app.location)) {
      throw new Error("This applicant's contact or assignment changed after you opened confirmation. Refresh and review the current details before enabling login.");
    }
    const directory: Array<typeof employees.$inferSelect> = await tx.select().from(employees).for("update");
    const linked = directory.filter((employee) => employee.sourceApplicationId === app.id);
    const portalAccessLevel = isOperationsManagerRole(app.role) ? "operations_manager" as const : "team_member" as const;
    if (linked.length > 1) throw new Error("Multiple Directory records are linked to this applicant. Review the Directory.");
    if (linked.length === 1) {
      if (linked[0].employmentStatus !== "active" || !app.isTeamMember || app.status !== "onboarded") {
        throw new Error("This person already has an employee record. Manage or restore access from Employee Directory.");
      }
      return { success: true, id: linked[0].id, alreadyAdded: true, grantsApyHqAccess: true, grantsPortalAccess: true, portalAccessLevel };
    }
    if (app.status !== "accepted" || app.isTeamMember || app.onboardingDeliveryToken) {
      throw new Error("Select a signed, accepted applicant with no pending email delivery before adding an employee.");
    }
    const [offer]: Array<typeof signingTokens.$inferSelect> = await tx.select().from(signingTokens)
      .where(eq(signingTokens.applicationId, app.id)).orderBy(desc(signingTokens.createdAt), desc(signingTokens.id)).limit(1).for("update");
    if (!offer || offer.signed !== 1) throw new Error("Wait for the applicant to sign their current Offer Letter and NDA before adding them.");
    if (normalizeApyRole(offer.role) !== normalizeApyRole(app.role) || offer.location !== app.location || offer.applicantEmail.trim().toLowerCase() !== app.email?.trim().toLowerCase()) {
      throw new Error("The current applicant details differ from the signed offer. Review the offer and assignment first.");
    }
    if (!isApprovedApyTeamRole(app.role)) throw new Error("Choose a supported staff role before adding an employee with login access.");
    const email = app.email?.trim().toLowerCase() ?? null;
    const phone = normalizeCanadianPhoneNumber(app.phone ?? "");
    if (!email && !phone) throw new Error("Add a valid email or phone before granting login access.");
    const identity = { ...app, email, phone };
    const { match, blocked } = directoryMatches(identity, directory);
    if (blocked) {
      throw new Error("An existing employee uses these contacts. Review or restore that Directory record rather than creating a duplicate.");
    }
    if (expectedDirectory !== undefined && JSON.stringify(expectedDirectory) !== JSON.stringify(match ? directoryView(match) : null)) {
      throw new Error("The matching Directory record changed. Refresh and review again before granting access.");
    }
    const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications).for("update");
    const associations: Array<typeof employeeApplicationAssociations.$inferSelect> = await tx.select().from(employeeApplicationAssociations).for("update");
    const actions: Array<typeof jobApplicationActions.$inferSelect> = await tx.select().from(jobApplicationActions).where(eq(jobApplicationActions.action, "employee_added_after_signature")).for("update");
    const inspection = inspectHiringDuplicates(app, profiles, directory);
    if (inspection.conflicts.length > MAX_REVIEWED_DUPLICATES) throw new Error(TOO_MANY_MATCHES);
    if (inspection.conflicts.length && !inspection.canReview) {
      throw new Error("Another applicant or staff profile uses these contacts. Review the conflicting record before granting access.");
    }
    const reviewedIds = new Set([app.id, ...inspection.conflicts.map((entry) => entry.id)]);
    if (hasHiringOwnershipClaim(reviewedIds, directory, associations, actions)) {
      throw new Error("This person already has an employee record. Manage or restore access from Employee Directory.");
    }
    const snapshot = hiringReviewSnapshot(app, offer, profiles, directory, associations);
    if (inspection.conflicts.length && (!duplicateReview || duplicateReview.acknowledged !== true
      || !verifyHiringReviewToken(duplicateReview.token, actor.id, snapshot))) {
      throw new Error("Review all matching applications and confirm with a current review token before granting access.");
    }
    if (!inspection.conflicts.length && duplicateReview) throw new Error("The duplicate review is no longer current. Refresh and review again.");
    const [transition] = await tx.update(jobApplications).set({ status: "onboarded", isTeamMember: true, email, phone })
      .where(and(eq(jobApplications.id, app.id), eq(jobApplications.status, "accepted"), eq(jobApplications.isTeamMember, false), isNull(jobApplications.deletedAt), isNull(jobApplications.onboardingDeliveryToken)));
    if (transition.affectedRows !== 1) throw new Error("The applicant changed while being added. Refresh and try again.");
    const values = { sourceApplicationId: app.id, name: app.name, email, phone, role: app.role, location: app.location, employmentStatus: "active" as const, endedAt: null };
    let employeeId = match?.id;
    if (match) await tx.update(employees).set(values).where(eq(employees.id, match.id));
    else {
      const [insert] = await tx.insert(employees).values(values);
      employeeId = Number(insert.insertId);
    }
    if (!employeeId) throw new Error("The employee record could not be created.");
    if (inspection.conflicts.length) {
      const evidence = hiringReviewEvidence(snapshot, employeeId);
      await tx.insert(employeeApplicationAssociations).values([
        { applicationId: app.id, employeeId, canonicalApplicationId: app.id, actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email, recordHash: reviewedHiringRecordHash(app) },
        ...evidence.reviewed.map((entry) => ({ applicationId: entry.applicationId, employeeId, canonicalApplicationId: app.id, actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email, recordHash: entry.recordHash })),
      ]);
    }
    await tx.insert(jobApplicationActions).values({
      applicationId: app.id, action: "employee_added_after_signature", fromStatus: app.status, toStatus: "onboarded",
      actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email,
      details: JSON.stringify({ employeeId, signingTokenId: offer.id, ...(inspection.conflicts.length ? { duplicateReview: hiringReviewEvidence(snapshot, employeeId) } : {}), grantsPortalAccess: true, portalAccessLevel, onboardingDocumentsSent: Boolean(app.onboardingSentAt), trainingCompleted: false }),
    });
    return { success: true, id: employeeId, alreadyAdded: false, ...(match ? { reusedDirectoryRecord: true as const } : {}), grantsApyHqAccess: true, grantsPortalAccess: true, portalAccessLevel };
  });
}
