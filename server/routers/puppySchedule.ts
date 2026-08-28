import { z } from "zod";
import { staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { puppySchedule, breeders, classStaffAssignments, jobApplications, staffAvailability, weekendLeadershipCoverage } from "../../drizzle/schema";
import { staffScheduleNotifications } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, isNull, ne } from "drizzle-orm";
import { sendEmail, buildBreederConfirmationEmail } from "../email";
import twilio from "twilio";
import { isSmsSuppressed } from "../smsConsent";
import { createLumaEventForSchedule, setLumaRegistrationOpen, updateLumaEventForSchedule } from "../lumaScheduleHelper";
import { isAwayOnDate } from "../weekendCoverage";
import { isClassFullyStaffed, scheduleLocationToTeamLocation, staffingGaps, TWO_PUPPY_MONITORS_REQUIRED } from "../classStaffing";
import { isActiveTeamMember } from "../teamMembership";
import { schedulesOverlap, validateScheduleCandidate } from "../scheduleValidation";

const LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const WEEKEND_DAYS = ["Saturday", "Sunday"] as const;

/** Zod type for HH:MM 24-hour time strings */
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format");

function friendlyDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export async function getEventNotificationPreview(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, scheduleId: number) {
  const [schedule] = await db.select().from(puppySchedule).where(eq(puppySchedule.id, scheduleId)).limit(1);
  if (!schedule) throw new Error("Scheduled class not found");
  if (schedule.scheduleStatus !== "scheduled") throw new Error(`This class is ${schedule.scheduleStatus} and cannot receive schedule notifications.`);
  const teamLocation = scheduleLocationToTeamLocation(schedule.location);
  const [team, leaves, coverage, pmAssignments, priorNotifications] = await Promise.all([
    db.select({ id: jobApplications.id, name: jobApplications.name, email: jobApplications.email, phone: jobApplications.phone, role: jobApplications.role, location: jobApplications.location, status: jobApplications.status, isTeamMember: jobApplications.isTeamMember, deletedAt: jobApplications.deletedAt })
      .from(jobApplications).where(and(isNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, true))),
    db.select().from(staffAvailability).where(and(lte(staffAvailability.startDate, schedule.classDate), gte(staffAvailability.endDate, schedule.classDate))),
    db.select().from(weekendLeadershipCoverage).where(and(eq(weekendLeadershipCoverage.coverageDate, schedule.classDate), eq(weekendLeadershipCoverage.location, teamLocation))),
    db.select().from(classStaffAssignments).where(eq(classStaffAssignments.scheduleId, scheduleId)),
    db.select().from(staffScheduleNotifications).where(eq(staffScheduleNotifications.scheduleId, scheduleId)).orderBy(desc(staffScheduleNotifications.sentAt)),
  ]);
  const active = team.filter(isActiveTeamMember);
  const awayIds = new Set(leaves.map((leave) => leave.staffId));
  const sameRole = (actual: string, expected: string) => actual === expected || actual === expected.toLowerCase().replaceAll(" ", "_");
  const leader = (role: "Operations Manager" | "Yoga Instructor") => {
    const covered = coverage.find((item) => item.role === role && item.coverageStaffId);
    return covered?.coverageStaffId
      ? active.find((person) => person.id === covered.coverageStaffId) ?? null
      : active.find((person) => person.location === teamLocation && sameRole(person.role, role) && !awayIds.has(person.id)) ?? null;
  };
  const recipients = [
    { person: leader("Operations Manager"), role: "Operations Manager" },
    { person: leader("Yoga Instructor"), role: "Yoga Instructor" },
    ...pmAssignments.map((assignment) => ({ person: active.find((person) => person.id === assignment.staffId) ?? null, role: "Puppy Monitor" })),
  ].filter((item): item is { person: NonNullable<typeof item.person>; role: string } => Boolean(item.person))
    .map(({ person, role }) => ({ id: person.id, name: person.name, email: person.email, phone: person.phone, role }));
  const gaps = staffingGaps({ operationsManager: recipients.some((r) => r.role === "Operations Manager"), yogaInstructor: recipients.some((r) => r.role === "Yoga Instructor"), puppyMonitorCount: recipients.filter((r) => r.role === "Puppy Monitor").length });
  const gapLabels = [gaps.operationsManager ? "Operations Manager" : null, gaps.yogaInstructor ? "Yoga Instructor" : null, gaps.puppyMonitors ? `${gaps.puppyMonitors} Puppy Monitor${gaps.puppyMonitors === 1 ? "" : "s"}` : null].filter((value): value is string => Boolean(value));
  const dateLabel = friendlyDate(schedule.classDate);
  const message = `Hi [Name], you are scheduled as [Role] for AfroPuppyYoga on ${dateLabel} in ${schedule.location}. Event: ${schedule.breed}. Time: ${schedule.startTime}–${schedule.endTime}. Please reply to confirm you received this schedule.`;
  return { schedule, recipients, gaps, gapLabels, fullyStaffed: gapLabels.length === 0, message, lastSentAt: priorNotifications[0]?.sentAt ?? null };
}

