import { publicProcedure, router } from "../_core/trpc";
import { getUpcomingPublicClasses } from "../publicCalendar";

export const publicCalendarRouter = router({
  listUpcoming: publicProcedure.query(async () => {
    const classes = await getUpcomingPublicClasses();
    return { classes };
  }),
});
