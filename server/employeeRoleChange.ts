import { and, eq, gte } from "drizzle-orm";
import {
  classStaffAssignments,
  jobApplicationActions,
  puppySchedule,
  weekendLeadershipCoverage,
} from "../drizzle/schema";
import { getTorontoCalendarDate } from "../shared/scheduleVisibility";
import { normalizeApyRole } from "../shared/apyPermissions";
import { buildRetirementHistoryEntries } from "./staffRetirementHistory";

/**
 * Future duties are stored with the role they were booked under. When an
 * employee moves to a different position, any upcoming duty their new role
 * cannot perform would otherwise remain on the schedule under a stale role.
 *
 * Class assignments are Puppy Monitor duties. Weekend leadership coverage is
 * either Operations Manager or Yoga Instructor. A move away from one of those
 * positions retires the matching upcoming duties, mirroring what already
 * happens when someone departs: the upcoming class assignment row is removed
 * from the schedule and preserved as an audit snapshot, while the leadership
 * row itself remains and becomes open coverage so the gap stays visible.
 *
 * The audit snapshot is the same bounded shape the departure path records. It
 * identifies what was retired; it is not a full-row restore mechanism.
 */

/** Duties a role is allowed to hold going forward. */
export function canHoldClassAssignment(role: string | null | undefined): boolean {
  return normalizeApyRole(role) === "puppy monitor";
}

export function canHoldLeadershipRole(
  role: string | null | undefined,
  coverageRole: string,
): boolean {
  return normalizeApyRole(role) === normalizeApyRole(coverageRole);
}

export type RoleChangeDutyOutcome = {
  retiredClassAssignments: number;
  releasedLeadershipCoverage: number;
};

/**
 * Call only inside withStaffingMutationLock, after the caller is authorized and
 * the new role has already been written.
 *
 * Returns counts so the caller can tell the owner what the move changed.
 */
export async function retireDutiesOutsideNewRole(
  tx: any,
  profileId: number,
  nextRole: string,
  actor?: { id: number; name: string | null; email: string | null },
): Promise<RoleChangeDutyOutcome> {
  const today = getTorontoCalendarDate();

  const [upcomingAssignments, upcomingCoverage] = await Promise.all([
    tx
      .select({
        id: classStaffAssignments.id,
        scheduleId: classStaffAssignments.scheduleId,
        staffId: classStaffAssignments.staffId,
        staffName: classStaffAssignments.staffName,
        classDate: puppySchedule.classDate,
      })
      .from(classStaffAssignments)
      .innerJoin(puppySchedule, eq(classStaffAssignments.scheduleId, puppySchedule.id))
      .where(
        and(
          eq(classStaffAssignments.staffId, profileId),
          gte(puppySchedule.classDate, today),
        ),
      ),
    tx
      .select({
        id: weekendLeadershipCoverage.id,
        coverageDate: weekendLeadershipCoverage.coverageDate,
        location: weekendLeadershipCoverage.location,
        role: weekendLeadershipCoverage.role,
        coverageStaffId: weekendLeadershipCoverage.coverageStaffId,
        coverageStaffName: weekendLeadershipCoverage.coverageStaffName,
      })
      .from(weekendLeadershipCoverage)
      .where(
        and(
          eq(weekendLeadershipCoverage.coverageStaffId, profileId),
          gte(weekendLeadershipCoverage.coverageDate, today),
        ),
      ),
  ]);

  // Keep only the duties the new role can no longer perform.
  const staleAssignments = canHoldClassAssignment(nextRole)
    ? []
    : (upcomingAssignments as Array<Record<string, unknown>>);
  const staleCoverage = (upcomingCoverage as Array<Record<string, unknown>>).filter(
    (coverage) => !canHoldLeadershipRole(nextRole, String(coverage.role)),
  );

  if (staleAssignments.length === 0 && staleCoverage.length === 0) {
    return { retiredClassAssignments: 0, releasedLeadershipCoverage: 0 };
  }

  for (const details of buildRetirementHistoryEntries(staleAssignments, staleCoverage)) {
    await tx.insert(jobApplicationActions).values({
      applicationId: profileId,
      action: "staff_duties_retired_role_change",
      actorUserId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      details,
    });
  }

  // Leadership rows become open coverage so the staffing gap stays visible.
  for (const coverage of staleCoverage) {
    await tx
      .update(weekendLeadershipCoverage)
      .set({ coverageStaffId: null, coverageStaffName: null })
      .where(eq(weekendLeadershipCoverage.id, coverage.id as number));
  }

  // Class assignment rows are removed from the upcoming schedule. The audit
  // entry above preserves exactly what was retired and who retired it.
  for (const assignment of staleAssignments) {
    await tx
      .delete(classStaffAssignments)
      .where(eq(classStaffAssignments.id, assignment.id as number));
  }

  return {
    retiredClassAssignments: staleAssignments.length,
    releasedLeadershipCoverage: staleCoverage.length,
  };
}
