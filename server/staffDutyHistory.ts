import { eq } from "drizzle-orm";
import { jobApplicationActions } from "../drizzle/schema";

/** Retired assignment rows remain in storage as history, not current duties. */
export async function getRetiredClassAssignmentIds(db: any): Promise<Set<number>> {
  const actions: Array<{ details: string | null }> = await db.select({ details: jobApplicationActions.details })
    .from(jobApplicationActions).where(eq(jobApplicationActions.action, "staff_duties_retired"));
  const ids = new Set<number>();
  for (const action of actions) {
    try {
      const value = JSON.parse(action.details ?? "{}");
      if (Array.isArray(value.classAssignments)) {
        for (const assignment of value.classAssignments) {
          if (Number.isInteger(assignment.id)) ids.add(assignment.id);
        }
      }
    } catch { /* unrelated legacy audit content is not an assignment */ }
  }
  return ids;
}
