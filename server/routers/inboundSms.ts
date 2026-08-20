/**
 * Inbound SMS Router
 *
 * Provides procedures for the admin SMS Inbox page:
 * - list: fetch all inbound SMS messages (newest first)
 * - markRead: mark a message as read
 * - markAllRead: mark all messages as read
 */
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { inboundSms } from "../../drizzle/schema";

export const inboundSmsRouter = router({
  list: staffProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(100),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 100;
      return db
        .select()
        .from(inboundSms)
        .orderBy(desc(inboundSms.receivedAt))
        .limit(limit);
    }),

  unreadCount: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return 0;
    const rows = await db
      .select({ id: inboundSms.id })
      .from(inboundSms)
      .where(eq(inboundSms.isRead, 0));
    return rows.length;
  }),

  markRead: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return;
      await db
        .update(inboundSms)
        .set({ isRead: 1 })
        .where(eq(inboundSms.id, input.id));
    }),

  markAllRead: staffProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return;
    await db.update(inboundSms).set({ isRead: 1 }).where(eq(inboundSms.isRead, 0));
  }),
});
