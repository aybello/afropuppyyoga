import { eq } from "drizzle-orm";
import { employees, jobApplicationActions, jobApplications, staffInvites } from "../drizzle/schema";
import { getEmployeeLoginDetails } from "./employeeLoginDetails";
import { resolveEmployeeLoginProfile } from "./employeeProfileResolution";
import { revokeTeamProfileAccess } from "./staffAccessRevocation";
import { isActiveTeamMember } from "./teamMembership";

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
  const { canonical: profile, duplicates } = resolveEmployeeLoginProfile({ ...employee, email, phone }, profiles, directory);
  for (const duplicate of duplicates) {
    // Preserve applicant/signing history. Only the redundant login capability
    // is retired, and active duplicate duties follow the existing safe path.
    if (isActiveTeamMember(duplicate)) {
      await revokeTeamProfileAccess(tx, duplicate.id, { isOwner: _isOwner, actor });
    } else {
      await tx.update(jobApplications).set({ isTeamMember: false }).where(eq(jobApplications.id, duplicate.id));
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
