import { ownerProcedure, router } from "../_core/trpc";
import { getDashboardOverview } from "../dashboardAnalytics";

/**
 * Private owner reporting. The payload is deliberately aggregate-only: no
 * customer, attendee, guest, payment, or social-account credentials leave the
 * server through this route.
 */
export const dashboardRouter = router({
  overview: ownerProcedure.query(async ({ ctx }) => {
    // The tRPC endpoint is a financial-data boundary. Keep browser and proxy
    // caches out of the path while retaining only the aggregate server cache.
    ctx.res.setHeader("Cache-Control", "private, no-store, max-age=0");
    ctx.res.setHeader("Pragma", "no-cache");
    return getDashboardOverview();
  }),
});
