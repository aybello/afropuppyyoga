import { z } from "zod";
import { adminProcedure, staffProcedure, router } from "../_core/trpc";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { classStaffAssignments, employees, jobApplications, staffAvailability, staffInvites, weekendLeadershipCoverage } from "../../drizzle/schema";
import { and, asc, desc, eq, gte, isNull, isNotNull } from "drizzle-orm";
import { getUpcomingWeekendDates, isAwayOnDate, isWeekendDate } from "../weekendCoverage";
import { isActiveTeamMember } from "../teamMembership";
import { normalizeCanadianPhoneNumber } from "../../shared/phone";

export const directTeamMemberSchema = z.object({
  name: z.string().trim().min(2, "Enter the team member's full name."),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")).default(""),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(["Yoga Instructor", "Operations Manager", "Puppy Monitor", "Puppy Specialist", "BDR", "Social Media Specialist"]),
  location: z.enum(["KW", "OAK", "HAM", "CENTRAL"]),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Add either an email address or phone number." });
  }
  if (value.phone && !normalizeCanadianPhoneNumber(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Canadian phone number." });
  }
});

export const teamMemberProfileUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2, "Enter the team member's full name."),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")).default(""),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(["Yoga Instructor", "Operations Manager", "Puppy Monitor", "Puppy Specialist", "BDR", "Social Media Specialist"]),
  location: z.enum(["KW", "OAK", "HAM", "CENTRAL"]),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Add either an email address or phone number." });
  }
  if (value.phone && !normalizeCanadianPhoneNumber(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid Canadian phone number." });
  }
});

export const teamMemberActivitySchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

const isOperationsManagerRole = (role: string) => role.toLowerCase().replaceAll("_", " ") === "operations manager";

export function getTeamRemovalUpdate(removedAt: Date) {
  return { isTeamMember: false, deletedAt: removedAt };
}

export function validateTeamAssignmentChange(input: {
  currentRole: string;
  currentLocation: string;
  nextRole: string;
  nextLocation: string;
  hasOperationsManagerAtNextLocation: boolean;
  hasOtherOperationsManagerAtCurrentLocation: boolean;
  hasActivePuppyMonitorsAtCurrentLocation: boolean;
}) {
  if (input.nextRole === "Puppy Monitor" && !input.hasOperationsManagerAtNextLocation) {
    throw new Error("Add or retain an Operations Manager at this location before assigning Puppy Monitors.");
  }
  const movesOperationsManager = isOperationsManagerRole(input.currentRole)
    && (input.nextRole !== "Operations Manager" || input.nextLocation !== input.currentLocation);
  if (movesOperationsManager && input.hasActivePuppyMonitorsAtCurrentLocation && !input.hasOtherOperationsManagerAtCurrentLocation) {
    throw new Error("Assign another Operations Manager to this Puppy Monitor location before changing this team member.");
  }
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
    return db.select().from(employees)
      .orderBy(asc(employees.employmentStatus), asc(employees.location), asc(employees.name));
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
          email: input.email ? input.email.toLowerCase() : null,
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
          email: input.email ? input.email.toLowerCase() : null,
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
      await db.transaction(async (tx) => {
        await tx.update(employees).set({ employmentStatus: "active", endedAt: null })
          .where(eq(employees.id, input.employeeId));
        await tx.update(jobApplications).set({ isTeamMember: true, deletedAt: null, status: "onboarded" })
          .where(eq(jobApplications.id, sourceApplicationId));
      });
      return { success: true, sourceApplicationId };
    }),
});
