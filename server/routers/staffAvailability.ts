import { z } from "zod";
import { adminProcedure, staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { staffAvailability, jobApplications, weekendLeadershipCoverage } from "../../drizzle/schema";
import { and, eq, gte, isNull, desc } from "drizzle-orm";
import { getUpcomingWeekendDates, isAwayOnDate, isWeekendDate } from "../weekendCoverage";
import { isActiveTeamMember } from "../teamMembership";

export const directTeamMemberSchema = z.object({
  name: z.string().trim().min(2, "Enter the team member's full name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().max(50).optional().default(""),
  role: z.enum(["Yoga Instructor", "Operations Manager", "Puppy Monitor", "Puppy Specialist", "BDR", "Social Media Specialist"]),
  location: z.enum(["KW", "OAK", "HAM", "CENTRAL"]),
});

export const staffAvailabilityRouter = router({
  // Get only people manually added to APY HQ with their current availability status.
  getOrgChart: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const staff = await db
      .select({
        id: jobApplications.id,
        name: jobApplications.name,
        email: jobApplications.email,
        phone: jobApplications.phone,
        role: jobApplications.role,
        location: jobApplications.location,
        appStatus: jobApplications.status,
      })
      .from(jobApplications)
      .where(
        and(isNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, true))
      )
      .orderBy(jobApplications.role, jobApplications.location);

    // Get all current/upcoming leaves
    const today = new Date().toISOString().split("T")[0];
    const leaves = await db
      .select()
      .from(staffAvailability)
      .where(gte(staffAvailability.endDate, today))
      .orderBy(desc(staffAvailability.createdAt));

    return { staff, leaves };
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

      const result = await db.insert(jobApplications).values({
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        role: input.role,
        location: input.location,
        whyAPY: "Added directly through APY HQ.",
        experience: "",
        status: "onboarded",
        isTeamMember: true,
      });

      return { success: true, id: Number(result[0].insertId) };
    }),

  // Soft-delete a team member so they disappear from the org chart without losing history.
  removeTeamMember: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(jobApplications)
        .set({ deletedAt: new Date() })
        .where(eq(jobApplications.id, input.id));
      return { success: true };
    }),
});