/** Shared slot input shape — used for both create and update */
const slotInputBase = z.object({
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  dayOfWeek: z.enum(ALL_DAYS),
  location: z.enum(LOCATIONS),
  breed: z.string().min(1),
  breederId: z.number().int().positive(),
  breederName: z.string().min(1),
  startTime: timeString.default("09:00"),
  endTime: timeString.default("15:00"),
  classType: z.enum(["regular", "private"]).default("regular"),
  notes: z.string().optional(),
});

type SlotInput = z.infer<typeof slotInputBase>;
type ScheduleDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function assertNoScheduleConflict(db: ScheduleDb, candidate: SlotInput, excludeId?: number) {
  const sameStudioDay = await db.select({
    id: puppySchedule.id,
    classDate: puppySchedule.classDate,
    location: puppySchedule.location,
    startTime: puppySchedule.startTime,
    endTime: puppySchedule.endTime,
  }).from(puppySchedule).where(and(
    eq(puppySchedule.classDate, candidate.classDate),
    eq(puppySchedule.location, candidate.location),
    eq(puppySchedule.scheduleStatus, "scheduled"),
  ));
  const conflict = sameStudioDay.find(existing => existing.id !== excludeId && schedulesOverlap(existing, candidate));
  if (conflict) throw new Error(`This overlaps another ${candidate.location} class on ${candidate.classDate} (${conflict.startTime}–${conflict.endTime}).`);
}

async function createScheduleRecord(db: ScheduleDb, input: SlotInput) {
  validateScheduleCandidate(input);
  await assertNoScheduleConflict(db, input);
  const lumaResult = input.classType === "regular" ? await createLumaEventForSchedule(input) : null;
  if (input.classType === "regular" && !lumaResult) {
    throw new Error("Luma did not create the public event, so APY HQ did not save the class. Check the Luma connection and try again.");
  }

  try {
    const [inserted] = await db.insert(puppySchedule).values({
      ...input,
      notes: input.notes ?? null,
      lumaEventId: lumaResult?.lumaEventId ?? null,
      lumaEventUrl: lumaResult?.lumaEventUrl ?? null,
      lumaSyncStatus: lumaResult ? "synced" : "not_required",
      lumaSyncedAt: lumaResult ? new Date() : null,
    }).$returningId();
    return { success: true, id: inserted?.id, lumaEventUrl: lumaResult?.lumaEventUrl ?? null, lumaSynchronized: Boolean(lumaResult) };
  } catch (error) {
    if (lumaResult) await setLumaRegistrationOpen(lumaResult.lumaEventId, false).catch(() => undefined);
    throw error;
  }
}

