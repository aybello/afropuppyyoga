/** Pure interpretation of authenticated APY Google Calendar appointment notices. */
export const BOOKED_SUBJECT_PREFIX = "Appointment booked:";
export const CANCELED_SUBJECT_PREFIX = "Appointment canceled:";
export const APY_APPOINTMENT_TITLE = "AfroPuppyYoga Meeting";
export const APY_MAILBOX = "afropuppyyoga@gmail.com";

export type CalendarMessage = {
  subject: string;
  sender?: readonly string[];
  from?: readonly string[];
  messageId?: string | null;
  to: readonly string[];
  receivedAt: Date;
  /** Set only after cryptographic verification of the raw message, never from an email header. */
  verifiedGoogleSignature?: boolean;
  calendar?: {
    eventId: string;
    organizer: string;
    attendees: readonly string[];
    summary: string;
    method: string;
  };
};
export type BookingEvent = {
  kind: "booked" | "canceled";
  attendeeEmail: string;
  slotLabel: string;
  /** Immutable, verified ICS DTSTAMP, not the IMAP delivery time. */
  receivedAt: Date;
  eventId?: string;
};
export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
export function extractSlotLabel(subject: string): string {
  const atIndex = subject.lastIndexOf(" @ ");
  if (atIndex === -1) return "";
  return subject.slice(atIndex + 3)
    .replace(/\s*\((?:AfroPuppyYoga|afropuppyyoga@gmail\.com)\)\s*$/i, "")
    .trim().slice(0, 200);
}
export function parseCalendarMessage(message: CalendarMessage): BookingEvent | null {
  const kind = message.subject.startsWith(BOOKED_SUBJECT_PREFIX) ? "booked"
    : message.subject.startsWith(CANCELED_SUBJECT_PREFIX) ? "canceled" : null;
  const calendar = message.calendar;
  if (!kind || !message.verifiedGoogleSignature || !calendar) return null;
  if (!/^<calendar-[0-9a-f-]+@google\.com>$/i.test(message.messageId ?? "")) return null;
  if (!(message.sender ?? []).some((sender) => /^calendar-notification@google\.com$/i.test(sender))) return null;
  if (!Number.isFinite(message.receivedAt.getTime())) return null;
  if (normalizeEmail(calendar.organizer) !== APY_MAILBOX || !calendar.eventId) return null;
  if (!calendar.summary.startsWith(`${APY_APPOINTMENT_TITLE} `)) return null;
  if (!message.subject.startsWith(`${kind === "booked" ? BOOKED_SUBJECT_PREFIX : CANCELED_SUBJECT_PREFIX} ${APY_APPOINTMENT_TITLE} `)) return null;
  if (calendar.method !== (kind === "booked" ? "REQUEST" : "CANCEL")) return null;
  const allAttendees = Array.from(new Set(calendar.attendees.map(normalizeEmail).filter(Boolean)));
  if (!allAttendees.includes(APY_MAILBOX)) return null;
  const attendees = allAttendees.filter((address) => address !== APY_MAILBOX);
  if (attendees.length !== 1) return null;
  const slotLabel = extractSlotLabel(message.subject);
  if (!slotLabel) return null;
  return { kind, attendeeEmail: attendees[0], slotLabel, receivedAt: message.receivedAt, eventId: calendar.eventId };
}
export type BookingCandidate = {
  id: number;
  email: string | null;
  status: string;
  interviewBookedAt: Date | null;
  interviewSlotLabel: string | null;
  interviewInviteSentAt: Date | null;
  interviewEventId?: string | null;
  interviewLastEventAt?: Date | null;
  interviewCanceledEvents?: readonly { eventId: string; receivedAt: Date }[];
};
type DecisionSource = { eventId?: string; receivedAt: Date };
export type BookingDecision = DecisionSource & (
  | { action: "mark_booked"; applicationId: number; bookedAt: Date; slotLabel: string }
  | { action: "clear_booking"; applicationId: number }
  | { action: "record_notice"; applicationId: number; kind: "canceled"; advanceWatermark: false }
);
export function canReceiveBookingUpdate(candidate: BookingCandidate): boolean {
  return candidate.status === "interview_requested" || candidate.status === "interview_scheduled";
}
function seconds(date: Date): number { return Math.floor(date.getTime() / 1000); }
/** Replay signed notice times; cancellation-only audits also survive partial later scans. */
export function resolveBookingDecisions(events: readonly BookingEvent[], candidates: readonly BookingCandidate[]): BookingDecision[] {
  const ordered = [...events].filter((event) => Number.isFinite(event.receivedAt.getTime()))
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() ||
      Number(a.kind === "canceled") - Number(b.kind === "canceled") ||
      (a.eventId ?? "").localeCompare(b.eventId ?? ""));
  const decisions: BookingDecision[] = [];
  for (const candidate of candidates) {
    if (!canReceiveBookingUpdate(candidate) || !normalizeEmail(candidate.email)) continue;
    const eligible = ordered.filter((event) => normalizeEmail(event.attendeeEmail) === normalizeEmail(candidate.email) &&
      (!candidate.interviewInviteSentAt || event.receivedAt >= candidate.interviewInviteSentAt));
    const canceledEvents = new Map<string, BookingEvent>();
    const canceledSlots = new Map<string, BookingEvent>();
    const unidentifiedCanceledSlots = new Map<string, BookingEvent>();
    const notices = new Map<string, BookingEvent>();
    const retainLatest = (ledger: Map<string, BookingEvent>, key: string, event: BookingEvent) => {
      if (!ledger.has(key) || ledger.get(key)!.receivedAt < event.receivedAt) ledger.set(key, event);
    };
    for (const event of candidate.interviewCanceledEvents ?? []) {
      if (event.eventId && Number.isFinite(event.receivedAt.getTime())) {
        retainLatest(canceledEvents, event.eventId, { ...event, kind: "canceled", attendeeEmail: normalizeEmail(candidate.email), slotLabel: "" });
      }
    }
    // Resolve the complete cancellation ledger first. Discovering a tombstone
    // after replacing A with B must not discard A when B is already canceled.
    for (const event of eligible) {
      if (event.kind !== "canceled") continue;
      if (event.eventId) {
        if ((canceledEvents.get(event.eventId)?.receivedAt.getTime() ?? -Infinity) < event.receivedAt.getTime()) {
          notices.set(`event:${event.eventId}`, event);
          canceledEvents.set(event.eventId, event);
        }
      } else {
        retainLatest(notices, `slot:${event.slotLabel}`, event);
        if (event.slotLabel) retainLatest(unidentifiedCanceledSlots, event.slotLabel, event);
      }
      if (event.slotLabel) retainLatest(canceledSlots, event.slotLabel, event);
    }
    const cancellationFor = (booking: { eventId?: string; slotLabel: string; bookedAt: Date | null }): BookingEvent | null => {
      // A shared slot never correlates two different known UIDs. Slot fallback
      // remains available only when one side lacks the legacy event identity.
      const byId = booking.eventId ? canceledEvents.get(booking.eventId) : undefined;
      const bySlot = (booking.eventId ? unidentifiedCanceledSlots : canceledSlots).get(booking.slotLabel);
      const cancellation = byId && (!bySlot || byId.receivedAt >= bySlot.receivedAt) ? byId : bySlot;
      return cancellation && (!booking.bookedAt || cancellation.receivedAt >= booking.bookedAt) ? cancellation : null;
    };
    let current: { eventId?: string; slotLabel: string; bookedAt: Date | null } | null = candidate.status === "interview_scheduled" &&
      (candidate.interviewBookedAt || candidate.interviewEventId || candidate.interviewSlotLabel)
      ? { eventId: candidate.interviewEventId ?? undefined, slotLabel: candidate.interviewSlotLabel ?? "", bookedAt: candidate.interviewBookedAt }
      : null;
    // Release a canceled stored booking before considering older survivors;
    // retain its cancellation as the clear/audit source if no survivor exists.
    let latestApplied = current ? cancellationFor(current) : null;
    if (latestApplied) current = null;
    for (const event of eligible) {
      if (event.kind !== "booked" || cancellationFor({ ...event, bookedAt: event.receivedAt })) continue;
      if (current?.bookedAt && event.receivedAt < current.bookedAt) continue;
      // Equal-time evidence cannot replace a surviving known different event.
      if (current?.bookedAt && event.receivedAt.getTime() === current.bookedAt.getTime() &&
          event.eventId !== current.eventId) continue;
      current = { eventId: event.eventId, slotLabel: event.slotLabel, bookedAt: event.receivedAt };
      latestApplied = event;
    }
    for (const notice of Array.from(notices.values())) {
      if (notice === latestApplied && !current) continue;
      decisions.push({ action: "record_notice", kind: "canceled", advanceWatermark: false,
        applicationId: candidate.id, eventId: notice.eventId, receivedAt: notice.receivedAt });
    }
    if (!latestApplied) continue;
    if (current?.bookedAt) {
      if (candidate.status === "interview_scheduled" && candidate.interviewBookedAt &&
          seconds(candidate.interviewBookedAt) === seconds(current.bookedAt) &&
          candidate.interviewSlotLabel === current.slotLabel &&
          (!current.eventId || candidate.interviewEventId === current.eventId)) continue;
      decisions.push({ action: "mark_booked", applicationId: candidate.id, bookedAt: current.bookedAt,
        slotLabel: current.slotLabel, eventId: current.eventId, receivedAt: latestApplied.receivedAt });
    } else if (!current && (candidate.status === "interview_scheduled" || candidate.interviewBookedAt)) {
      decisions.push({ action: "clear_booking", applicationId: candidate.id,
        eventId: latestApplied.eventId, receivedAt: latestApplied.receivedAt });
    } else if (!current) {
      decisions.push({ action: "record_notice", kind: "canceled", advanceWatermark: false,
        applicationId: candidate.id, eventId: latestApplied.eventId, receivedAt: latestApplied.receivedAt });
    }
  }
  return decisions;
}

/** Never silently treat uncorrelated historical booked statuses as reconciled. */
export function countUnresolvedLegacyBookings(candidates: readonly BookingCandidate[], decisions: readonly BookingDecision[]): number {
  const resolvedIds = new Set(decisions.filter((decision) => decision.action !== "record_notice").map((decision) => decision.applicationId));
  return candidates.filter((candidate) => candidate.status === "interview_scheduled" &&
    !candidate.interviewEventId && !candidate.interviewSlotLabel && !resolvedIds.has(candidate.id)).length;
}
