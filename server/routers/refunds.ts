import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { refunds, type Refund } from "../../drizzle/schema";
import { staffProcedure, router } from "../_core/trpc";

// ─── Shared validation ────────────────────────────────────────────────────────

const LOCATIONS = ["Hamilton", "Kitchener", "Oakville", "Other"] as const;
const REASONS = [
  "Customer request",
  "Event cancelled",
  "Event rescheduled",
  "Duplicate charge",
  "No show",
  "Medical / emergency",
  "Other",
] as const;
const METHODS = ["Stripe", "E-Transfer", "Cash", "Credit", "Other"] as const;
const STATUSES = ["Pending", "Processed", "Denied"] as const;

const refundInput = z.object({
  customerName: z.string().min(1).max(255),
  customerEmail: z.string().email().max(320).optional().or(z.literal("")),
  orderRef: z.string().max(255).optional().or(z.literal("")),
  eventName: z.string().max(255).optional().or(z.literal("")),
  location: z.enum(LOCATIONS),
  amountCents: z.number().int().min(1),
  reason: z.enum(REASONS),
  notes: z.string().max(2000).optional().or(z.literal("")),
  method: z.enum(METHODS),
  status: z.enum(STATUSES),
  requestedAt: z.number().int(),
  processedAt: z.number().int().optional().nullable(),
  processedBy: z.string().max(255).optional().or(z.literal("")),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const refundsRouter = router({
  /** List all refunds, newest first. Optional filters: status, location, date range */
  list: staffProcedure
    .input(
      z.object({
        status: z.enum(STATUSES).optional(),
        location: z.enum(LOCATIONS).optional(),
        fromDate: z.number().int().optional(),
        toDate: z.number().int().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(refunds.status, input.status));
      if (input?.location) conditions.push(eq(refunds.location, input.location));
      if (input?.fromDate) conditions.push(gte(refunds.requestedAt, input.fromDate));
      if (input?.toDate) conditions.push(lte(refunds.requestedAt, input.toDate));

      return db
        .select()
        .from(refunds)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(refunds.requestedAt));
    }),

  /** Get a single refund by ID */
  get: staffProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(refunds).where(eq(refunds.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Refund not found" });
      return row;
    }),

  /** Create a new refund record */
  create: staffProcedure
    .input(refundInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(refunds).values({
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        orderRef: input.orderRef || null,
        eventName: input.eventName || null,
        location: input.location,
        amountCents: input.amountCents,
        reason: input.reason,
        notes: input.notes || null,
        method: input.method,
        status: input.status,
        requestedAt: input.requestedAt,
        processedAt: input.processedAt ?? null,
        processedBy: input.processedBy || null,
      });
      return { id: (result as any).insertId as number };
    }),

  /** Update an existing refund */
  update: staffProcedure
    .input(z.object({ id: z.number().int() }).merge(refundInput))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(refunds).set({
        customerName: data.customerName,
        customerEmail: data.customerEmail || null,
        orderRef: data.orderRef || null,
        eventName: data.eventName || null,
        location: data.location,
        amountCents: data.amountCents,
        reason: data.reason,
        notes: data.notes || null,
        method: data.method,
        status: data.status,
        requestedAt: data.requestedAt,
        processedAt: data.processedAt ?? null,
        processedBy: data.processedBy || null,
      }).where(eq(refunds.id, id));
      return { success: true };
    }),

  /** Quick status update (mark as Processed / Denied) */
  updateStatus: staffProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(STATUSES),
        processedBy: z.string().max(255).optional(),
        processedAt: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(refunds).set({
        status: input.status,
        processedBy: input.processedBy || null,
        processedAt: input.status === "Processed" ? (input.processedAt ?? Date.now()) : null,
      }).where(eq(refunds.id, input.id));
      return { success: true };
    }),

  /** Delete a refund record */
  delete: staffProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(refunds).where(eq(refunds.id, input.id));
      return { success: true };
    }),

  /** Aggregate stats for the summary cards */
  stats: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {
      total: 0, pending: 0, processed: 0, denied: 0,
      totalAmountCents: 0, processedAmountCents: 0, pendingAmountCents: 0,
      byLocation: {}, byReason: {},
    };

    const rows: Refund[] = await db.select().from(refunds);
    const total = rows.length;
    const pending = rows.filter((r: Refund) => r.status === "Pending").length;
    const processed = rows.filter((r: Refund) => r.status === "Processed").length;
    const denied = rows.filter((r: Refund) => r.status === "Denied").length;
    const totalAmountCents = rows.reduce((sum: number, r: Refund) => sum + r.amountCents, 0);
    const processedAmountCents = rows
      .filter((r: Refund) => r.status === "Processed")
      .reduce((sum: number, r: Refund) => sum + r.amountCents, 0);
    const pendingAmountCents = rows
      .filter((r: Refund) => r.status === "Pending")
      .reduce((sum: number, r: Refund) => sum + r.amountCents, 0);

    const byLocation: Record<string, number> = {};
    for (const r of rows) {
      byLocation[r.location] = (byLocation[r.location] ?? 0) + 1;
    }

    const byReason: Record<string, number> = {};
    for (const r of rows) {
      byReason[r.reason] = (byReason[r.reason] ?? 0) + 1;
    }

    return {
      total,
      pending,
      processed,
      denied,
      totalAmountCents,
      processedAmountCents,
      pendingAmountCents,
      byLocation,
      byReason,
    };
  }),
});
