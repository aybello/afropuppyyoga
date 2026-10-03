import { eq } from "drizzle-orm";
import { employees, jobApplicationActions, jobApplications } from "../drizzle/schema";
import { getEmployeeLoginDetails } from "./employeeLoginDetails";
import { normalizeCanadianPhoneNumber } from "../shared/phone";

/** Explicit employee activation, inside the shared staffing transaction lock. */
export async function activateEmployeeWithAccess(tx: any, employeeId: number, actor: {
  id: number;
  name: string | null;
  email: string | null;
}, _isOwner: boolean) {
  const [employee]: Array<typeof employees.$inferSelect> = await tx.select().from(employees)
    .where(eq(employees.id, employeeId)).limit(1);
  if (!employee) throw new Error("Employee record not found.");
  const { role, location, email, phone } = getEmployeeLoginDetails(employee);
  const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications);
  const directory: Array<typeof employees.$inferSelect> = await tx.select().from(employees);
  const matchesContact = (person: { email: string | null; phone: string | null }) => (
    Boolean(email && person.email?.trim().toLowerCase() === email)
    || Boolean(phone && normalizeCanadianPhoneNumber(person.phone ?? "") === phone)
  );
  if (directory.some((person) => person.id !== employee.id && matchesContact(person))) {
    throw new Error("Another Employee Directory record uses this contact. Update or restore that record instead of creating a duplicate login.");
  }
  let profile = employee.sourceApplicationId === null ? undefined : profiles.find((person) => person.id === employee.sourceApplicationId);
  if (employee.sourceApplicationId !== null && !profile) {
    throw new Error("The linked APY HQ profile could not be found. Review the employee record before activating it.");
  }
  const contactMatches = profiles.filter(matchesContact);
  if (!profile && contactMatches.length === 1) {
    const existing = contactMatches[0];
    // Reuse an existing employee identity, including a deactivated one. Never
    // use this action to bypass a new applicant's onboarding documents.
    if (existing.status !== "onboarded") {
      throw new Error("This contact belongs to an applicant. Complete their onboarding through the applicant record before linking employee access.");
    }
    if (directory.some((person) => person.id !== employee.id && person.sourceApplicationId === existing.id)) {
      throw new Error("The matching APY HQ profile is already linked to another employee.");
    }
    profile = existing;
  }
  if (contactMatches.some((person) => person.id !== profile?.id)) {
    throw new Error("Another applicant or staff profile uses this contact. Link or correct that record before activating login.");
  }
  if (profile && directory.some((person) => person.id !== employee.id && person.sourceApplicationId === profile.id)) {
    throw new Error("The matching APY HQ profile is already linked to another employee.");
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
    details: JSON.stringify({ employmentActivated: true, grantsApyHqAccess: true }),
  });
  // Revoked/expired invite links are not revived. Staff can request a fresh
  // email link or verify their saved phone through the existing login flow.
  return { success: true, sourceApplicationId, grantsApyHqAccess: true };
}
