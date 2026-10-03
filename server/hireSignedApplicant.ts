import { and, desc, eq, isNull } from "drizzle-orm";
import { employees, jobApplicationActions, jobApplications, signingTokens } from "../drizzle/schema";
import { isApprovedApyTeamRole, isOperationsManagerRole, normalizeApyRole } from "../shared/apyPermissions";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { employeeContactsMatch } from "./employeeProfileResolution";
import { withStaffingMutationLock } from "./staffingMutationLock";

type Actor = { id: number; name: string | null; email: string | null };
/** Adding an employee enables login, but never claims their onboarding or training is complete. */
export async function hireSignedApplicant(db: any, applicationId: number, actor: Actor) {
  return withStaffingMutationLock(db, async (tx) => {
    const [app]: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications)
      .where(eq(jobApplications.id, applicationId)).limit(1);
    if (!app || app.deletedAt) throw new Error("This application is no longer available.");
    const directory: Array<typeof employees.$inferSelect> = await tx.select().from(employees);
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
      .where(eq(signingTokens.applicationId, app.id)).orderBy(desc(signingTokens.createdAt), desc(signingTokens.id)).limit(1);
    if (!offer || offer.signed !== 1) throw new Error("Wait for the applicant to sign their current Offer Letter and NDA before adding them.");
    if (normalizeApyRole(offer.role) !== normalizeApyRole(app.role) || offer.location !== app.location || offer.applicantEmail.trim().toLowerCase() !== app.email?.trim().toLowerCase()) {
      throw new Error("The current applicant details differ from the signed offer. Review the offer and assignment first.");
    }
    if (!isApprovedApyTeamRole(app.role)) throw new Error("Choose a supported staff role before adding an employee with login access.");
    const email = app.email?.trim().toLowerCase() ?? null;
    const phone = normalizeCanadianPhoneNumber(app.phone ?? "");
    if (!email && !phone) throw new Error("Add a valid email or phone before granting login access.");
    const identity = { ...app, email, phone };
    const matches = directory.filter((employee) => employeeContactsMatch(identity, employee));
    const match = matches[0];
    const normalizeName = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    if (matches.length > 1 || (match && (match.sourceApplicationId !== null || match.employmentStatus !== "active" || normalizeName(match.name) !== normalizeName(app.name)
      || (match.email && email && match.email.trim().toLowerCase() !== email)
      || (match.phone && phone && normalizeCanadianPhoneNumber(match.phone) !== phone)))) {
      throw new Error("An existing employee uses these contacts. Review or restore that Directory record rather than creating a duplicate.");
    }
    const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications);
    if (profiles.some((profile) => profile.id !== app.id && profile.deletedAt == null && employeeContactsMatch(identity, profile))) {
      throw new Error("Another applicant or staff profile uses these contacts. Review the conflicting record before granting access.");
    }
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
    await tx.insert(jobApplicationActions).values({
      applicationId: app.id, action: "employee_added_after_signature", fromStatus: app.status, toStatus: "onboarded",
      actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email,
      details: JSON.stringify({ employeeId, signingTokenId: offer.id, grantsPortalAccess: true, portalAccessLevel, onboardingDocumentsSent: Boolean(app.onboardingSentAt), trainingCompleted: false }),
    });
    return { success: true, id: employeeId, alreadyAdded: false, grantsApyHqAccess: true, grantsPortalAccess: true, portalAccessLevel };
  });
}
