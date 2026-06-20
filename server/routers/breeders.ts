import { z } from "zod";
import { router, staffProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { breeders } from "../../drizzle/schema";
import type { Breeder } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const breederInput = z.object({
  name: z.string().min(1, "Breeder name is required"),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  instagram: z.string().optional(),
  breed: z.string().optional(),
  litterTimeline: z.string().optional(),
  typicalRate: z.string().optional(),
  transport: z.string().optional(),
  contractStatus: z.enum(["No contract yet", "Contract sent", "Contract completed"]).default("No contract yet"),
  notes: z.string().optional(),
  isActive: z.number().int().min(0).max(1).default(1),
});

export const breedersRouter = router({
  /**
   * List all breeders, optionally filtered by search term or contract status
   */
  list: staffProcedure
    .input(
      z.object({
        search: z.string().optional(),
        contractStatus: z.enum(["No contract yet", "Contract sent", "Contract completed", "all"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(breeders).orderBy(desc(breeders.createdAt));

      let filtered: Breeder[] = rows;

      if (input?.search) {
        const s = input.search.toLowerCase();
        filtered = filtered.filter((b: Breeder) =>
          b.name.toLowerCase().includes(s) ||
          (b.breed ?? "").toLowerCase().includes(s) ||
          (b.contactName ?? "").toLowerCase().includes(s) ||
          (b.email ?? "").toLowerCase().includes(s) ||
          (b.instagram ?? "").toLowerCase().includes(s)
        );
      }

      if (input?.contractStatus && input.contractStatus !== "all") {
        filtered = filtered.filter((b: Breeder) => b.contractStatus === input.contractStatus);
      }

      return filtered;
    }),

  /**
   * Get a single breeder by ID
   */
  get: staffProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(breeders).where(eq(breeders.id, input.id));
      return row ?? null;
    }),

  /**
   * Add a new breeder
   */
  add: staffProcedure
    .input(breederInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(breeders).values({
        name: input.name,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email || null,
        instagram: input.instagram ?? null,
        breed: input.breed ?? null,
        litterTimeline: input.litterTimeline ?? null,
        typicalRate: input.typicalRate ?? null,
        transport: input.transport ?? null,
        contractStatus: input.contractStatus,
        notes: input.notes ?? null,
        isActive: input.isActive,
      });
      return { success: true };
    }),

  /**
   * Update an existing breeder
   */
  update: staffProcedure
    .input(z.object({ id: z.number() }).merge(breederInput.partial()))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(breeders).set({
        ...data,
        email: data.email || null,
      }).where(eq(breeders.id, id));
      return { success: true };
    }),

  /**
   * Delete a breeder
   */
  delete: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(breeders).where(eq(breeders.id, input.id));
      return { success: true };
    }),

  /**
   * Bulk import breeders (used for initial data import from Excel)
   */
  bulkImport: staffProcedure
    .input(z.array(breederInput))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.length === 0) return { imported: 0 };
      await db.insert(breeders).values(
        input.map(b => ({
          name: b.name,
          contactName: b.contactName ?? null,
          phone: b.phone ?? null,
          email: b.email || null,
          instagram: b.instagram ?? null,
          breed: b.breed ?? null,
          litterTimeline: b.litterTimeline ?? null,
          typicalRate: b.typicalRate ?? null,
          transport: b.transport ?? null,
          contractStatus: b.contractStatus,
          notes: b.notes ?? null,
          isActive: b.isActive,
        }))
      );
      return { imported: input.length };
    }),
});
