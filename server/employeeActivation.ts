import { eq } from "drizzle-orm";
import { employees, jobApplicationActions, jobApplications } from "../drizzle/schema";
import { isApprovedApyTeamRole } from "../shared/apyPermissions";
import { normalizeCanadianPhoneNumber } from "../shared/phone";

/** Explicit employee activation, inside the shared staffing transaction lock. */
export async function activateEmployeeWithAccess(tx: any, employeeId: number, actor: {
  id: number;
  name: string | null;
  email: string | null;
}, isOwner: boolean) {
  const [employee]: Array<typeof employees.$inferSelect> = await tx.select().from(employees)
    .where(eq(employees.id, employeeId)).limit(1);
  if (!employee) throw new Error("Employee record not found.");
  if (!isApprovedApyTeamRole(employee.role)) throw new Error("Choose a supported employee role before activating access.");
  const email = employee.email?.trim().toLowerCase() || null;
  const phone = normalizeCanadianPhoneNumber(employee.phone ?? "");
  if (!email && !phone) throw new Error("Add a valid email address or phone number before activating login.");
  const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications);
  let profile = employee.sourceApplicationId === null ? undefined : profiles.find((person) => person.id === employee.sourceApplicationId);
  if (employee.sourceApplicationId !== null && !profile) throw new Error("The linked APY HQ profile could not be found. Review the employee record before activating it.");
  const contactMatches = profiles.filter((person) => (
    Boolean(email && person.email?.trim().toLowerCase() === email)
    || Boolean(phone && normalizeCanadianPhoneNumber(person.phone ?? "") === phone)
  ));
  if (contactMatches.some((person) => person.id !== profile?.id)) {
    throw new Error("Another applicant or staff profile uses this contact. Link or correct that record before activating login.");
  }
  const values = { name: employee.name, email, phone, role: employee.role, location: employee.location,
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
  // Revoked/expired invite links are not revived. A fresh link or saved-phone
  // verification is used for the next login.
  return { success: true, sourceApplicationId, grantsApyHqAccess: true };
}
