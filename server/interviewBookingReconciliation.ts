import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { employees, jobApplicationActions, jobApplications, signingTokens } from "../drizzle/schema";
import type { getDb } from "./db";
import { countUnresolvedLegacyBookings, resolveBookingDecisions, type BookingCandidate, type BookingEvent } from "./interviewBookingDetection";

type BookingDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type BookingActor = { id: number; name: string | null; email: string | null };

function readSyncDetails(details: string | null): Pick<BookingCandidate, "interviewEventId" | "interviewLastEventAt"> & { advanceWatermark?: boolean } {
  if (!details) return { interviewEventId: null, interviewLastEventAt: null };
  try {
    const parsed: unknown = JSON.parse(details);
    if (!parsed || typeof parsed !== "object") return { interviewEventId: null, interviewLastEventAt: null };
    const metadata = parsed as Record<string, unknown>;
    const receivedAt = typeof metadata.eventReceivedAt === "string" ? new Date(metadata.eventReceivedAt) : null;
    return {
      interviewEventId: typeof metadata.eventId === "string" ? metadata.eventId : null,
      interviewLastEventAt: receivedAt && Number.isFinite(receivedAt.getTime()) ? receivedAt : null,
      advanceWatermark: metadata.advanceWatermark !== false,
    };
  } catch {
    // Older timeline entries did not contain a sync watermark.
    return { interviewEventId: null, interviewLastEventAt: null };
  }
}

/**
 * Mailbox acquisition happens before this function. Every database read, the
 * fresh-state resolution, booking update and audit write share one transaction.
 * Locking reads serialize overlapping syncs and prevent a previously observed
 * interview status from overwriting a newer hiring decision.
 */
