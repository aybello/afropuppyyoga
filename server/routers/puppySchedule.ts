import { z } from "zod";
import { staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { puppySchedule } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
const DAYS = ["Saturday", "Sunday"] as const;

export const puppyScheduleRouter = router({
  /** List all schedule entries, newest first — staff/admin only */
  list: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(puppySchedule).orderBy(desc(puppySchedule.classDate));
  }),

  /** Create a new schedule entry — staff/admin only */
  create: staffProcedure
    .input(
      z.object({
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        dayOfWeek: z.enum(DAYS),
        location: z.enum(LOCATIONS),
        breed: z.string().min(1),
        breederId: z.number().int().positive(),
        breederName: z.string().min(1),
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
        dayOfWeek: z.enum(DAYS).optional(),
        location: z.enum(LOCATIONS).optional(),
        breed: z.string().min(1).optional(),
        breederId: z.number().int().positive().optional(),
        breederName: z.string().min(1).optional(),
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
