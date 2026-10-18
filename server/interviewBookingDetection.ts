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
};
type DecisionSource = { eventId?: string; receivedAt: Date };
export type BookingDecision = DecisionSource & (
  | { action: "mark_booked"; applicationId: number; bookedAt: Date; slotLabel: string }
  | { action: "clear_booking"; applicationId: number }
);
export function canReceiveBookingUpdate(candidate: BookingCandidate): boolean {
  return candidate.status === "interview_requested" || candidate.status === "interview_scheduled";
}
function seconds(date: Date): number { return Math.floor(date.getTime() / 1000); }
/** Replay each event independently so canceling an old slot cannot cancel a rebooking. */
export function resolveBookingDecisions(events: readonly BookingEvent[], candidates: readonly BookingCandidate[]): BookingDecision[] {
  const ordered = [...events].filter((event) => Number.isFinite(event.receivedAt.getTime()))
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || (a.kind === "canceled" ? 1 : -1));
  const decisions: BookingDecision[] = [];
  for (const candidate of candidates) {
    if (!canReceiveBookingUpdate(candidate) || !normalizeEmail(candidate.email)) continue;
    let current: { eventId?: string; slotLabel: string; bookedAt: Date } | null = candidate.status === "interview_scheduled" && candidate.interviewBookedAt
      ? { eventId: candidate.interviewEventId ?? undefined, slotLabel: candidate.interviewSlotLabel ?? "", bookedAt: candidate.interviewBookedAt }
      : null;
    const canceledIds = new Set<string>();
    let latestApplied: BookingEvent | null = null;
    for (const event of ordered) {
      if (normalizeEmail(event.attendeeEmail) !== normalizeEmail(candidate.email)) continue;
      if (candidate.interviewInviteSentAt && event.receivedAt < candidate.interviewInviteSentAt) continue;
      if (candidate.interviewLastEventAt && event.receivedAt < candidate.interviewLastEventAt) continue;
      if (event.kind === "booked") {
        if (event.eventId && canceledIds.has(event.eventId)) continue;
        if (current && event.receivedAt < current.bookedAt) continue;
        current = { eventId: event.eventId, slotLabel: event.slotLabel, bookedAt: event.receivedAt };
        latestApplied = event;
      } else {
        if (event.eventId) canceledIds.add(event.eventId);
        const matches = current && (current.eventId && event.eventId
          ? current.eventId === event.eventId
          : Boolean(event.slotLabel) && current.slotLabel === event.slotLabel);
        if (!matches || (current && event.receivedAt < current.bookedAt)) continue;
        current = null;
        latestApplied = event;
      }
    }
    if (!latestApplied) continue;
    if (current) {
      if (candidate.status === "interview_scheduled" && candidate.interviewBookedAt &&
          seconds(candidate.interviewBookedAt) === seconds(current.bookedAt) &&
          candidate.interviewSlotLabel === current.slotLabel &&
          (!current.eventId || candidate.interviewEventId === current.eventId)) continue;
      decisions.push({ action: "mark_booked", applicationId: candidate.id, bookedAt: current.bookedAt,
        slotLabel: current.slotLabel, eventId: current.eventId, receivedAt: latestApplied.receivedAt });
    } else if (candidate.status === "interview_scheduled" || candidate.interviewBookedAt) {
      decisions.push({ action: "clear_booking", applicationId: candidate.id,
        eventId: latestApplied.eventId, receivedAt: latestApplied.receivedAt });
    }
  }
  return decisions;
}
