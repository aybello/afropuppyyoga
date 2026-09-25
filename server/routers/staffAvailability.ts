import { z } from "zod";
import { adminProcedure, staffProcedure, router } from "../_core/trpc";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { classStaffAssignments, employees, jobApplicationActions, jobApplications, signingTokens, staffAvailability, staffInvites, weekendLeadershipCoverage } from "../../drizzle/schema";
import { and, asc, desc, eq, gte, inArray, isNull, isNotNull } from "drizzle-orm";
import { getUpcomingWeekendDates, isAwayOnDate, isWeekendDate } from "../weekendCoverage";
import { isActiveTeamMember } from "../teamMembership";
import { normalizeCanadianPhoneNumber } from "../../shared/phone";
import { APY_TEAM_LOCATIONS, APY_TEAM_ROLES, isApprovedApyTeamRole, isCentralApyTeamRole, isOperationsManagerRole, normalizeApyRole } from "../../shared/apyPermissions";
import { getPuppyMonitorLocationCoverage } from "../../shared/puppyMonitorLocationCoverage";

export const directTeamMemberSchema = z.object({
  name: z.string().trim().min(2, "Enter the team member's full name."),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")).default(""),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(APY_TEAM_ROLES),
  location: z.enum(APY_TEAM_LOCATIONS),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Add either an email address or phone number." });
  }
  if (value.phone && !normalizeCanadianPhoneNumber(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Canadian phone number." });
  }
  if (isCentralApyTeamRole(value.role) && value.location !== "CENTRAL") {
    ctx.addIssue({ code: "custom", path: ["location"], message: "BDR and Social Media Specialist roles are APY-wide." });
  }
});

export const teamMemberProfileUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2, "Enter the team member's full name."),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")).default(""),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(APY_TEAM_ROLES),
  location: z.enum(APY_TEAM_LOCATIONS),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Add either an email address or phone number." });
  }
  if (value.phone && !normalizeCanadianPhoneNumber(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Canadian phone number." });
  }
  if (isCentralApyTeamRole(value.role) && value.location !== "CENTRAL") {
    ctx.addIssue({ code: "custom", path: ["location"], message: "BDR and Social Media Specialist roles are APY-wide." });
  }
});

export const teamMemberActivitySchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

export const employeeRecordUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2, "Enter the employee's full name."),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")).default(""),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(APY_TEAM_ROLES),
  location: z.enum(APY_TEAM_LOCATIONS),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Add either an email address or phone number." });
  }
  if (value.phone && !normalizeCanadianPhoneNumber(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Canadian phone number." });
  }
  if (isCentralApyTeamRole(value.role) && value.location !== "CENTRAL") {
    ctx.addIssue({ code: "custom", path: ["location"], message: "BDR and Social Media Specialist roles are APY-wide." });
  }
});

/** An owner-created employee record also provisions the matching APY HQ profile and role-based access. */
export const directEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Enter the employee's full name."),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")).default(""),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(APY_TEAM_ROLES),
  location: z.enum(APY_TEAM_LOCATIONS),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid start date."),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Add either an email address or phone number." });
  }
  if (value.phone && !normalizeCanadianPhoneNumber(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Canadian phone number." });
  }
  if (isCentralApyTeamRole(value.role) && value.location !== "CENTRAL") {
    ctx.addIssue({ code: "custom", path: ["location"], message: "BDR and Social Media Specialist roles are APY-wide." });
  }
});

export const isPuppyMonitorRole = (role: string | null | undefined) => normalizeApyRole(role) === "puppy monitor";

/** Directory employment is the source of truth for active location coverage. */
export function hasActiveOperationsManagerAtLocation(
  employeesAtLocation: Array<{ role: string; location: string; employmentStatus: string; endedAt: Date | null }>,
  location: string,
) {
  return employeesAtLocation.some((employee) => (
    employee.location === location
    && employee.employmentStatus === "active"
    && employee.endedAt === null
    && isOperationsManagerRole(employee.role)
  ));
}

export function getOperationsManagerDepartureEligibility(input: {
  employeeId: number;
  employeeRole: string;
  activeLocationEmployees: Array<{ id: number; role: string }>;
}) {
  if (!isOperationsManagerRole(input.employeeRole)) return { eligible: true as const };
  const hasOtherOperationsManager = input.activeLocationEmployees.some((person) => person.id !== input.employeeId && isOperationsManagerRole(person.role));
  const hasActivePuppyMonitor = input.activeLocationEmployees.some((person) => isPuppyMonitorRole(person.role));
  if (hasActivePuppyMonitor && !hasOtherOperationsManager) {
    return { eligible: false as const, reason: "Assign another active Operations Manager before ending employment for this location's sole Operations Manager." };
  }
  return { eligible: true as const };
}

export function getTeamRemovalUpdate(removedAt: Date) {
  return { isTeamMember: false, deletedAt: removedAt };
}

export function getEmployeeDepartureUpdate(endedAt: Date) {
  return { employmentStatus: "inactive" as const, endedAt };
}

/** Re-establishes directory-only employment without granting APY HQ or portal access. */
export function getEmployeeReactivationUpdate() {
  return { employmentStatus: "active" as const, endedAt: null };
}

export function hasActiveApyHqAccess(profile: { isTeamMember: boolean | number | null; deletedAt: Date | null } | undefined) {
  return Boolean(profile?.isTeamMember) && profile?.deletedAt == null;
}

/** Confirms that a directory-only employee has no separate active APY HQ profile by contact. */
export function hasMatchingActiveTeamContact(
  employee: { email: string | null; phone: string | null },
  activeTeamContacts: Array<{ email: string | null; phone: string | null }>,
) {
  const employeeEmail = employee.email?.trim().toLowerCase() ?? "";
  const employeePhone = normalizeCanadianPhoneNumber(employee.phone ?? "");
  return activeTeamContacts.some((profile) => {
    const profileEmail = profile.email?.trim().toLowerCase() ?? "";
    const profilePhone = normalizeCanadianPhoneNumber(profile.phone ?? "");
    return Boolean((employeeEmail && employeeEmail === profileEmail) || (employeePhone && employeePhone === profilePhone));
  });
}

export function getEmployeeEmploymentReactivationEligibility(input: { employmentStatus: "active" | "inactive"; hasApyHqAccess: boolean }) {
  if (input.employmentStatus !== "inactive") {
    return { eligible: false as const, reason: "Only inactive employee records can be reactivated." };
  }
  if (input.hasApyHqAccess) {
    return { eligible: false as const, reason: "Remove this person from APY HQ Team first so employment can be restored without leaving staff access active." };
  }
  return { eligible: true as const };
}

export function getFormerEmployeeDeletionEligibility(input: { employmentStatus: string; linkedActiveTeamProfile: boolean }) {
  if (input.employmentStatus !== "inactive") {
    return { eligible: false as const, reason: "Only former or removed Employee Directory records can be deleted permanently." };
  }
  if (input.linkedActiveTeamProfile) {
    return { eligible: false as const, reason: "Remove this person from APY HQ Team first so staffing coverage and portal access are handled safely." };
  }
  return { eligible: true as const };
}

