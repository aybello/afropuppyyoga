import { and, eq } from "drizzle-orm";
import { jobApplicationActions } from "../drizzle/schema";
import { hasValidReviewedIdentity, reviewedHiringRecordHash } from "./hiringDuplicateIdentity";

type Profile = { id: number; name: string; email: string | null; phone: string | null; role: string; location: string; status: string; isTeamMember: boolean | number | null; deletedAt: unknown };
type DirectoryEntry = { id: number; sourceApplicationId: number | null };
type Employee = DirectoryEntry;

const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const changed = () => new Error("Reviewed applicant history changed or is no longer safe. Review the conflicting records before activating login.");

/** Evidence excludes records from login resolution only; it never transfers or retires them. */
export async function reviewedHiringProfileIds(tx: any, employee: Employee, profiles: Profile[], directory: DirectoryEntry[]): Promise<Set<number>> {
  const ids = new Set<number>();
  if (employee.sourceApplicationId === null) return ids;
  const actions: Array<{ applicationId: number; action: string; details: string | null }> = await tx.select().from(jobApplicationActions)
    .where(and(eq(jobApplicationActions.applicationId, employee.sourceApplicationId), eq(jobApplicationActions.action, "employee_added_after_signature")));
  for (const action of actions) {
    // Verify the action as well as the evidence, even when a mock or adapter returns unrelated rows.
    if (action.applicationId !== employee.sourceApplicationId || action.action !== "employee_added_after_signature") continue;
    let details: any;
    try { details = JSON.parse(action.details ?? "null"); } catch { continue; }
    if (!details || typeof details !== "object" || Array.isArray(details) || details.employeeId !== employee.id || !("duplicateReview" in details)) continue;
    const review = details.duplicateReview;
    if (!review || typeof review !== "object" || Array.isArray(review) || review.version !== 2
      || review.canonicalApplicationId !== employee.sourceApplicationId || review.employeeId !== employee.id
      || !Array.isArray(review.reviewed) || review.reviewed.length === 0) throw changed();
    const seen = new Set<number>();
    for (const item of review.reviewed) {
      if (!item || typeof item !== "object" || Array.isArray(item) || !positiveId(item.applicationId)
        || item.applicationId === employee.sourceApplicationId || seen.has(item.applicationId)
        || typeof item.recordHash !== "string" || !/^[a-f0-9]{64}$/.test(item.recordHash)) throw changed();
      seen.add(item.applicationId);
      const record = profiles.find((profile) => profile.id === item.applicationId);
      if (!record) {
        // A missing record cannot collide or be granted access, but its ID must
        // not be claimed by an employee directory entry.
        if (directory.some((entry) => entry.sourceApplicationId === item.applicationId)) throw changed();
        continue;
      }
      if (!hasValidReviewedIdentity(record) || !(record.isTeamMember === false || record.isTeamMember === 0) || record.status === "onboarded"
        || directory.some((entry) => entry.sourceApplicationId === item.applicationId)
        || reviewedHiringRecordHash(record) !== item.recordHash) throw changed();
      ids.add(item.applicationId);
    }
  }
  return ids;
}