async function updateScheduleRecord(db: ScheduleDb, id: number, fields: Partial<Omit<SlotInput, "notes">> & { notes?: string | null }) {
  const [existing] = await db.select().from(puppySchedule).where(eq(puppySchedule.id, id)).limit(1);
  if (!existing || existing.scheduleStatus === "archived") throw new Error("Scheduled class not found.");
  if (existing.scheduleStatus !== "scheduled") throw new Error("Only scheduled classes can be edited.");
  const candidate: SlotInput = {
    classDate: fields.classDate ?? existing.classDate,
    dayOfWeek: fields.dayOfWeek ?? existing.dayOfWeek,
    location: fields.location ?? existing.location,
    breed: fields.breed ?? existing.breed,
    breederId: fields.breederId ?? existing.breederId,
    breederName: fields.breederName ?? existing.breederName,
    startTime: fields.startTime ?? existing.startTime,
    endTime: fields.endTime ?? existing.endTime,
    classType: fields.classType ?? existing.classType,
    notes: "notes" in fields ? fields.notes ?? undefined : existing.notes ?? undefined,
  };
  validateScheduleCandidate(candidate);
  await assertNoScheduleConflict(db, candidate, id);

  if (existing.lumaEventId && candidate.classType !== "regular") {
    throw new Error("This class is public on Luma. Cancel it through Cancel Class before converting or archiving it.");
  }

  let createdLuma: Awaited<ReturnType<typeof createLumaEventForSchedule>> = null;
  if (existing.lumaEventId) {
    await updateLumaEventForSchedule(existing.lumaEventId, candidate);
  } else if (candidate.classType === "regular") {
    createdLuma = await createLumaEventForSchedule(candidate);
    if (!createdLuma) throw new Error("Luma did not create the public event, so APY HQ kept the existing schedule unchanged.");
  }

  const update = {
    ...fields,
    notes: "notes" in fields ? fields.notes ?? null : undefined,
    lumaEventId: createdLuma?.lumaEventId ?? existing.lumaEventId,
    lumaEventUrl: createdLuma?.lumaEventUrl ?? existing.lumaEventUrl,
    lumaSyncStatus: candidate.classType === "private" ? "not_required" as const : "synced" as const,
    lumaSyncedAt: candidate.classType === "regular" ? new Date() : null,
  };
  try {
    await db.update(puppySchedule).set(update).where(eq(puppySchedule.id, id));
  } catch (error) {
    if (createdLuma) await setLumaRegistrationOpen(createdLuma.lumaEventId, false).catch(() => undefined);
    else if (existing.lumaEventId) await updateLumaEventForSchedule(existing.lumaEventId, {
      classDate: existing.classDate,
      location: existing.location,
      breed: existing.breed,
      startTime: existing.startTime,
      endTime: existing.endTime,
      classType: existing.classType,
    }).catch(() => undefined);
    throw error;
  }
  return { success: true, lumaEventUrl: createdLuma?.lumaEventUrl ?? existing.lumaEventUrl, lumaSynchronized: candidate.classType === "regular" };
}

async function archiveScheduleRecord(db: ScheduleDb, id: number) {
  const [existing] = await db.select().from(puppySchedule).where(eq(puppySchedule.id, id)).limit(1);
  if (!existing || existing.scheduleStatus === "archived") throw new Error("Scheduled class not found.");
  if (existing.lumaEventId && existing.scheduleStatus !== "cancelled") {
    throw new Error("This class is still linked to Luma. Cancel it through Cancel Class before archiving the APY HQ record.");
  }
  await db.update(puppySchedule).set({ scheduleStatus: "archived", archivedAt: new Date() }).where(eq(puppySchedule.id, id));
  return { success: true };
}

