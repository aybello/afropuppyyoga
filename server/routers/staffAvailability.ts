import { z } from "zod";
import { adminProcedure, staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { staffAvailability, jobApplications } from "../../drizzle/schema";
import { eq, gte, isNull, desc } from "drizzle-orm";

export const staffAvailabilityRouter = router({
  // Get all staff (onboarded/accepted) with their current availability status
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
        isNull(jobApplications.deletedAt)
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
});
