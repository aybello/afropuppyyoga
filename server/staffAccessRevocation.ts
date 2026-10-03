import { and, eq } from "drizzle-orm";
import { employees, jobApplications, staffInvites, staffPhoneAccessCodes, users } from "../drizzle/schema";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { isActiveTeamMember } from "./teamMembership";
import { validateTeamAssignmentChange } from "./staffRosterPolicy";

/** Call only within withStaffingMutationLock, after the caller's authorization. */
export async function revokeTeamProfileAccess(tx: any, profileId: number, options: {
  isOwner: boolean;
  /** Deactivation retains an archived team profile; removal clears team membership. */
  retainTeamMembership?: boolean;
}) {
  const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications);
  const profile = profiles.find((person) => person.id === profileId);
  if (!profile) throw new Error("The linked APY HQ team profile could not be found.");
  const active = profiles.filter(isActiveTeamMember);
  const managers = active.filter((person) => person.location === profile.location && person.role.toLowerCase().replaceAll("_", " ") === "operations manager");
  const monitors = active.filter((person) => person.location === profile.location && person.role.toLowerCase().replaceAll("_", " ") === "puppy monitor");
  if (isActiveTeamMember(profile)) {
    validateTeamAssignmentChange({
      currentRole: profile.role, currentLocation: profile.location,
      nextRole: "Inactive", nextLocation: profile.location,
      hasOperationsManagerAtNextLocation: managers.some((person) => person.id !== profile.id),
      hasOtherOperationsManagerAtCurrentLocation: managers.some((person) => person.id !== profile.id),
      hasActivePuppyMonitorsAtCurrentLocation: monitors.length > 0,
      activePuppyMonitorCountAtCurrentLocation: monitors.length,
      isOwner: options.isOwner,
    });
    // Revocation is immediate. Saved assignments remain as history; current
    // staffing views exclude inactive profiles so staffing gaps are visible.
  }
  const invites: Array<{ email: string }> = await tx.select({ email: staffInvites.email }).from(staffInvites)
    .where(eq(staffInvites.applicationId, profile.id));
  const identityEmails = new Set([...invites.map((invite) => invite.email), profile.email ?? ""]
    .map((email) => email.trim().toLowerCase()).filter(Boolean));
  const removedAt = new Date();
  await tx.update(jobApplications).set({ isTeamMember: options.retainTeamMembership ?? false, deletedAt: removedAt })
    .where(eq(jobApplications.id, profile.id));
  await tx.update(employees).set({ employmentStatus: "inactive", endedAt: removedAt })
    .where(eq(employees.sourceApplicationId, profile.id));
  await tx.update(staffInvites).set({ isActive: 0 }).where(eq(staffInvites.applicationId, profile.id));
  for (const email of Array.from(identityEmails)) {
    await tx.update(users).set({ role: "user" }).where(and(eq(users.openId, `staff:${email}`), eq(users.role, "staff")));
    await tx.update(users).set({ role: "user" }).where(and(eq(users.email, email), eq(users.role, "staff")));
  }
  const phone = normalizeCanadianPhoneNumber(profile.phone ?? "");
  const sharedPhone = phone && active.some((person) => person.id !== profile.id && normalizeCanadianPhoneNumber(person.phone ?? "") === phone);
  if (phone && !sharedPhone) {
    await tx.delete(staffPhoneAccessCodes).where(eq(staffPhoneAccessCodes.phone, phone));
    await tx.update(users).set({ role: "user" }).where(and(eq(users.openId, `staff-phone:${phone}`), eq(users.role, "staff")));
  }
  return { success: true, portalAccessRevoked: true };
}