export async function reconcileInterviewBookings(
  db: BookingDatabase,
  events: readonly BookingEvent[],
  actor: BookingActor,
): Promise<{ booked: number; cleared: number; checked: number; unresolved: number }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: jobApplications.id,
        email: jobApplications.email,
        status: jobApplications.status,
        interviewBookedAt: jobApplications.interviewBookedAt,
        interviewSlotLabel: jobApplications.interviewSlotLabel,
        createdAt: jobApplications.createdAt,
      })
      .from(jobApplications)
      .where(and(
        inArray(jobApplications.status, ["interview_requested", "interview_scheduled"]),
        eq(jobApplications.isTeamMember, false),
        isNull(jobApplications.onboardingSentAt),
        isNull(jobApplications.onboardingDeliveryToken),
        isNull(jobApplications.deletedAt),
      ))
      .orderBy(jobApplications.id)
      .for("update");

    if (rows.length === 0) return { booked: 0, cleared: 0, checked: 0, unresolved: 0 };
    const candidateIds = rows.map((row) => row.id);
    // Any offer/signing history or employee link disqualifies an application,
    // including unsigned/expired tokens and inactive employee directory rows.
    const signingRows = await tx.select({ applicationId: signingTokens.applicationId })
      .from(signingTokens)
      .where(inArray(signingTokens.applicationId, candidateIds))
      .for("update");
    const employeeRows = await tx.select({ applicationId: employees.sourceApplicationId })
      .from(employees)
      .where(inArray(employees.sourceApplicationId, candidateIds))
      .for("update");
    const excludedIds = new Set([
      ...signingRows.map((row) => row.applicationId),
      ...employeeRows.map((row) => row.applicationId),
    ]);
    const eligibleRows = rows.filter((row) => !excludedIds.has(row.id));
    if (eligibleRows.length === 0) return { booked: 0, cleared: 0, checked: 0, unresolved: 0 };

    const actions = await tx.select({
      applicationId: jobApplicationActions.applicationId,
      action: jobApplicationActions.action,
      details: jobApplicationActions.details,
      createdAt: jobApplicationActions.createdAt,
    })
      .from(jobApplicationActions)
      .where(and(
        inArray(jobApplicationActions.applicationId, eligibleRows.map((row) => row.id)),
        inArray(jobApplicationActions.action, ["interview_invite_sent", "interview_booking_detected", "interview_booking_cancelled"]),
      ))
      .orderBy(desc(jobApplicationActions.createdAt), desc(jobApplicationActions.id))
      .for("update");

    const latestInvites = new Map<number, Date>();
    const latestSyncs = new Map<number, ReturnType<typeof readSyncDetails>>();
    const canceledEvents = new Map<number, Map<string, Date>>();
    for (const action of actions) {
      if (action.action === "interview_invite_sent") {
        if (!latestInvites.has(action.applicationId)) latestInvites.set(action.applicationId, action.createdAt);
      } else {
        const details = readSyncDetails(action.details);
        if (details.advanceWatermark !== false && !latestSyncs.has(action.applicationId)) {
          latestSyncs.set(action.applicationId, details);
        }
        if (action.action === "interview_booking_cancelled" && details.interviewEventId && details.interviewLastEventAt) {
          const ledger = canceledEvents.get(action.applicationId) ?? new Map<string, Date>();
          const previous = ledger.get(details.interviewEventId);
          if (!previous || previous < details.interviewLastEventAt) ledger.set(details.interviewEventId, details.interviewLastEventAt);
          canceledEvents.set(action.applicationId, ledger);
        }
      }
    }
    const candidates: BookingCandidate[] = eligibleRows.map((row) => ({
      ...row,
      interviewInviteSentAt: latestInvites.get(row.id) ?? row.createdAt,
      ...latestSyncs.get(row.id),
      interviewCanceledEvents: Array.from(canceledEvents.get(row.id) ?? [], ([eventId, receivedAt]) => ({ eventId, receivedAt })),
    }));
    const candidatesById = new Map(eligibleRows.map((candidate) => [candidate.id, candidate]));
    const decisions = resolveBookingDecisions(events, candidates);
    let booked = 0;
    let cleared = 0;
    const appliedDecisions: typeof decisions = [];
    for (const decision of decisions) {
      const candidate = candidatesById.get(decision.applicationId);
      if (!candidate) continue;
      const status = decision.action === "record_notice" ? candidate.status
        : decision.action === "mark_booked" ? "interview_scheduled" : "interview_requested";
      if (decision.action !== "record_notice") {
        const update = await tx.update(jobApplications)
          .set(decision.action === "mark_booked"
            ? { status, interviewBookedAt: decision.bookedAt, interviewSlotLabel: decision.slotLabel || null }
            : { status, interviewBookedAt: null, interviewSlotLabel: null })
          .where(and(
            eq(jobApplications.id, candidate.id),
            eq(jobApplications.status, candidate.status),
            eq(jobApplications.isTeamMember, false),
            isNull(jobApplications.onboardingSentAt),
            isNull(jobApplications.onboardingDeliveryToken),
            isNull(jobApplications.deletedAt),
          ));
        if (Number(update[0].affectedRows) !== 1) continue;
      }

      // Do not use the best-effort email audit helper here: an audit failure
      // must abort and roll back every booking change from this sync.
      await tx.insert(jobApplicationActions).values({
        applicationId: candidate.id,
        action: decision.action === "mark_booked" ? "interview_booking_detected" : "interview_booking_cancelled",
        fromStatus: candidate.status,
        toStatus: status,
        actorUserId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        details: JSON.stringify({
          source: "calendar_confirmation",
          ...(decision.action === "mark_booked" ? { slot: decision.slotLabel } : {}),
          eventId: decision.eventId,
          eventReceivedAt: decision.receivedAt.toISOString(),
          ...(decision.action !== "mark_booked" ? { advanceWatermark: false } : {}),
        }),
      });
      appliedDecisions.push(decision);
      if (decision.action === "mark_booked") booked += 1;
      else if (decision.action === "clear_booking") cleared += 1;
    }
    return { booked, cleared, checked: candidates.length, unresolved: countUnresolvedLegacyBookings(candidates, appliedDecisions) };
  });
}