export const puppyScheduleRouter = router({
  // ─── Legacy list (used by BreedersDashboard schedule tab) ─────────────────
  /** List all schedule entries, newest first — staff/admin only */
  list: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(puppySchedule).where(ne(puppySchedule.scheduleStatus, "archived")).orderBy(desc(puppySchedule.classDate));
  }),

  // The operational view: breeder/class calendar plus leadership and Puppy Monitor coverage.
  listWithStaffing: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const schedules = await db.select().from(puppySchedule).where(eq(puppySchedule.scheduleStatus, "scheduled")).orderBy(desc(puppySchedule.classDate));
    if (!schedules.length) return [];
    const earliestDate = schedules.reduce((earliest, schedule) => schedule.classDate < earliest ? schedule.classDate : earliest, schedules[0].classDate);
    const [assignments, staff, leaves, leadershipCoverage] = await Promise.all([
      db.select().from(classStaffAssignments),
      db.select({ id: jobApplications.id, name: jobApplications.name, role: jobApplications.role, location: jobApplications.location, status: jobApplications.status, isTeamMember: jobApplications.isTeamMember, deletedAt: jobApplications.deletedAt })
        .from(jobApplications)
        .where(and(isNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, true))),
      db.select().from(staffAvailability).where(gte(staffAvailability.endDate, earliestDate)),
      db.select().from(weekendLeadershipCoverage).where(gte(weekendLeadershipCoverage.coverageDate, earliestDate)),
    ]);
    const activeStaff = staff.filter(isActiveTeamMember);
    const sameRole = (role: string, expected: string) => role === expected || role === expected.toLowerCase().replaceAll(" ", "_");

    return schedules.map((schedule) => {
      const location = scheduleLocationToTeamLocation(schedule.location);
      const assignmentRows = assignments.filter((assignment) => assignment.scheduleId === schedule.id);
      const assignedIds = new Set(assignmentRows.map((assignment) => assignment.staffId));
      const isAway = (staffId: number) => leaves.some((leave) => leave.staffId === staffId && isAwayOnDate(leave, schedule.classDate));
      const resolveLeader = (role: "Operations Manager" | "Yoga Instructor") => {
        const coverage = leadershipCoverage.find((item) => item.coverageDate === schedule.classDate && item.location === location && item.role === role && item.coverageStaffId);
        if (coverage?.coverageStaffId) return { id: coverage.coverageStaffId, name: coverage.coverageStaffName ?? "Assigned cover", isCover: true };
        const primary = activeStaff.find((person) => person.location === location && sameRole(person.role, role));
        return primary && !isAway(primary.id) ? { id: primary.id, name: primary.name, isCover: false } : null;
      };
      const operationsManager = resolveLeader("Operations Manager");
      const yogaInstructor = resolveLeader("Yoga Instructor");
      const assignedPuppyMonitors = assignmentRows.map((assignment) => ({ id: assignment.id, staffId: assignment.staffId, name: assignment.staffName }));
      const eligiblePuppyMonitors = activeStaff
        .filter((person) => person.location === location && sameRole(person.role, "Puppy Monitor"))
        .filter((person) => !isAway(person.id) && !assignedIds.has(person.id))
        .map((person) => ({ id: person.id, name: person.name }));
      const gaps = staffingGaps({ operationsManager: Boolean(operationsManager), yogaInstructor: Boolean(yogaInstructor), puppyMonitorCount: assignedPuppyMonitors.length });
      return {
        ...schedule,
        staffing: {
          operationsManager,
          yogaInstructor,
          assignedPuppyMonitors,
          eligiblePuppyMonitors,
          requiredPuppyMonitors: TWO_PUPPY_MONITORS_REQUIRED,
          gaps,
          fullyStaffed: isClassFullyStaffed({ operationsManager: Boolean(operationsManager), yogaInstructor: Boolean(yogaInstructor), puppyMonitorCount: assignedPuppyMonitors.length }),
        },
      };
    });
  }),

  eventNotificationPreview: staffProcedure
    .input(z.object({ scheduleId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return getEventNotificationPreview(db, input.scheduleId);
    }),

  notifyEventTeam: staffProcedure
    .input(z.object({ scheduleId: z.number().int().positive(), resend: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const preview = await getEventNotificationPreview(db, input.scheduleId);
      if (!preview.fullyStaffed) throw new Error(`Finish staffing this event first: ${preview.gapLabels.join(", ")}.`);
      if (preview.lastSentAt && !input.resend) throw new Error("This team was already notified. Choose Resend if you want to send the schedule again.");
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_PHONE_NUMBER;
      const smsClient = accountSid && authToken && from ? twilio(accountSid, authToken) : null;
      const dateLabel = friendlyDate(preview.schedule.classDate);
      const subject = `You're scheduled — APY ${preview.schedule.location}, ${dateLabel}`;
      const results = [];
      for (const recipient of preview.recipients) {
        const body = preview.message.replace("[Name]", recipient.name.split(" ")[0]).replace("[Role]", recipient.role);
        let emailStatus = recipient.email ? "failed" : "missing";
        let smsStatus = recipient.phone ? "failed" : "missing";
        let smsSid: string | null = null;
        const errors: string[] = [];
        if (recipient.email) {
          try {
            await sendEmail({ to: recipient.email, subject, text: body, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2 style="color:#8B2252">You're on the APY team for this event</h2><p>${body}</p><p><strong>Date:</strong> ${dateLabel}<br/><strong>Location:</strong> ${preview.schedule.location}<br/><strong>Role:</strong> ${recipient.role}<br/><strong>Event:</strong> ${preview.schedule.breed}<br/><strong>Time:</strong> ${preview.schedule.startTime}–${preview.schedule.endTime}</p><p>Please reply to confirm you received your schedule.</p></div>` });
            emailStatus = "sent";
          } catch (error) { errors.push(`Email: ${error instanceof Error ? error.message : "failed"}`); }
        }
        if (recipient.phone && await isSmsSuppressed(recipient.phone)) {
          smsStatus = "suppressed";
        } else if (recipient.phone && smsClient && from) {
          try {
            const sent = await smsClient.messages.create({ to: recipient.phone, from, body });
            smsSid = sent.sid;
            smsStatus = "sent";
          } catch (error) { errors.push(`SMS: ${error instanceof Error ? error.message : "failed"}`); }
        } else if (recipient.phone && !smsClient) {
          smsStatus = "not_configured";
          errors.push("SMS: Twilio is not configured");
        }
        await db.insert(staffScheduleNotifications).values({ scheduleId: input.scheduleId, staffId: recipient.id, staffName: recipient.name, role: recipient.role, emailStatus, smsStatus, smsSid, errorMessage: errors.join(" | ") || null, sentBy: ctx.user.email ?? ctx.user.name ?? null });
        results.push({ staffId: recipient.id, name: recipient.name, emailStatus, smsStatus, errors });
      }
      return { success: results.every((r) => r.emailStatus === "sent" || r.smsStatus === "sent"), results };
    }),

  assignPuppyMonitor: staffProcedure
    .input(z.object({ scheduleId: z.number().int().positive(), staffId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [schedule] = await db.select().from(puppySchedule).where(eq(puppySchedule.id, input.scheduleId)).limit(1);
      if (!schedule) throw new Error("Scheduled class not found");
      const [staffMember] = await db.select({ id: jobApplications.id, name: jobApplications.name, role: jobApplications.role, location: jobApplications.location, status: jobApplications.status, isTeamMember: jobApplications.isTeamMember, deletedAt: jobApplications.deletedAt })
        .from(jobApplications).where(eq(jobApplications.id, input.staffId)).limit(1);
      if (!staffMember || !isActiveTeamMember(staffMember)) throw new Error("Choose an active APY HQ team member.");
      if (staffMember.role !== "Puppy Monitor" && staffMember.role !== "puppy_monitor") throw new Error("Only Puppy Monitors can be assigned to this requirement.");
      if (staffMember.location !== scheduleLocationToTeamLocation(schedule.location)) throw new Error("Choose a Puppy Monitor assigned to this studio.");
      const [away] = await db.select().from(staffAvailability).where(and(eq(staffAvailability.staffId, staffMember.id), lte(staffAvailability.startDate, schedule.classDate), gte(staffAvailability.endDate, schedule.classDate))).limit(1);
      if (away) throw new Error(`${staffMember.name} is unavailable on this class date.`);
      const existing = await db.select().from(classStaffAssignments).where(eq(classStaffAssignments.scheduleId, input.scheduleId));
      if (existing.some((assignment) => assignment.staffId === staffMember.id)) throw new Error(`${staffMember.name} is already assigned to this class.`);
      if (existing.length >= TWO_PUPPY_MONITORS_REQUIRED) throw new Error(`This class already has its required ${TWO_PUPPY_MONITORS_REQUIRED} Puppy Monitors.`);
      await db.insert(classStaffAssignments).values({ scheduleId: input.scheduleId, staffId: staffMember.id, staffName: staffMember.name, role: "Puppy Monitor" });
      return { success: true };
    }),

  removePuppyMonitorAssignment: staffProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(classStaffAssignments).where(eq(classStaffAssignments.id, input.id));
      return { success: true };
    }),

  // ─── Calendar procedures ──────────────────────────────────────────────────

  /**
   * List all slots for a given calendar month.
   * Returns every slot where classDate is within [YYYY-MM-01, YYYY-MM-last].
   */
  listByMonth: staffProcedure
    .input(z.object({
      year: z.number().int().min(2024).max(2100),
      month: z.number().int().min(1).max(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { year, month } = input;
      const pad = (n: number) => String(n).padStart(2, "0");
      const firstDay = `${year}-${pad(month)}-01`;
      // Last day: go to first day of next month minus 1
      const lastDate = new Date(year, month, 0); // day 0 of next month = last day of this month
      const lastDay = `${year}-${pad(month)}-${pad(lastDate.getDate())}`;
      return db
        .select()
        .from(puppySchedule)
        .where(and(
          gte(puppySchedule.classDate, firstDay),
          lte(puppySchedule.classDate, lastDay),
          ne(puppySchedule.scheduleStatus, "archived"),
        ))
        .orderBy(puppySchedule.classDate, puppySchedule.startTime);
    }),

  /** Create a new schedule slot — staff/admin only */
  createSlot: staffProcedure
    .input(slotInputBase)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return createScheduleRecord(db, input);
    }),

  /** Update an existing schedule slot — staff/admin only */
  updateSlot: staffProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(slotInputBase.partial()))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...fields } = input;
      return updateScheduleRecord(db, id, fields);
    }),

  /** Delete a schedule slot — staff/admin only */
  deleteSlot: staffProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return archiveScheduleRecord(db, input.id);
    }),

  /**
   * Send a class confirmation email to the breeder assigned to a slot.
   * Looks up the breeder's email from the breeders table.
   */
  notifyBreeder: staffProcedure
    .input(z.object({ slotId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch the slot
      const [slot] = await db.select().from(puppySchedule).where(eq(puppySchedule.id, input.slotId)).limit(1);
      if (!slot) throw new Error("Slot not found");

      // Fetch the breeder's email
      const [breeder] = await db.select().from(breeders).where(eq(breeders.id, slot.breederId)).limit(1);
      if (!breeder) throw new Error("Breeder not found");
      if (!breeder.email) throw new Error(`Breeder "${breeder.name}" has no email address on file. Please add one in the Breeder Database first.`);

      const { subject, html, text } = buildBreederConfirmationEmail({
        breederName: breeder.name,
        contactName: breeder.contactName,
        breed: slot.breed,
        classDate: slot.classDate,
        dayOfWeek: slot.dayOfWeek,
        location: slot.location,
        startTime: slot.startTime,
        endTime: slot.endTime,
        classType: slot.classType as "regular" | "private",
        notes: slot.notes,
      });

      await sendEmail({ to: breeder.email, subject, html, text });
      return { success: true, sentTo: breeder.email };
    }),

  /**
   * Create recurring weekly slots for every occurrence of the same weekday
   * within the given month. Skips dates that already have a slot at the same
   * location (to avoid duplicates).
   */
  createRecurringSlots: staffProcedure
    .input(slotInputBase.extend({
      year: z.number().int().min(2024).max(2100),
      month: z.number().int().min(1).max(12),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { year, month, ...slotBase } = input;
      const pad = (n: number) => String(n).padStart(2, "0");

      // Find all dates in the month that match the same day-of-week as classDate
      const targetDate = new Date(slotBase.classDate + "T12:00:00");
      const targetDow = targetDate.getDay(); // 0=Sun … 6=Sat
      const daysInMonth = new Date(year, month, 0).getDate();

      const datesToCreate: string[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const candidate = new Date(year, month - 1, d);
        if (candidate.getDay() === targetDow) {
          datesToCreate.push(`${year}-${pad(month)}-${pad(d)}`);
        }
      }

      // Use the same validation, conflict detection and Luma provisioning as a
      // one-off class. A recurring batch must never create local-only events.
      let created = 0;
      let skipped = 0;
      const failures: Array<{ date: string; error: string }> = [];
      for (const dateStr of datesToCreate) {
        const d = new Date(dateStr + "T12:00:00");
        const DOW_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
        try {
          await createScheduleRecord(db, { ...slotBase, classDate: dateStr, dayOfWeek: DOW_NAMES[d.getDay()] });
          created++;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not create class";
          if (message.includes("overlaps another")) skipped++;
          else failures.push({ date: dateStr, error: message });
        }
      }

      return { success: failures.length === 0, created, skipped, failures };
    }),

  // ─── Legacy CRUD (kept for backward compat with BreedersDashboard) ────────

  /** Create a new schedule entry — staff/admin only */
  create: staffProcedure
    .input(
      z.object({
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        dayOfWeek: z.enum(ALL_DAYS),
        location: z.enum(LOCATIONS),
        breed: z.string().min(1),
        breederId: z.number().int().positive(),
        breederName: z.string().min(1),
        startTime: timeString.optional(),
        endTime: timeString.optional(),
        classType: z.enum(["regular", "private"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return createScheduleRecord(db, {
        ...input,
        startTime: input.startTime ?? "09:00",
        endTime: input.endTime ?? "15:00",
        classType: input.classType ?? "regular",
      });
    }),

  /** Update an existing schedule entry — staff/admin only */
  update: staffProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dayOfWeek: z.enum(ALL_DAYS).optional(),
        location: z.enum(LOCATIONS).optional(),
        breed: z.string().min(1).optional(),
        breederId: z.number().int().positive().optional(),
        breederName: z.string().min(1).optional(),
        startTime: timeString.optional(),
        endTime: timeString.optional(),
        classType: z.enum(["regular", "private"]).optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...fields } = input;
      return updateScheduleRecord(db, id, fields);
    }),

  /** Delete a schedule entry — staff/admin only */
  delete: staffProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return archiveScheduleRecord(db, input.id);
    }),
});