export function getOnboardedApplicantDirectoryEligibility(input: { status: string; onboardingSentAt: Date | null; signingComplete: boolean; existingEmployee: boolean }) {
  if (input.status !== "accepted") {
    return { eligible: false as const, reason: "Only Accepted applicants can complete onboarding into the Employee Directory." };
  }
  if (!input.onboardingSentAt) {
    return { eligible: false as const, reason: "Send the onboarding documents before marking this applicant onboarded." };
  }
  if (!input.signingComplete) {
    return { eligible: false as const, reason: "Wait for the applicant to sign their Offer Letter and NDA before marking them onboarded." };
  }
  if (input.existingEmployee) {
    return { eligible: false as const, reason: "This applicant already has an Employee Directory record." };
  }
  return { eligible: true as const };
}

/**
 * Portal access is granted only in an explicit owner-approved new-hire or
 * direct-employee flow. Historic directory records never receive an implicit
 * grant from this helper.
 */
export function getApprovedNewHirePortalAccessPlan(input: Pick<z.infer<typeof directEmployeeSchema>, "role"> | { role: string }) {
  const portalAccessLevel = !isApprovedApyTeamRole(input.role)
    ? "none"
    : isOperationsManagerRole(input.role)
      ? "operations_manager"
      : "team_member";
  return {
    employmentStatus: "active" as const,
    applicationStatus: "onboarded" as const,
    isTeamMember: portalAccessLevel !== "none",
    grantsApyHqAccess: portalAccessLevel !== "none",
    grantsPortalAccess: portalAccessLevel !== "none",
    portalAccessLevel,
  };
}

/** @deprecated Use getApprovedNewHirePortalAccessPlan for explicit new-hire grants. */
export function getAutomaticEmployeeAccessPlan(input: Pick<z.infer<typeof directEmployeeSchema>, "role"> | { role: string }) {
  return getApprovedNewHirePortalAccessPlan(input);
}

/** Reject a transition if the role or location changed after staff opened the applicant record. */
export function hasSameOnboardingAssignment(
  expected: { role: string; location: string },
  current: { role: string; location: string },
) {
  return expected.role === current.role && expected.location === current.location;
}

export function getExistingEmployeeAccessProvisioningEligibility(input: { employmentStatus: string; sourceApplicationId: number | null }) {
  if (input.employmentStatus !== "active") {
    return { eligible: false as const, reason: "Only active employees can be given APY HQ access." };
  }
  if (input.sourceApplicationId !== null) {
    return { eligible: false as const, reason: "This employee already has an APY HQ profile." };
  }
  return { eligible: true as const };
}

export function getLegacyEmployeeProfileLinkEligibility(input: {
  matchingProfileCount: number;
  matchingProfileIsActiveTeamMember: boolean;
  matchingProfileIsArchived: boolean;
  matchingProfileStatus: string;
  roleMatches: boolean;
  locationMatches: boolean;
  alreadyLinkedToAnotherEmployee: boolean;
}) {
  if (input.matchingProfileCount === 0) return { eligible: true as const, action: "create_profile" as const };
  if (input.matchingProfileCount !== 1) {
    return { eligible: false as const, reason: "More than one applicant or APY HQ profile matches this employee. Resolve the duplicate profiles before granting access." };
  }
  if (input.alreadyLinkedToAnotherEmployee) {
    return { eligible: false as const, reason: "The matching APY HQ profile is already linked to another Employee Directory record." };
  }
  if (input.matchingProfileIsActiveTeamMember) {
    return { eligible: false as const, reason: "The matching APY HQ profile is already active. Refresh the Employee Directory before trying again." };
  }
  if (input.matchingProfileIsArchived) {
    return { eligible: false as const, reason: "The matching applicant or APY HQ profile is archived. Restore or review that profile before granting access." };
  }
  if (input.matchingProfileStatus !== "onboarded") {
    return { eligible: false as const, reason: "The matching applicant must be onboarding-complete before APY HQ access can be granted." };
  }
  if (!input.roleMatches || !input.locationMatches) {
    return { eligible: false as const, reason: "The matching profile has a different role or location. Review it before granting APY HQ access." };
  }
  return { eligible: true as const, action: "link_existing_profile" as const };
}

export function getDirectEmployeeContactEligibility(input: { hasEmployeeRecord: boolean; hasApplicantOrApyProfile: boolean }) {
  if (input.hasEmployeeRecord) {
    return { eligible: false as const, reason: "An Employee Directory record already uses this email address or phone number. Update or restore that record instead of creating a duplicate." };
  }
  if (input.hasApplicantOrApyProfile) {
    return { eligible: false as const, reason: "An existing applicant or APY HQ profile already uses this email address or phone number. Use that record instead of creating a duplicate." };
  }
  return { eligible: true as const };
}

export function getOnboardedApplicantContactMatchEligibility(input: {
  matchingEmployeeCount: number;
  matchingEmployeeSourceApplicationId: number | null;
}) {
  if (input.matchingEmployeeCount > 1) {
    return { eligible: false as const, reason: "Multiple Employee Directory records match this applicant. Resolve the duplicate records before adding them." };
  }
  if (input.matchingEmployeeCount === 1 && input.matchingEmployeeSourceApplicationId !== null) {
    return { eligible: false as const, reason: "An active Employee Directory record is already linked to another application using this contact information." };
  }
  return { eligible: true as const };
}

export function validateTeamAssignmentChange(input: {
  currentRole: string;
  currentLocation: string;
  nextRole: string;
  nextLocation: string;
  hasOperationsManagerAtNextLocation: boolean;
  hasOtherOperationsManagerAtCurrentLocation: boolean;
  hasActivePuppyMonitorsAtCurrentLocation: boolean;
  activePuppyMonitorCountAtCurrentLocation?: number;
}) {
  if (input.nextRole === "Puppy Monitor" && !input.hasOperationsManagerAtNextLocation) {
    throw new Error("Add or retain an Operations Manager at this location before assigning Puppy Monitors.");
  }
  const movesOperationsManager = isOperationsManagerRole(input.currentRole)
    && (input.nextRole !== "Operations Manager" || input.nextLocation !== input.currentLocation);
  if (movesOperationsManager && input.hasActivePuppyMonitorsAtCurrentLocation && !input.hasOtherOperationsManagerAtCurrentLocation) {
    throw new Error("Assign another Operations Manager to this Puppy Monitor location before changing this team member.");
  }
  const movesOrChangesPuppyMonitor = isPuppyMonitorRole(input.currentRole)
    && (!isPuppyMonitorRole(input.nextRole) || input.nextLocation !== input.currentLocation);
  const remainingPuppyMonitorCount = Math.max(0, (input.activePuppyMonitorCountAtCurrentLocation ?? 0) - (movesOrChangesPuppyMonitor ? 1 : 0));
  const puppyMonitorCoverage = getPuppyMonitorLocationCoverage(remainingPuppyMonitorCount);
  if (movesOrChangesPuppyMonitor && !puppyMonitorCoverage.meetsMinimum) {
    throw new Error(`Keep at least ${puppyMonitorCoverage.minimum} active Puppy Monitors at ${input.currentLocation} before moving, changing role, or removing this person.`);
  }
}

export function validateEmployeeDirectoryAssignmentChange(input: {
  linkedActiveTeamProfile: boolean;
  currentRole: string;
  currentLocation: string;
  nextRole: string;
  nextLocation: string;
  hasOperationsManagerAtNextLocation: boolean;
  hasOtherOperationsManagerAtCurrentLocation: boolean;
  hasActivePuppyMonitorsAtCurrentLocation: boolean;
  activePuppyMonitorCountAtCurrentLocation?: number;
}) {
  if (!input.linkedActiveTeamProfile) return;
  validateTeamAssignmentChange(input);
}

