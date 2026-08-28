import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { operationsProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { breederLeadFollowUps, inboundSms, jobApplications, privateEventInquiries, puppySchedule, refunds } from "../../drizzle/schema";
import { sortOperationsActions, torontoDate, type OperationsAction } from "../operationsDashboardHelpers";
import { getEventNotificationPreview } from "./puppySchedule";

export const operationsDashboardRouter = router({
  getRunApy: operationsProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const today = torontoDate();
    const horizon = torontoDate(14);
    const now = Date.now();

    const [schedules, newApplications, privateLeads, pendingRefunds, unreadMessages, overdueFollowUps] = await Promise.all([
      db.select().from(puppySchedule)
        .where(and(gte(puppySchedule.classDate, today), lte(puppySchedule.classDate, horizon)))
        .orderBy(asc(puppySchedule.classDate), asc(puppySchedule.startTime)),
      db.select({ id: jobApplications.id, name: jobApplications.name, role: jobApplications.role, location: jobApplications.location, createdAt: jobApplications.createdAt })
        .from(jobApplications)
        .where(and(isNull(jobApplications.deletedAt), eq(jobApplications.isTeamMember, false), eq(jobApplications.status, "new"))),
      db.select({ id: privateEventInquiries.id, name: privateEventInquiries.name, eventType: privateEventInquiries.eventType, preferredDate: privateEventInquiries.preferredDate, createdAt: privateEventInquiries.createdAt })
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.status, "new")),
      db.select({ id: refunds.id, customerName: refunds.customerName, requestedAt: refunds.requestedAt })
        .from(refunds)
        .where(eq(refunds.status, "Pending")),
      db.select({ id: inboundSms.id, breederName: inboundSms.breederName, fromPhone: inboundSms.fromPhone, receivedAt: inboundSms.receivedAt })
        .from(inboundSms)
        .where(eq(inboundSms.isRead, 0)),
      db.select({ id: breederLeadFollowUps.id, leadId: breederLeadFollowUps.leadId, dueAt: breederLeadFollowUps.dueAt, note: breederLeadFollowUps.note })
        .from(breederLeadFollowUps)
        .where(and(eq(breederLeadFollowUps.completed, false), lte(breederLeadFollowUps.dueAt, now))),
    ]);

    const readiness = await Promise.all(schedules.map(async (schedule) => {
      const preview = await getEventNotificationPreview(db, schedule.id);
      return {
        id: schedule.id,
        classDate: schedule.classDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        location: schedule.location,
        breed: schedule.breed,
        breederName: schedule.breederName,
        lumaEventUrl: schedule.lumaEventUrl,
        fullyStaffed: preview.fullyStaffed,
        gaps: preview.gapLabels,
        teamNotified: Boolean(preview.lastSentAt),
      };
    }));

    const actions: OperationsAction[] = [];
    for (const event of readiness.filter(item => !item.fullyStaffed)) {
      actions.push({
        id: `staff-${event.id}`,
        severity: event.classDate <= torontoDate(3) ? "critical" : "warning",
        title: `Staff ${event.location} on ${event.classDate}`,
        detail: `Missing ${event.gaps.join(", ")}`,
        href: "/admin/puppy-schedule",
      });
    }
    if (privateLeads.length) actions.push({ id: "private-leads", severity: "warning", title: `Respond to ${privateLeads.length} new private-event lead${privateLeads.length === 1 ? "" : "s"}`, detail: "New inquiries are waiting for qualification and a next step.", href: "/admin/private-events" });
    if (newApplications.length) actions.push({ id: "applications", severity: "normal", title: `Screen ${newApplications.length} new application${newApplications.length === 1 ? "" : "s"}`, detail: "Video-first applications are ready for review.", href: "/admin/applications" });
    if (unreadMessages.length) actions.push({ id: "sms", severity: "warning", title: `Read ${unreadMessages.length} inbound text${unreadMessages.length === 1 ? "" : "s"}`, detail: "Breeder and guest replies are waiting in the SMS inbox.", href: "/admin/sms-inbox" });
    if (pendingRefunds.length) actions.push({ id: "refunds", severity: "warning", title: `Resolve ${pendingRefunds.length} pending refund${pendingRefunds.length === 1 ? "" : "s"}`, detail: "Confirm the payment record before processing.", href: "/admin/refunds" });
    if (overdueFollowUps.length) actions.push({ id: "breeder-followups", severity: "normal", title: `Complete ${overdueFollowUps.length} breeder follow-up${overdueFollowUps.length === 1 ? "" : "s"}`, detail: "Due breeder-lead tasks need an outcome or a new date.", href: "/admin/breeder-leads" });

    return {
      today,
      metrics: {
        todayClasses: readiness.filter(item => item.classDate === today).length,
        next14Days: readiness.length,
        staffingGaps: readiness.filter(item => !item.fullyStaffed).length,
        unnotifiedTeams: readiness.filter(item => item.fullyStaffed && !item.teamNotified).length,
        newPrivateLeads: privateLeads.length,
        newApplications: newApplications.length,
        pendingRefunds: pendingRefunds.length,
        unreadMessages: unreadMessages.length,
      },
      actions: sortOperationsActions(actions),
      todaySchedule: readiness.filter(item => item.classDate === today),
      upcomingSchedule: readiness.filter(item => item.classDate !== today).slice(0, 12),
      lastUpdatedAt: new Date(),
    };
  }),
});
