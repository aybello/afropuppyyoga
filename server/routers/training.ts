import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { jobApplications, staffTrainingProgress } from "../../drizzle/schema";
import { modulesForRole, TRAINING_MODULES } from "../../shared/trainingCatalog";
import { getDb } from "../db";
import { adminProcedure, router, teamMemberProcedure } from "../_core/trpc";
import { isActiveTeamMember } from "../teamMembership";
import { resolveApyAccess } from "../apyAccess";

async function resolveTeamMember(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, email?: string | null) {
  if (!email) return null;
  const [person] = await db.select().from(jobApplications).where(and(
    isNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, true), eq(jobApplications.email, email.toLowerCase()),
  )).limit(1);
  return person && isActiveTeamMember(person) ? person : null;
}

export const trainingRouter = router({
  myTraining: teamMemberProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const access = await resolveApyAccess(ctx.user);
    const staff = access.teamMember;
    const modules = staff ? modulesForRole(staff.role) : access.level === "owner" ? TRAINING_MODULES : [];
    const progress = staff ? await db.select().from(staffTrainingProgress).where(eq(staffTrainingProgress.staffId, staff.id)) : [];
    return { staff: staff ? { id: staff.id, name: staff.name, role: staff.role } : null, modules, completedKeys: progress.map((item) => item.moduleKey), adminPreview: !staff && access.level === "owner", canManageTraining: access.canManageOperations };
  }),
  complete: teamMemberProcedure.input(z.object({ moduleKey: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const staff = (await resolveApyAccess(ctx.user)).teamMember;
    if (!staff) throw new Error("Your login is not linked to an active APY team profile.");
    if (!modulesForRole(staff.role).some((module) => module.key === input.moduleKey)) throw new Error("This module is not assigned to your role.");
    const [existing] = await db.select().from(staffTrainingProgress).where(and(eq(staffTrainingProgress.staffId, staff.id), eq(staffTrainingProgress.moduleKey, input.moduleKey))).limit(1);
    if (!existing) await db.insert(staffTrainingProgress).values({ staffId: staff.id, moduleKey: input.moduleKey, acknowledgedBy: ctx.user.email ?? null });
    return { success: true };
  }),
  /** Owner and Operations Managers can oversee completion without completing lessons for staff. */
  overview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const people = (await db.select().from(jobApplications).where(and(eq(jobApplications.isTeamMember, true), isNull(jobApplications.deletedAt)))).filter(isActiveTeamMember);
    const progress = await db.select().from(staffTrainingProgress);
    return people.map((person) => {
      const assigned = modulesForRole(person.role);
      const completed = progress.filter((item) => item.staffId === person.id && assigned.some((module) => module.key === item.moduleKey)).length;
      return { id: person.id, name: person.name, role: person.role, location: person.location, completed, total: assigned.length };
    });
  }),
});