export const staffAvailabilityRouter = router({
  // Get only people manually added to APY HQ with their current availability status.
  getOrgChart: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const staffFields = {
      id: jobApplications.id,
      name: jobApplications.name,
      email: jobApplications.email,
      phone: jobApplications.phone,
      role: jobApplications.role,
      location: jobApplications.location,
      appStatus: jobApplications.status,
      archivedAt: jobApplications.deletedAt,
    };
    const today = new Date().toISOString().split("T")[0];
    const [staff, inactiveStaff, leaves] = await Promise.all([
      db.select(staffFields).from(jobApplications).where(
        and(isNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, true))
      ).orderBy(jobApplications.role, jobApplications.location),
      db.select(staffFields).from(jobApplications).where(
        and(isNotNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, true))
      ).orderBy(jobApplications.role, jobApplications.location),
      db.select().from(staffAvailability).where(gte(staffAvailability.endDate, today)).orderBy(desc(staffAvailability.createdAt)),
    ]);

    return { staff, inactiveStaff, leaves };
  }),

  // APY's operational directory for active and former employees.
  listEmployees: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const directory = await db.select().from(employees)
      .orderBy(asc(employees.employmentStatus), asc(employees.location), asc(employees.name));
    const linkedProfileIds = directory
      .map((employee) => employee.sourceApplicationId)
      .filter((id): id is number => id !== null);
    const profiles = linkedProfileIds.length === 0
      ? []
      : await db.select({
        id: jobApplications.id,
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      }).from(jobApplications).where(inArray(jobApplications.id, linkedProfileIds));
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    return directory.map((employee) => ({
      ...employee,
      hasApyHqAccess: employee.sourceApplicationId === null
        ? false
        : hasActiveApyHqAccess(profilesById.get(employee.sourceApplicationId)),
    }));
  }),

  // Update directory contact and assignment details. Linked APY HQ profiles stay synchronized.
  updateEmployeeRecord: adminProcedure
    .input(employeeRecordUpdateSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [employee] = await db.select().from(employees)
        .where(eq(employees.id, input.id))
        .limit(1);
      if (!employee) throw new Error("Employee record not found.");

      if (employee.employmentStatus === "active" && employee.endedAt === null) {
        const [employeesAtTarget, employeesAtCurrentLocation] = await Promise.all([
          db.select({ id: employees.id, role: employees.role, location: employees.location, employmentStatus: employees.employmentStatus, endedAt: employees.endedAt })
            .from(employees)
            .where(and(eq(employees.location, input.location), eq(employees.employmentStatus, "active"), isNull(employees.endedAt))),
          db.select({ id: employees.id, role: employees.role, location: employees.location, employmentStatus: employees.employmentStatus, endedAt: employees.endedAt })
            .from(employees)
            .where(and(eq(employees.location, employee.location), eq(employees.employmentStatus, "active"), isNull(employees.endedAt))),
        ]);
        const activePuppyMonitorsAtCurrentLocation = employeesAtCurrentLocation.filter((person) => isPuppyMonitorRole(person.role));
        validateTeamAssignmentChange({
          currentRole: employee.role,
          currentLocation: employee.location,
          nextRole: input.role,
          nextLocation: input.location,
          hasOperationsManagerAtNextLocation: hasActiveOperationsManagerAtLocation(employeesAtTarget, input.location)
            || isOperationsManagerRole(input.role),
          hasOtherOperationsManagerAtCurrentLocation: employeesAtCurrentLocation.some((person) => person.id !== employee.id && isOperationsManagerRole(person.role)),
          hasActivePuppyMonitorsAtCurrentLocation: activePuppyMonitorsAtCurrentLocation.length > 0,
          activePuppyMonitorCountAtCurrentLocation: activePuppyMonitorsAtCurrentLocation.length,
        });
      }

      const email = input.email ? input.email.toLowerCase() : null;
      const phone = input.phone ? normalizeCanadianPhoneNumber(input.phone) : null;
      const updates = {
        name: input.name,
        email,
        phone,
        role: input.role,
        location: input.location,
      };

      await db.transaction(async (tx) => {
        await tx.update(employees).set(updates).where(eq(employees.id, employee.id));
        if (employee.sourceApplicationId !== null) {
          await tx.update(jobApplications).set(updates)
            .where(eq(jobApplications.id, employee.sourceApplicationId));
        }
      });

      return { success: true };
    }),

  // Owner-created employees receive a matching active APY HQ profile and role-based access.
  createEmployeeRecord: adminProcedure
    .input(directEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const email = input.email ? input.email.toLowerCase() : null;
      const phone = input.phone ? normalizeCanadianPhoneNumber(input.phone) : null;
      const [emailMatch, phoneMatch] = await Promise.all([
        email
          ? db.select({ id: employees.id }).from(employees).where(eq(employees.email, email)).limit(1)
          : Promise.resolve([]),
        phone
          ? db.select({ id: employees.id }).from(employees).where(eq(employees.phone, phone)).limit(1)
          : Promise.resolve([]),
      ]);
      const [emailProfileMatch, phoneProfileMatch] = await Promise.all([
        email ? db.select({ id: jobApplications.id }).from(jobApplications).where(eq(jobApplications.email, email)).limit(1) : Promise.resolve([]),
        phone ? db.select({ id: jobApplications.id }).from(jobApplications).where(eq(jobApplications.phone, phone)).limit(1) : Promise.resolve([]),
      ]);
      const contactEligibility = getDirectEmployeeContactEligibility({
        hasEmployeeRecord: Boolean(emailMatch[0] || phoneMatch[0]),
        hasApplicantOrApyProfile: Boolean(emailProfileMatch[0] || phoneProfileMatch[0]),
      });
      if (!contactEligibility.eligible) throw new Error(contactEligibility.reason);

      if (isPuppyMonitorRole(input.role)) {
        const operationsManagers = await db.select({
          role: employees.role,
          location: employees.location,
          employmentStatus: employees.employmentStatus,
          endedAt: employees.endedAt,
        }).from(employees).where(and(
          eq(employees.location, input.location),
          eq(employees.employmentStatus, "active"),
          isNull(employees.endedAt),
        ));
        if (!hasActiveOperationsManagerAtLocation(operationsManagers, input.location)) {
          throw new Error("Add an active Operations Manager to this location before adding Puppy Monitors.");
        }
      }

      const plan = getApprovedNewHirePortalAccessPlan(input);
      const employeeId = await db.transaction(async (tx) => {
        const profileResult = await tx.insert(jobApplications).values({
          name: input.name,
          email,
          phone,
          role: input.role,
          location: input.location,
          whyAPY: "Added directly through Employee Directory.",
          experience: "",
          status: plan.applicationStatus,
          isTeamMember: plan.isTeamMember,
        });
        const sourceApplicationId = Number(profileResult[0].insertId);
        const employeeResult = await tx.insert(employees).values({
          sourceApplicationId,
          name: input.name,
          email,
          phone,
          role: input.role,
          location: input.location,
          employmentStatus: plan.employmentStatus,
          startedAt: new Date(`${input.startedAt}T12:00:00`),
        });
        await tx.insert(jobApplicationActions).values({
          applicationId: sourceApplicationId,
          action: "employee_directory_and_apy_hq_created",
          toStatus: plan.applicationStatus,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name,
          actorEmail: ctx.user.email,
          details: JSON.stringify({ grantsApyHqAccess: true, source: "employee_directory" }),
        });
        return Number(employeeResult[0].insertId);
      });
      return { success: true, id: employeeId, grantsApyHqAccess: true };
    }),

  // Complete employment onboarding by adding the verified applicant to the
  // Employee Directory and granting the portal access approved for their role.
  markOnboardedAndAddToEmployeeDirectory: adminProcedure
    .input(z.object({ applicationId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [applicant] = await db.select({
        id: jobApplications.id,
        name: jobApplications.name,
        email: jobApplications.email,
        phone: jobApplications.phone,
        role: jobApplications.role,
        location: jobApplications.location,
        status: jobApplications.status,
        onboardingSentAt: jobApplications.onboardingSentAt,
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      }).from(jobApplications).where(eq(jobApplications.id, input.applicationId)).limit(1);
      if (!applicant || applicant.deletedAt) throw new Error("This application is no longer available.");

      const [existingForApplication] = await db.select({ id: employees.id }).from(employees)
        .where(eq(employees.sourceApplicationId, applicant.id)).limit(1);
      const [signedAgreement] = await db.select({ id: signingTokens.id }).from(signingTokens)
        .where(and(eq(signingTokens.applicationId, applicant.id), eq(signingTokens.signed, 1)))
        .orderBy(desc(signingTokens.signedAt))
        .limit(1);
      const eligibility = getOnboardedApplicantDirectoryEligibility({
        status: applicant.status,
        onboardingSentAt: applicant.onboardingSentAt,
        signingComplete: Boolean(signedAgreement),
        existingEmployee: Boolean(existingForApplication),
      });
      if (!eligibility.eligible) throw new Error(eligibility.reason);

      const transfer = await db.transaction(async (tx) => {
        // Re-read the entire record in the same transaction that changes it.
        // The initial read only informs the dashboard; it must never determine
        // portal access, location coverage, or directory contents.
        const [currentApplicant] = await tx.select({
          id: jobApplications.id,
          name: jobApplications.name,
          email: jobApplications.email,
          phone: jobApplications.phone,
          role: jobApplications.role,
          location: jobApplications.location,
          status: jobApplications.status,
          onboardingSentAt: jobApplications.onboardingSentAt,
          onboardingDeliveryToken: jobApplications.onboardingDeliveryToken,
          isTeamMember: jobApplications.isTeamMember,
          deletedAt: jobApplications.deletedAt,
        }).from(jobApplications).where(eq(jobApplications.id, applicant.id)).limit(1);
        if (!currentApplicant || currentApplicant.deletedAt) {
          throw new Error("This application is no longer available.");
        }
        if (!hasSameOnboardingAssignment(applicant, currentApplicant)) {
          throw new Error("This applicant's role or location changed before employment onboarding could be completed. Reload and confirm the current assignment.");
        }

        // A historical signature cannot qualify a newly reissued unsigned offer.
        const [currentSigning] = await tx.select({ signed: signingTokens.signed })
          .from(signingTokens)
          .where(eq(signingTokens.applicationId, currentApplicant.id))
          .orderBy(desc(signingTokens.createdAt), desc(signingTokens.id))
          .limit(1);
        const [existingForApplication] = await tx.select({ id: employees.id }).from(employees)
          .where(eq(employees.sourceApplicationId, currentApplicant.id)).limit(1);
        const currentEligibility = getOnboardedApplicantDirectoryEligibility({
          status: currentApplicant.status,
          onboardingSentAt: currentApplicant.onboardingSentAt,
          signingComplete: currentSigning?.signed === 1,
          existingEmployee: Boolean(existingForApplication),
        });
        if (!currentEligibility.eligible) throw new Error(currentEligibility.reason);
        if (currentApplicant.isTeamMember || currentApplicant.onboardingDeliveryToken) {
          throw new Error("This applicant changed before employment onboarding could be completed. Reload and confirm the current status.");
        }

        const email = currentApplicant.email?.toLowerCase() ?? null;
        const phone = currentApplicant.phone ? normalizeCanadianPhoneNumber(currentApplicant.phone) : null;
        const [emailMatches, phoneMatches] = await Promise.all([
          email ? tx.select().from(employees).where(eq(employees.email, email)) : Promise.resolve([]),
          phone ? tx.select().from(employees).where(eq(employees.phone, phone)) : Promise.resolve([]),
        ]);
        const matchingEmployees = Array.from(new Map([...emailMatches, ...phoneMatches].map((employee) => [employee.id, employee])).values());
        const matchingEmployee = matchingEmployees[0];
        const contactEligibility = getOnboardedApplicantContactMatchEligibility({
          matchingEmployeeCount: matchingEmployees.length,
          matchingEmployeeSourceApplicationId: matchingEmployee?.sourceApplicationId ?? null,
        });
        if (!contactEligibility.eligible) throw new Error(contactEligibility.reason);

        const accessPlan = getApprovedNewHirePortalAccessPlan({ role: currentApplicant.role });
        const activeTeamContacts = await tx.select({ email: jobApplications.email, phone: jobApplications.phone })
          .from(jobApplications)
          .where(and(eq(jobApplications.isTeamMember, true), isNull(jobApplications.deletedAt)));
        if (hasMatchingActiveTeamContact({ email, phone }, activeTeamContacts)) {
          throw new Error("Remove the matching active APY HQ profile first. New-hire portal access cannot duplicate an existing staff profile.");
        }
        if (accessPlan.grantsPortalAccess && isPuppyMonitorRole(currentApplicant.role)) {
          const operationsManagers = await tx.select({
            role: employees.role,
            location: employees.location,
            employmentStatus: employees.employmentStatus,
            endedAt: employees.endedAt,
          }).from(employees).where(and(
            eq(employees.location, currentApplicant.location),
            eq(employees.employmentStatus, "active"),
            isNull(employees.endedAt),
          ));
          if (!hasActiveOperationsManagerAtLocation(operationsManagers, currentApplicant.location)) {
            throw new Error(`Add an active Operations Manager at ${currentApplicant.location} before onboarding a Puppy Monitor into the Staff Portal.`);
          }
        }

        const directoryValues = {
          sourceApplicationId: currentApplicant.id,
          name: currentApplicant.name,
          email,
          phone,
          role: currentApplicant.role,
          location: currentApplicant.location,
          employmentStatus: "active" as const,
          endedAt: null,
        };
        const [onboardingTransition] = await tx.update(jobApplications).set({
          status: "onboarded",
          isTeamMember: accessPlan.isTeamMember,
        })
          .where(and(
            eq(jobApplications.id, currentApplicant.id),
            eq(jobApplications.status, "accepted"),
            eq(jobApplications.role, currentApplicant.role),
            eq(jobApplications.location, currentApplicant.location),
            eq(jobApplications.isTeamMember, false),
            isNotNull(jobApplications.onboardingSentAt),
            isNull(jobApplications.onboardingDeliveryToken),
            isNull(jobApplications.deletedAt),
          ));
        if (onboardingTransition.affectedRows !== 1) {
          throw new Error("This applicant changed before employment onboarding could be completed. Reload and confirm the current status.");
        }
        if (matchingEmployee) {
          await tx.update(employees).set(directoryValues).where(eq(employees.id, matchingEmployee.id));
        } else {
          await tx.insert(employees).values(directoryValues);
        }
        const [directoryEmployee] = await tx.select({ id: employees.id }).from(employees)
          .where(eq(employees.sourceApplicationId, currentApplicant.id)).limit(1);
        if (!directoryEmployee) throw new Error("Employee Directory record could not be created.");
        await tx.insert(jobApplicationActions).values({
          applicationId: currentApplicant.id,
          action: matchingEmployee ? "employee_directory_linked" : "employee_directory_added",
          fromStatus: "accepted",
          toStatus: "onboarded",
          actorUserId: ctx.user.id,
          actorName: ctx.user.name,
          actorEmail: ctx.user.email,
          details: JSON.stringify({
            employmentOnboarded: true,
            grantsApyHqAccess: accessPlan.grantsApyHqAccess,
            grantsPortalAccess: accessPlan.grantsPortalAccess,
            portalAccessLevel: accessPlan.portalAccessLevel,
          }),
        });
        return { id: directoryEmployee.id, linkedExistingRecord: Boolean(matchingEmployee), accessPlan };
      });
      return {
        success: true,
        id: transfer.id,
        linkedExistingRecord: transfer.linkedExistingRecord,
        grantsApyHqAccess: transfer.accessPlan.grantsApyHqAccess,
        grantsPortalAccess: transfer.accessPlan.grantsPortalAccess,
        portalAccessLevel: transfer.accessPlan.portalAccessLevel,
      };
    }),

  // Give an existing active directory employee a matching APY HQ profile when the owner explicitly provisions access.
  provisionEmployeeApyHqAccess: adminProcedure
    .input(z.object({ employeeId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [employee] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
      if (!employee) throw new Error("Employee record not found.");
      const eligibility = getExistingEmployeeAccessProvisioningEligibility(employee);
      if (!eligibility.eligible) throw new Error(eligibility.reason);

      if (isPuppyMonitorRole(employee.role)) {
        const operationsManagers = await db.select({
          role: employees.role,
          location: employees.location,
          employmentStatus: employees.employmentStatus,
          endedAt: employees.endedAt,
        }).from(employees).where(and(
          eq(employees.location, employee.location),
          eq(employees.employmentStatus, "active"),
          isNull(employees.endedAt),
        ));
        if (!hasActiveOperationsManagerAtLocation(operationsManagers, employee.location)) {
          throw new Error("Add an active Operations Manager to this location before giving Puppy Monitors access.");
        }
      }

      const matchingProfileFields = {
        id: jobApplications.id,
        role: jobApplications.role,
        location: jobApplications.location,
        status: jobApplications.status,
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      };
      const [emailProfileMatches, phoneProfileMatches] = await Promise.all([
        employee.email ? db.select(matchingProfileFields).from(jobApplications).where(eq(jobApplications.email, employee.email)) : Promise.resolve([]),
        employee.phone ? db.select(matchingProfileFields).from(jobApplications).where(eq(jobApplications.phone, employee.phone)) : Promise.resolve([]),
      ]);
      const matchingProfiles = Array.from(new Map([...emailProfileMatches, ...phoneProfileMatches]
        .map((profile) => [profile.id, profile])).values());
      const matchingProfile = matchingProfiles[0] ?? null;
      const [linkedEmployee] = matchingProfile
        ? await db.select({ id: employees.id }).from(employees).where(eq(employees.sourceApplicationId, matchingProfile.id)).limit(1)
        : [];
      const linkEligibility = getLegacyEmployeeProfileLinkEligibility({
        matchingProfileCount: matchingProfiles.length,
        matchingProfileIsActiveTeamMember: Boolean(matchingProfile?.isTeamMember) && !matchingProfile?.deletedAt,
        matchingProfileIsArchived: Boolean(matchingProfile?.deletedAt),
        matchingProfileStatus: matchingProfile?.status ?? "",
        roleMatches: matchingProfile?.role === employee.role,
        locationMatches: matchingProfile?.location === employee.location,
        alreadyLinkedToAnotherEmployee: Boolean(linkedEmployee),
      });
      if (!linkEligibility.eligible) throw new Error(linkEligibility.reason);

      const profileId = await db.transaction(async (tx) => {
        if (linkEligibility.action === "link_existing_profile" && matchingProfile) {
          await tx.update(jobApplications).set({ isTeamMember: true, deletedAt: null })
            .where(eq(jobApplications.id, matchingProfile.id));
          await tx.update(employees).set({ sourceApplicationId: matchingProfile.id })
            .where(eq(employees.id, employee.id));
          await tx.insert(jobApplicationActions).values({
            applicationId: matchingProfile.id,
            action: "employee_directory_apy_hq_access_linked",
            toStatus: "onboarded",
            actorUserId: ctx.user.id,
            actorName: ctx.user.name,
            actorEmail: ctx.user.email,
            details: JSON.stringify({ grantsApyHqAccess: true, linkedExistingProfile: true, employeeId: employee.id }),
          });
          return matchingProfile.id;
        }
        const profileResult = await tx.insert(jobApplications).values({
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          role: employee.role,
          location: employee.location,
          whyAPY: "APY HQ access provisioned from Employee Directory.",
          experience: "",
          status: "onboarded",
          isTeamMember: true,
        });
        const sourceApplicationId = Number(profileResult[0].insertId);
        await tx.update(employees).set({ sourceApplicationId }).where(eq(employees.id, employee.id));
        await tx.insert(jobApplicationActions).values({
          applicationId: sourceApplicationId,
          action: "employee_directory_apy_hq_access_granted",
          toStatus: "onboarded",
          actorUserId: ctx.user.id,
          actorName: ctx.user.name,
          actorEmail: ctx.user.email,
          details: JSON.stringify({ grantsApyHqAccess: true, employeeId: employee.id }),
        });
        return sourceApplicationId;
      });
      return { success: true, id: profileId, grantsApyHqAccess: true };
    }),

  // Mark a directory employee inactive while retaining the directory history and original application. APY HQ removals remain in the existing protected team workflow.
  markEmployeeDeparted: adminProcedure
    .input(z.object({ employeeId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [employee] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
      if (!employee) throw new Error("Employee record not found.");
      if (employee.employmentStatus === "inactive") return { success: true, alreadyInactive: true };

      if (employee.sourceApplicationId !== null) {
        const [linkedProfile] = await db.select({ isTeamMember: jobApplications.isTeamMember, deletedAt: jobApplications.deletedAt })
          .from(jobApplications).where(eq(jobApplications.id, employee.sourceApplicationId)).limit(1);
        if (linkedProfile?.isTeamMember && !linkedProfile.deletedAt) {
          throw new Error("Remove this person from APY HQ Team first so staffing coverage and portal access are handled safely.");
        }
      }

      const endedAt = new Date();
      await db.transaction(async (tx) => {
        if (isOperationsManagerRole(employee.role)) {
          const activeLocationEmployees = await tx.select({
            id: employees.id,
            role: employees.role,
            location: employees.location,
            employmentStatus: employees.employmentStatus,
            endedAt: employees.endedAt,
          }).from(employees).where(and(
            eq(employees.location, employee.location),
            eq(employees.employmentStatus, "active"),
            isNull(employees.endedAt),
          ));
          const coverageEligibility = getOperationsManagerDepartureEligibility({
            employeeId: employee.id,
            employeeRole: employee.role,
            activeLocationEmployees,
          });
          if (!coverageEligibility.eligible) {
            throw new Error(`${coverageEligibility.reason.replace("this location", employee.location)}`);
          }
        }
        await tx.update(employees).set(getEmployeeDepartureUpdate(endedAt)).where(eq(employees.id, employee.id));
        if (employee.sourceApplicationId !== null) {
          await tx.insert(jobApplicationActions).values({
            applicationId: employee.sourceApplicationId,
            action: "employee_directory_departed",
            actorUserId: ctx.user.id,
            actorName: ctx.user.name,
            actorEmail: ctx.user.email,
          });
        }
      });
      return { success: true, alreadyInactive: false };
    }),

  // Re-establish the employment record only. APY HQ and staff-login access need a separate, deliberate action.
  reactivateEmployeeEmployment: adminProcedure
    .input(z.object({ employeeId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db.transaction(async (tx) => {
        const [employee] = await tx.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
        if (!employee) throw new Error("Employee record not found.");
        if (employee.employmentStatus === "active") return { success: true, alreadyActive: true };

        const linkedProfile = employee.sourceApplicationId === null ? null : (await tx.select({
          isTeamMember: jobApplications.isTeamMember,
          deletedAt: jobApplications.deletedAt,
        }).from(jobApplications).where(eq(jobApplications.id, employee.sourceApplicationId)).limit(1))[0] ?? null;
        const activeTeamContacts = employee.sourceApplicationId === null
          ? await tx.select({ email: jobApplications.email, phone: jobApplications.phone }).from(jobApplications).where(and(
            eq(jobApplications.isTeamMember, true),
            isNull(jobApplications.deletedAt),
          ))
          : [];
        const eligibility = getEmployeeEmploymentReactivationEligibility({
          employmentStatus: employee.employmentStatus,
          hasApyHqAccess: hasActiveApyHqAccess(linkedProfile ?? undefined)
            || hasMatchingActiveTeamContact(employee, activeTeamContacts),
        });
        if (!eligibility.eligible) throw new Error(eligibility.reason);

        const [result] = await tx.update(employees).set(getEmployeeReactivationUpdate())
          .where(and(eq(employees.id, employee.id), eq(employees.employmentStatus, "inactive")));
        if (result.affectedRows !== 1) throw new Error("This employee record changed while it was being restored. Reload and review the current status.");
        if (employee.sourceApplicationId !== null) {
          await tx.insert(jobApplicationActions).values({
            applicationId: employee.sourceApplicationId,
            action: "employee_directory_reactivated",
            actorUserId: ctx.user.id,
            actorName: ctx.user.name,
            actorEmail: ctx.user.email,
            details: JSON.stringify({ employmentReactivated: true, hasApyHqAccess: false }),
          });
        }
        return { success: true, alreadyActive: false };
      });
    }),

  // Permanently delete a former directory record only. Hiring/application history is intentionally retained.
  deleteFormerEmployeeRecord: adminProcedure
    .input(z.object({ employeeId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [employee] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
      if (!employee) throw new Error("Employee record not found.");

      const linkedProfile = employee.sourceApplicationId === null ? null : (await db.select({
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      }).from(jobApplications).where(eq(jobApplications.id, employee.sourceApplicationId)).limit(1))[0] ?? null;
      const eligibility = getFormerEmployeeDeletionEligibility({
        employmentStatus: employee.employmentStatus,
        linkedActiveTeamProfile: Boolean(linkedProfile?.isTeamMember) && !linkedProfile?.deletedAt,
      });
      if (!eligibility.eligible) throw new Error(eligibility.reason);

      await db.transaction(async (tx) => {
        if (employee.sourceApplicationId !== null) {
          await tx.insert(jobApplicationActions).values({
            applicationId: employee.sourceApplicationId,
            action: "employee_directory_record_deleted",
            actorUserId: ctx.user.id,
            actorName: ctx.user.name,
            actorEmail: ctx.user.email,
            details: JSON.stringify({ directoryRecordDeleted: true }),
          });
        }
        await tx.delete(employees).where(eq(employees.id, employee.id));
      });
      return { success: true };
    }),

  // Get availability for a specific staff member
  getStaffLeaves: staffProcedure
    .input(z.object({ staffId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db
        .select()
        .from(staffAvailability)
        .where(eq(staffAvailability.staffId, input.staffId))
        .orderBy(desc(staffAvailability.createdAt));
    }),

  // Forward-looking Saturday/Sunday board for Operations Managers and Yoga Instructors.
  getWeekendCoverage: staffProcedure
    .input(z.object({ weekends: z.number().int().min(1).max(12).default(6) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const weekends = getUpcomingWeekendDates(new Date(), input?.weekends ?? 6);
      const firstDate = weekends[0]?.date;
      if (!firstDate) return { weekends: [], shifts: [] };

      const [staff, leaves, savedCoverage] = await Promise.all([
        db.select({
          id: jobApplications.id,
          name: jobApplications.name,
          role: jobApplications.role,
          location: jobApplications.location,
          status: jobApplications.status,
          isTeamMember: jobApplications.isTeamMember,
          deletedAt: jobApplications.deletedAt,
        }).from(jobApplications).where(and(isNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, true))),
        db.select().from(staffAvailability).where(gte(staffAvailability.endDate, firstDate)),
        db.select().from(weekendLeadershipCoverage).where(gte(weekendLeadershipCoverage.coverageDate, firstDate)),
      ]);

      const activeStaff = staff.filter(isActiveTeamMember);
      const roles = ["Operations Manager", "Yoga Instructor"] as const;
      const locations = ["KW", "OAK", "HAM"] as const;
      const sameRole = (personRole: string, role: string) => personRole === role || personRole === role.toLowerCase().replaceAll(" ", "_");

      const shifts = weekends.flatMap((weekend) => locations.flatMap((location) => roles.map((role) => {
        const roleStaff = activeStaff.filter((person) => person.location === location && sameRole(person.role, role));
        const primary = roleStaff[0] ?? null;
        const primaryLeave = primary ? leaves.find((leave) => leave.staffId === primary.id && isAwayOnDate(leave, weekend.date)) : undefined;
        const coverage = savedCoverage.find((item) => item.coverageDate === weekend.date && item.location === location && item.role === role) ?? null;
        const candidates = activeStaff
          .filter((person) => sameRole(person.role, role))
          .filter((person) => !leaves.some((leave) => leave.staffId === person.id && isAwayOnDate(leave, weekend.date)));
        const status = coverage?.coverageStaffId ? "covered" : primaryLeave ? "away" : primary ? "available" : "unassigned";

        return {
          date: weekend.date,
          dayLabel: weekend.dayLabel,
          shortLabel: weekend.shortLabel,
          location,
          role,
          primary,
          primaryLeave: primaryLeave ?? null,
          coverage,
          candidates,
          status,
        };
      })));

      return { weekends, shifts };
    }),

  // Add a leave/availability block
  addLeave: adminProcedure
    .input(z.object({
      staffId: z.number(),
      staffName: z.string(),
      leaveType: z.enum(["vacation", "sick", "personal", "leave", "unavailable"]),
      startDate: z.string(),
      endDate: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(staffAvailability).values({
        staffId: input.staffId,
        staffName: input.staffName,
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes,
      });
      return { success: true };
    }),

  // Delete a leave entry
  deleteLeave: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(staffAvailability).where(eq(staffAvailability.id, input.id));
      return { success: true };
    }),

  // Assign or clear a backup for a single weekend leadership shift.
  assignWeekendCoverage: adminProcedure
    .input(z.object({
      coverageDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      location: z.enum(["KW", "OAK", "HAM"]),
      role: z.enum(["Operations Manager", "Yoga Instructor"]),
      coverageStaffId: z.number().nullable(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input }) => {
      if (!isWeekendDate(input.coverageDate)) throw new Error("Coverage can only be assigned to a Saturday or Sunday.");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(weekendLeadershipCoverage).where(and(
        eq(weekendLeadershipCoverage.coverageDate, input.coverageDate),
        eq(weekendLeadershipCoverage.location, input.location),
        eq(weekendLeadershipCoverage.role, input.role),
      )).limit(1);

      if (input.coverageStaffId === null) {
        if (existing[0]) await db.delete(weekendLeadershipCoverage).where(eq(weekendLeadershipCoverage.id, existing[0].id));
        return { success: true };
      }

      const candidate = await db.select({
        id: jobApplications.id,
        name: jobApplications.name,
        role: jobApplications.role,
        status: jobApplications.status,
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      }).from(jobApplications).where(eq(jobApplications.id, input.coverageStaffId)).limit(1);
      const person = candidate[0];
      const normalRole = input.role.toLowerCase().replaceAll(" ", "_");
      if (!person || !isActiveTeamMember(person)) throw new Error("Choose an active APY HQ team member for coverage.");
      if (person.role !== input.role && person.role !== normalRole) throw new Error("Coverage must be assigned to a team member with the same role.");

      const values = {
        coverageStaffId: person.id,
        coverageStaffName: person.name,
        notes: input.notes?.trim() || null,
      };
      if (existing[0]) {
        await db.update(weekendLeadershipCoverage).set(values).where(eq(weekendLeadershipCoverage.id, existing[0].id));
      } else {
        await db.insert(weekendLeadershipCoverage).values({
          coverageDate: input.coverageDate,
          location: input.location,
          role: input.role,
          ...values,
        });
      }
      return { success: true };
    }),

  // Add a staff member directly, without requiring a careers-portal application.
  createTeamMember: adminProcedure
    .input(directTeamMemberSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const normalizedPhone = input.phone ? normalizeCanadianPhoneNumber(input.phone) : null;
      const normalizedEmail = input.email ? input.email.toLowerCase() : null;
      const [emailMatch, phoneMatch] = await Promise.all([
        normalizedEmail
          ? db.select({ id: employees.id }).from(employees).where(eq(employees.email, normalizedEmail)).limit(1)
          : Promise.resolve([]),
        normalizedPhone
          ? db.select({ id: employees.id }).from(employees).where(eq(employees.phone, normalizedPhone)).limit(1)
          : Promise.resolve([]),
      ]);
      if (emailMatch[0] || phoneMatch[0]) {
        throw new Error("An Employee Directory record already uses this email address or phone number. Update or restore the existing record instead of adding a duplicate.");
      }

      if (input.role === "Puppy Monitor") {
        const [operationsManager] = await db.select({ id: jobApplications.id })
          .from(jobApplications)
          .where(and(
            isNull(jobApplications.deletedAt),
            eq(jobApplications.isTeamMember, true),
            eq(jobApplications.role, "Operations Manager"),
            eq(jobApplications.location, input.location),
          ))
          .limit(1);
        if (!operationsManager) {
          throw new Error("Add this location's Operations Manager to APY HQ before adding Puppy Monitors.");
        }
      }

      const memberId = await db.transaction(async (tx) => {
        const result = await tx.insert(jobApplications).values({
          name: input.name,
          email: normalizedEmail,
          phone: normalizedPhone,
          role: input.role,
          location: input.location,
          whyAPY: "Added directly through APY HQ.",
          experience: "",
          status: "onboarded",
          isTeamMember: true,
        });
        const sourceApplicationId = Number(result[0].insertId);
        await tx.insert(employees).values({
          sourceApplicationId,
          name: input.name,
          email: normalizedEmail,
          phone: normalizedPhone,
          role: input.role,
          location: input.location,
          employmentStatus: "active",
        });
        return sourceApplicationId;
      });

      return { success: true, id: memberId };
    }),

  // Edit an active APY HQ team profile without disturbing its hiring history or access audit trail.
  updateTeamMember: adminProcedure
    .input(teamMemberProfileUpdateSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db.select({
        id: jobApplications.id,
        role: jobApplications.role,
        location: jobApplications.location,
      }).from(jobApplications).where(and(
        eq(jobApplications.id, input.id),
        eq(jobApplications.isTeamMember, true),
        isNull(jobApplications.deletedAt),
      )).limit(1);
      if (!existing) throw new Error("This person is not an active APY HQ team member.");

      const [operationsManagersAtTarget, operationsManagersAtCurrentLocation, activePuppyMonitorsAtCurrentLocation] = await Promise.all([
        db.select({ id: jobApplications.id })
          .from(jobApplications)
          .where(and(
            isNull(jobApplications.deletedAt),
            eq(jobApplications.isTeamMember, true),
            eq(jobApplications.role, "Operations Manager"),
            eq(jobApplications.location, input.location),
          )),
        db.select({ id: jobApplications.id })
          .from(jobApplications)
          .where(and(
            isNull(jobApplications.deletedAt),
            eq(jobApplications.isTeamMember, true),
            eq(jobApplications.role, "Operations Manager"),
            eq(jobApplications.location, existing.location),
          )),
        db.select({ id: jobApplications.id })
          .from(jobApplications)
          .where(and(
            isNull(jobApplications.deletedAt),
            eq(jobApplications.isTeamMember, true),
            eq(jobApplications.role, "Puppy Monitor"),
            eq(jobApplications.location, existing.location),
          )),
      ]);

      validateTeamAssignmentChange({
        currentRole: existing.role,
        currentLocation: existing.location,
        nextRole: input.role,
        nextLocation: input.location,
        hasOperationsManagerAtNextLocation: operationsManagersAtTarget.some((manager) => manager.id !== existing.id || input.role === "Operations Manager"),
        hasOtherOperationsManagerAtCurrentLocation: operationsManagersAtCurrentLocation.some((manager) => manager.id !== existing.id),
        hasActivePuppyMonitorsAtCurrentLocation: activePuppyMonitorsAtCurrentLocation.length > 0,
        activePuppyMonitorCountAtCurrentLocation: activePuppyMonitorsAtCurrentLocation.length,
      });

      await db.update(jobApplications).set({
        name: input.name,
        email: input.email ? input.email.toLowerCase() : null,
        phone: input.phone ? normalizeCanadianPhoneNumber(input.phone) : null,
        role: input.role,
        location: input.location,
      }).where(eq(jobApplications.id, input.id));
      await db.update(employees).set({
        name: input.name,
        email: input.email ? input.email.toLowerCase() : null,
        phone: input.phone ? normalizeCanadianPhoneNumber(input.phone) : null,
        role: input.role,
        location: input.location,
      }).where(eq(employees.sourceApplicationId, input.id));

      return { success: true };
    }),

  setTeamMemberActive: adminProcedure
    .input(teamMemberActivitySchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [existing] = await db.select({
        id: jobApplications.id,
        role: jobApplications.role,
        location: jobApplications.location,
        isTeamMember: jobApplications.isTeamMember,
        archivedAt: jobApplications.deletedAt,
      }).from(jobApplications).where(and(
        eq(jobApplications.id, input.id),
      )).limit(1);
      if (!existing) throw new Error("This team profile is no longer available.");
      const isCurrentlyActive = Boolean(existing.isTeamMember) && !existing.archivedAt;
      if (isCurrentlyActive === input.isActive) return { success: true };
      if (!input.isActive && !isCurrentlyActive) throw new Error("This person is already inactive.");
      if (input.isActive && (!existing.isTeamMember || !existing.archivedAt)) throw new Error("Only an archived APY HQ team profile can be reactivated.");

      const [operationsManagersAtLocation, activePuppyMonitorsAtLocation] = await Promise.all([
        db.select({ id: jobApplications.id }).from(jobApplications).where(and(
          isNull(jobApplications.deletedAt),
          eq(jobApplications.isTeamMember, true),
          eq(jobApplications.role, "Operations Manager"),
          eq(jobApplications.location, existing.location),
        )),
        db.select({ id: jobApplications.id }).from(jobApplications).where(and(
          isNull(jobApplications.deletedAt),
          eq(jobApplications.isTeamMember, true),
          eq(jobApplications.role, "Puppy Monitor"),
          eq(jobApplications.location, existing.location),
        )),
      ]);

      validateTeamAssignmentChange({
        currentRole: existing.role,
        currentLocation: existing.location,
        nextRole: input.isActive ? existing.role : "Inactive",
        nextLocation: existing.location,
        hasOperationsManagerAtNextLocation: operationsManagersAtLocation.some((manager) => manager.id !== existing.id || existing.role === "Operations Manager"),
        hasOtherOperationsManagerAtCurrentLocation: operationsManagersAtLocation.some((manager) => manager.id !== existing.id),
        hasActivePuppyMonitorsAtCurrentLocation: activePuppyMonitorsAtLocation.length > 0,
        activePuppyMonitorCountAtCurrentLocation: activePuppyMonitorsAtLocation.length,
      });

      const statusChangedAt = new Date();
      await db.transaction(async (tx) => {
        await tx.update(jobApplications).set({
          isTeamMember: true,
          deletedAt: input.isActive ? null : statusChangedAt,
        }).where(eq(jobApplications.id, input.id));
        await tx.update(employees).set({
          employmentStatus: input.isActive ? "active" : "inactive",
          endedAt: input.isActive ? null : statusChangedAt,
        }).where(eq(employees.sourceApplicationId, input.id));
      });
      return { success: true };
    }),

  // Remove from APY HQ, staffing, and portal access while retaining employee history.
  removeTeamMember: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [member] = await db.select({
        email: jobApplications.email,
        phone: jobApplications.phone,
        role: jobApplications.role,
        location: jobApplications.location,
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      })
        .from(jobApplications)
        .where(eq(jobApplications.id, input.id))
        .limit(1);
      if (!member) throw new Error("Team member not found");

      const [operationsManagersAtLocation, activePuppyMonitorsAtLocation] = await Promise.all([
        db.select({ id: jobApplications.id }).from(jobApplications).where(and(
          isNull(jobApplications.deletedAt),
          eq(jobApplications.isTeamMember, true),
          eq(jobApplications.role, "Operations Manager"),
          eq(jobApplications.location, member.location),
        )),
        db.select({ id: jobApplications.id }).from(jobApplications).where(and(
          isNull(jobApplications.deletedAt),
          eq(jobApplications.isTeamMember, true),
          eq(jobApplications.role, "Puppy Monitor"),
          eq(jobApplications.location, member.location),
        )),
      ]);
      validateTeamAssignmentChange({
        currentRole: member.role,
        currentLocation: member.location,
        nextRole: "Inactive",
        nextLocation: member.location,
        hasOperationsManagerAtNextLocation: operationsManagersAtLocation.some((manager) => manager.id !== input.id),
        hasOtherOperationsManagerAtCurrentLocation: operationsManagersAtLocation.some((manager) => manager.id !== input.id),
        hasActivePuppyMonitorsAtCurrentLocation: activePuppyMonitorsAtLocation.length > 0,
        activePuppyMonitorCountAtCurrentLocation: activePuppyMonitorsAtLocation.length,
      });

      const removedAt = new Date();
      await db.transaction(async (tx) => {
        await tx.update(jobApplications)
          .set(getTeamRemovalUpdate(removedAt))
          .where(eq(jobApplications.id, input.id));
        await tx.update(employees)
          .set({ employmentStatus: "inactive", endedAt: removedAt })
          .where(eq(employees.sourceApplicationId, input.id));
        await tx.delete(classStaffAssignments).where(eq(classStaffAssignments.staffId, input.id));
        await tx.delete(staffAvailability).where(eq(staffAvailability.staffId, input.id));
        await tx.update(weekendLeadershipCoverage)
          .set({ coverageStaffId: null, coverageStaffName: null, notes: null })
          .where(eq(weekendLeadershipCoverage.coverageStaffId, input.id));
        if (member.email) {
          await tx.update(staffInvites).set({ isActive: 0 })
            .where(eq(staffInvites.email, member.email));
        }
      });
      if (member.email) {
        const staffUser = await getUserByOpenId(`staff:${member.email}`);
        if (staffUser?.role === "staff") {
          await upsertUser({ openId: `staff:${member.email}`, role: "user" });
        }
      }
      const normalizedPhone = member.phone ? normalizeCanadianPhoneNumber(member.phone) : null;
      if (normalizedPhone) {
        const phoneUser = await getUserByOpenId(`staff-phone:${normalizedPhone}`);
        if (phoneUser?.role === "staff") {
          await upsertUser({ openId: `staff-phone:${normalizedPhone}`, role: "user" });
        }
      }
      return { success: true };
    }),

  // Restore a removed employee who has a linked APY HQ team profile.
  reactivateTeamMember: adminProcedure
    .input(z.object({ employeeId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [employee] = await db.select().from(employees)
        .where(eq(employees.id, input.employeeId))
        .limit(1);
      if (!employee || employee.sourceApplicationId === null) {
        throw new Error("This employee needs a linked APY HQ team profile before they can be restored.");
      }
      const sourceApplicationId = employee.sourceApplicationId;
      if (employee.employmentStatus !== "active") {
        throw new Error("Restore this person to active employment before granting APY HQ access.");
      }
      const [profile] = await db.select({
        role: jobApplications.role,
        location: jobApplications.location,
        status: jobApplications.status,
        isTeamMember: jobApplications.isTeamMember,
        deletedAt: jobApplications.deletedAt,
      }).from(jobApplications).where(eq(jobApplications.id, sourceApplicationId)).limit(1);
      if (!profile) throw new Error("The linked APY HQ team profile could not be found.");
      if (profile.status !== "onboarded" && profile.status !== "accepted") {
        throw new Error("Complete this employee's onboarding before granting APY HQ access.");
      }
      if (hasActiveApyHqAccess(profile)) return { success: true, sourceApplicationId, alreadyActive: true };
      if (profile.role === "Puppy Monitor") {
        const [operationsManager] = await db.select({ id: jobApplications.id })
          .from(jobApplications)
          .where(and(
            isNull(jobApplications.deletedAt),
            eq(jobApplications.isTeamMember, true),
            eq(jobApplications.role, "Operations Manager"),
            eq(jobApplications.location, profile.location),
          ))
          .limit(1);
        if (!operationsManager) {
          throw new Error("Add this location's Operations Manager to APY HQ before restoring Puppy Monitor access.");
        }
      }
      await db.transaction(async (tx) => {
        await tx.update(employees).set({ employmentStatus: "active", endedAt: null })
          .where(eq(employees.id, input.employeeId));
        await tx.update(jobApplications).set({ isTeamMember: true, deletedAt: null, status: "onboarded" })
          .where(eq(jobApplications.id, sourceApplicationId));
      });
      return { success: true, sourceApplicationId };
    }),
});
