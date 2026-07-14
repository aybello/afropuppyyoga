import { z } from "zod";
import { staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { puppySchedule } from "../../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const WEEKEND_DAYS = ["Saturday", "Sunday"] as const;

/** Zod type for HH:MM 24-hour time strings */
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format");

/** Shared slot input shape — used for both create and update */
const slotInputBase = z.object({
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  dayOfWeek: z.enum(ALL_DAYS),
  location: z.enum(LOCATIONS),
  breed: z.string().min(1),
  breederId: z.number().int().positive(),
  breederName: z.string().min(1),
  startTime: timeString.default("09:00"),
  endTime: timeString.default("15:00"),
  classType: z.enum(["regular", "private"]).default("regular"),
  notes: z.string().optional(),
});

export const puppyScheduleRouter = router({
  // ─── Legacy list (used by BreedersDashboard schedule tab) ─────────────────
  /** List all schedule entries, newest first — staff/admin only */
  list: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(puppySchedule).orderBy(desc(puppySchedule.classDate));
  }),

  // ─── Calendar procedures ──────────────────────────────────────────────────

  /**
   * List all slots for a given calendar month.
   * Returns every slot where classDate is within [YYYY-MM-01, YYYY-MM-last].
   */
  listByMonth: staffProcedure
    .input(z.object({
      year: z.number().int().min(2024).max(2100),
      month: z.number().int().min(1).max(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { year, month } = input;
      const pad = (n: number) => String(n).padStart(2, "0");
      const firstDay = `${year}-${pad(month)}-01`;
      // Last day: go to first day of next month minus 1
      const lastDate = new Date(year, month, 0); // day 0 of next month = last day of this month
      const lastDay = `${year}-${pad(month)}-${pad(lastDate.getDate())}`;
      return db
        .select()
        .from(puppySchedule)
        .where(and(gte(puppySchedule.classDate, firstDay), lte(puppySchedule.classDate, lastDay)))
        .orderBy(puppySchedule.classDate, puppySchedule.startTime);
    }),

  /** Create a new schedule slot — staff/admin only */
  createSlot: staffProcedure
    .input(slotInputBase)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(puppySchedule).values({
        classDate: input.classDate,
        dayOfWeek: input.dayOfWeek,
        location: input.location,
        breed: input.breed,
        breederId: input.breederId,
        breederName: input.breederName,
        startTime: input.startTime,
        endTime: input.endTime,
        classType: input.classType,
        notes: input.notes ?? null,
      });
      return { success: true };
    }),

  /** Update an existing schedule slot — staff/admin only */
  updateSlot: staffProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(slotInputBase.partial()))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...fields } = input;
      // Only pass defined fields to avoid overwriting with undefined
      const update: Record<string, unknown> = {};
      if (fields.classDate !== undefined) update.classDate = fields.classDate;
      if (fields.dayOfWeek !== undefined) update.dayOfWeek = fields.dayOfWeek;
      if (fields.location !== undefined) update.location = fields.location;
      if (fields.breed !== undefined) update.breed = fields.breed;
      if (fields.breederId !== undefined) update.breederId = fields.breederId;
      if (fields.breederName !== undefined) update.breederName = fields.breederName;
      if (fields.startTime !== undefined) update.startTime = fields.startTime;
      if (fields.endTime !== undefined) update.endTime = fields.endTime;
      if (fields.classType !== undefined) update.classType = fields.classType;
      if ("notes" in fields) update.notes = fields.notes ?? null;
      await db.update(puppySchedule).set(update).where(eq(puppySchedule.id, id));
      return { success: true };
    }),

  /** Delete a schedule slot — staff/admin only */
  deleteSlot: staffProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(puppySchedule).where(eq(puppySchedule.id, input.id));
      return { success: true };
    }),

  // ─── Legacy CRUD (kept for backward compat with BreedersDashboard) ────────

  /** Create a new schedule entry — staff/admin only */
  create: staffProcedure
    .input(
      z.object({
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        dayOfWeek: z.enum(ALL_DAYS),
        location: z.enum(LOCATIONS),
        breed: z.string().min(1),
        breederId: z.number().int().positive(),
        breederName: z.string().min(1),
        startTime: timeString.optional(),
        endTime: timeString.optional(),
        classType: z.enum(["regular", "private"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(puppySchedule).values({
        classDate: input.classDate,
        dayOfWeek: input.dayOfWeek,
        location: input.location,
        breed: input.breed,
        breederId: input.breederId,
        breederName: input.breederName,
        startTime: input.startTime ?? "09:00",
        endTime: input.endTime ?? "15:00",
        classType: input.classType ?? "regular",
        notes: input.notes ?? null,
      });
      return { success: true };
    }),

  /** Update an existing schedule entry — staff/admin only */
  update: staffProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dayOfWeek: z.enum(ALL_DAYS).optional(),
        location: z.enum(LOCATIONS).optional(),
        breed: z.string().min(1).optional(),
        breederId: z.number().int().positive().optional(),
        breederName: z.string().min(1).optional(),
        startTime: timeString.optional(),
        endTime: timeString.optional(),
        classType: z.enum(["regular", "private"]).optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...fields } = input;
      await db.update(puppySchedule).set(fields).where(eq(puppySchedule.id, id));
      return { success: true };
    }),

  /** Delete a schedule entry — staff/admin only */
  delete: staffProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(puppySchedule).where(eq(puppySchedule.id, input.id));
      return { success: true };
    }),
});
