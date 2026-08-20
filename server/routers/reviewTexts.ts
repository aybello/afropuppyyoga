import { z } from "zod";
import { router, staffProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reviewTextLogs } from "../../drizzle/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { reviewTextSender } from "../reviewTextSender";

export const reviewTextsRouter = router({
  /** List recent review text sends, optionally filtered by event */
  list: staffProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(100),
      lumaEventId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const query = db
        .select()
        .from(reviewTextLogs)
        .orderBy(desc(reviewTextLogs.createdAt))
        .limit(input?.limit ?? 100);
      return query;
    }),

  /** Summary stats: total sent, failed, unique events covered */
  stats: staffProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, sent: 0, failed: 0, events: 0 };
      const rows = await db.select().from(reviewTextLogs);
      const sent = rows.filter(r => r.status === "sent").length;
      const failed = rows.filter(r => r.status === "failed").length;
      const events = new Set(rows.map(r => r.lumaEventId)).size;
      return { total: rows.length, sent, failed, events };
    }),

  /** Manually trigger the review text sender (for testing / backfill) */
  triggerNow: staffProcedure
    .mutation(async () => {
      const result = await reviewTextSender();
      return result;
    }),
});
