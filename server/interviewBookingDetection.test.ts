import { describe, expect, it } from "vitest";
import { parseCalendarMessage, extractSlotLabel, resolveBookingDecisions, canReceiveBookingUpdate, countUnresolvedLegacyBookings, type BookingEvent, type BookingCandidate, type CalendarMessage } from "./interviewBookingDetection";
import { getHiringWorkflow, HIRING_STAGES } from "../shared/hiringWorkflow";
const at = (value: string) => new Date(value);
const time = at("2026-10-14T19:43:28Z");
const slot = "Thu Oct 15, 2026 6:40pm - 7:20pm (EDT)";
const subject = `Appointment booked: AfroPuppyYoga Meeting  (Applicant) @ ${slot} (AfroPuppyYoga)`;
const notice: CalendarMessage = {
  subject, to: ["afropuppyyoga@gmail.com", "applicant@example.com"], receivedAt: time,
  sender: ["calendar-notification@google.com"], messageId: "<calendar-fe018076-c283-4df1-9ce3-9a30afdd47be@google.com>",
  verifiedGoogleSignature: true,
  calendar: { eventId: "event-a@google.com", organizer: "afropuppyyoga@gmail.com", attendees: ["afropuppyyoga@gmail.com", "applicant@example.com"], summary: "AfroPuppyYoga Meeting (Applicant)", method: "REQUEST" },
};
const invited: BookingCandidate = { id: 1, email: "applicant@example.com", status: "interview_requested", interviewBookedAt: null, interviewSlotLabel: null, interviewInviteSentAt: at("2026-10-01T12:00:00Z") };
const bookedEvent: BookingEvent = { kind: "booked", attendeeEmail: "applicant@example.com", slotLabel: slot, receivedAt: time, eventId: "event-a@google.com" };
const booked: BookingCandidate = { ...invited, status: "interview_scheduled", interviewBookedAt: time, interviewSlotLabel: slot, interviewEventId: "event-a@google.com", interviewLastEventAt: time };
const cancellation: BookingEvent = { ...bookedEvent, kind: "canceled", receivedAt: at("2026-10-15T09:00:00Z") };

describe("authenticated calendar notices", () => {
  it("extracts a verified APY booking with its event identity", () => {
    expect(parseCalendarMessage(notice)).toEqual(bookedEvent);
  });
  it("identifies cancellation from calendar attendees, even when To only contains APY", () => {
    expect(parseCalendarMessage({ ...notice, to: ["afropuppyyoga@gmail.com"],
      subject: subject.replace("booked:", "canceled:"), calendar: { ...notice.calendar!, method: "CANCEL" } })?.kind).toBe("canceled");
  });
  it("rejects spoofed calendar headers without a verified signature", () => {
    expect(parseCalendarMessage({ ...notice, verifiedGoogleSignature: false })).toBeNull();
    expect(parseCalendarMessage({ ...notice, verifiedGoogleSignature: undefined })).toBeNull();
  });
  it("rejects another organizer, appointment type, or mismatched method", () => {
    for (const calendar of [
      { ...notice.calendar!, organizer: "other@gmail.com" },
      { ...notice.calendar!, summary: "Other Meeting (Applicant)" },
      { ...notice.calendar!, method: "CANCEL" },
      { ...notice.calendar!, eventId: "" },
    ]) expect(parseCalendarMessage({ ...notice, calendar })).toBeNull();
  });
  it("rejects wrong sender, malformed message id, missing calendar, and invalid dates", () => {
    expect(parseCalendarMessage({ ...notice, sender: ["notcalendar@google.com"] })).toBeNull();
    expect(parseCalendarMessage({ ...notice, messageId: "<a@gmail.com>" })).toBeNull();
    expect(parseCalendarMessage({ ...notice, calendar: undefined })).toBeNull();
    expect(parseCalendarMessage({ ...notice, receivedAt: new Date("bad") })).toBeNull();
  });
  it("rejects replies, forwards, and unrelated appointments", () => {
    for (const subject of ["Re: " + notice.subject, "Fwd: " + notice.subject, "Appointment booked: Other Meeting @ tomorrow"])
      expect(parseCalendarMessage({ ...notice, subject })).toBeNull();
  });
  it("requires one external attendee and the APY organizer attendee", () => {
    for (const attendees of [["afropuppyyoga@gmail.com"], ["applicant@example.com"], ["afropuppyyoga@gmail.com", "a@example.com", "b@example.com"]])
      expect(parseCalendarMessage({ ...notice, calendar: { ...notice.calendar!, attendees } })).toBeNull();
  });
  it("normalizes casing and duplicate attendee entries", () => {
    expect(parseCalendarMessage({ ...notice, calendar: { ...notice.calendar!, attendees: ["AfroPuppyYoga@Gmail.com", "APPLICANT@EXAMPLE.COM", "applicant@example.com"] } })?.attendeeEmail).toBe("applicant@example.com");
  });
  it("extracts a bounded slot and ignores emails in applicant names", () => {
    expect(extractSlotLabel(subject)).toBe(slot);
    expect(extractSlotLabel(subject.replace("(Applicant)", "(a@example.com)"))).toBe(slot);
    expect(extractSlotLabel("No slot")).toBe("");
    expect(extractSlotLabel("x @ " + "x".repeat(500))).toHaveLength(200);
  });
});

describe("booking reconciliation decisions", () => {
  it("promotes an invited applicant and retains event identity and source time", () => {
    expect(resolveBookingDecisions([bookedEvent], [invited])).toEqual([{ action: "mark_booked", applicationId: 1, bookedAt: time, slotLabel: slot, eventId: bookedEvent.eventId, receivedAt: time }]);
  });
  it("is idempotent after storing a booking", () => {
    expect(resolveBookingDecisions([bookedEvent], [booked])).toEqual([]);
  });
  it("compares database timestamp precision at seconds", () => {
    expect(resolveBookingDecisions([{ ...bookedEvent, receivedAt: new Date(time.getTime() + 3) }], [booked])).toEqual([]);
  });
  it("rejects equal persisted signed timestamps even when booking metadata differs", () => {
    expect(resolveBookingDecisions([bookedEvent], [{ ...booked, interviewSlotLabel: null }])).toEqual([]);
    expect(resolveBookingDecisions([{ ...bookedEvent, eventId: "event-b", slotLabel: "Friday" }], [booked])).toEqual([]);
    expect(resolveBookingDecisions([{ ...cancellation, receivedAt: time }], [booked])).toEqual([]);
  });
  it("can repair legacy metadata when there is no persisted notice watermark", () => {
    expect(resolveBookingDecisions([bookedEvent], [{ ...booked, interviewLastEventAt: null, interviewSlotLabel: null }])[0]?.action).toBe("mark_booked");
  });
  it("cancels only the matching event", () => {
    expect(resolveBookingDecisions([cancellation], [booked])).toEqual([{ action: "clear_booking", applicationId: 1, eventId: bookedEvent.eventId, receivedAt: cancellation.receivedAt }]);
    expect(resolveBookingDecisions([{ ...cancellation, eventId: "different" }], [booked])).toEqual([
      { action: "record_notice", kind: "canceled", advanceWatermark: false, applicationId: 1, eventId: "different", receivedAt: cancellation.receivedAt },
    ]);
  });
  it("does not clear a rebooking when an older slot is canceled later", () => {
    const rebook = { ...bookedEvent, eventId: "event-b", slotLabel: "Friday", receivedAt: at("2026-10-15T08:00:00Z") };
    expect(resolveBookingDecisions([cancellation, rebook, bookedEvent], [invited])).toEqual([
      expect.objectContaining({ action: "record_notice", eventId: bookedEvent.eventId, advanceWatermark: false }),
      expect.objectContaining({ action: "mark_booked", eventId: "event-b", slotLabel: "Friday", receivedAt: rebook.receivedAt }),
    ]);
  });
  it("replays out-of-order input chronologically", () => {
    const rebook = { ...bookedEvent, eventId: "event-b", slotLabel: "Friday", receivedAt: at("2026-10-15T10:00:00Z") };
    expect(resolveBookingDecisions([rebook, cancellation, bookedEvent], [invited]).at(-1)).toMatchObject({ action: "mark_booked", eventId: "event-b", slotLabel: "Friday" });
  });
  it("ignores old notices before the current invitation or last processed event", () => {
    expect(resolveBookingDecisions([bookedEvent], [{ ...invited, interviewInviteSentAt: at("2026-10-16T00:00:00Z") }])).toEqual([]);
    expect(resolveBookingDecisions([bookedEvent], [{ ...invited, interviewLastEventAt: cancellation.receivedAt }])).toEqual([]);
    expect(resolveBookingDecisions([{ ...cancellation, receivedAt: at("2026-10-12T00:00:00Z") }], [booked])).toEqual([]);
  });
  it("does not match names, missing email, strangers, or later hiring stages", () => {
    expect(resolveBookingDecisions([bookedEvent], [{ ...invited, email: null }])).toEqual([]);
    expect(resolveBookingDecisions([{ ...bookedEvent, attendeeEmail: "stranger@example.com" }], [invited])).toEqual([]);
    for (const status of ["new", "reviewed", "shortlisted", "accepted", "rejected", "onboarded"]) {
      expect(canReceiveBookingUpdate({ ...invited, status })).toBe(false);
      expect(resolveBookingDecisions([bookedEvent], [{ ...invited, status }])).toEqual([]);
    }
  });
  it("updates each open application for the same applicant", () => {
    expect(resolveBookingDecisions([bookedEvent], [invited, { ...invited, id: 2 }, { ...invited, id: 3, status: "accepted" }]).map((d) => d.applicationId)).toEqual([1, 2]);
  });
  it("persists cancellation tombstones even when the applicant remains invited", () => {
    expect(resolveBookingDecisions([], [invited])).toEqual([]);
    const expected = [{ action: "record_notice", kind: "canceled", advanceWatermark: true, applicationId: 1,
      eventId: bookedEvent.eventId, receivedAt: cancellation.receivedAt }];
    expect(resolveBookingDecisions([bookedEvent, cancellation], [invited])).toEqual(expected);
    expect(resolveBookingDecisions([cancellation], [invited])).toEqual(expected);
    expect(resolveBookingDecisions([bookedEvent, cancellation], [{ ...invited,
      interviewLastEventAt: cancellation.receivedAt, interviewEventId: bookedEvent.eventId }])).toEqual([]);
  });
  it("rejects a replayed older signed booking after a newer booking was persisted", () => {
    const newer = { ...booked, interviewEventId: "event-b", interviewBookedAt: cancellation.receivedAt,
      interviewSlotLabel: "Friday", interviewLastEventAt: cancellation.receivedAt };
    expect(resolveBookingDecisions([bookedEvent], [newer])).toEqual([]);
  });
  it("uses per-event cancellation tombstones without suppressing a different current booking", () => {
    const candidate = { ...invited, interviewCanceledEvents: [{ eventId: "event-b", receivedAt: cancellation.receivedAt }] };
    expect(resolveBookingDecisions([{ ...bookedEvent, eventId: "event-b" }], [candidate])).toEqual([]);
    expect(resolveBookingDecisions([bookedEvent], [candidate])[0]?.action).toBe("mark_booked");
    expect(resolveBookingDecisions([{ ...bookedEvent, eventId: "event-b", receivedAt: at("2026-10-16T00:00:00Z") }], [candidate])[0]?.action).toBe("mark_booked");
  });
  it("resolves equal-time input deterministically, with cancellation winning an unpersisted booking", () => {
    const sameTimeCancellation = { ...cancellation, receivedAt: time };
    const expected = [{ action: "record_notice", kind: "canceled", advanceWatermark: true,
      applicationId: 1, eventId: bookedEvent.eventId, receivedAt: time }];
    expect(resolveBookingDecisions([bookedEvent, sameTimeCancellation], [invited])).toEqual(expected);
    expect(resolveBookingDecisions([sameTimeCancellation, bookedEvent], [invited])).toEqual(expected);
  });
  it("does not clear an uncorrelated legacy booking and reports it for manual review", () => {
    const legacy = { ...invited, status: "interview_scheduled" };
    const decisions = resolveBookingDecisions([cancellation], [legacy]);
    expect(decisions).toEqual([{ action: "record_notice", kind: "canceled", advanceWatermark: false,
      applicationId: 1, eventId: cancellation.eventId, receivedAt: cancellation.receivedAt }]);
    expect(countUnresolvedLegacyBookings([legacy], decisions)).toBe(1);
    expect(countUnresolvedLegacyBookings([legacy], [])).toBe(1);
    expect(countUnresolvedLegacyBookings([legacy], resolveBookingDecisions([bookedEvent], [legacy]))).toBe(0);
  });
  it("can correlate a legacy booking using trusted event identity without a booked-at value", () => {
    const legacy = { ...invited, status: "interview_scheduled", interviewEventId: cancellation.eventId };
    const decisions = resolveBookingDecisions([cancellation], [legacy]);
    expect(decisions).toEqual([{ action: "clear_booking", applicationId: 1, eventId: cancellation.eventId, receivedAt: cancellation.receivedAt }]);
    expect(countUnresolvedLegacyBookings([legacy], decisions)).toBe(0);
  });
});

describe("separate hiring stages", () => {
  const base = { signingStatus: null, onboardingSentAt: null, onboardingDeliveryToken: null };
  it("separates invited from booked while preserving offer controls", () => {
    expect(HIRING_STAGES.map(([stage]) => stage)).toEqual(expect.arrayContaining(["interview", "interview_booked"]));
    expect(getHiringWorkflow({ ...base, status: "interview_requested" }).stage).toBe("interview");
    expect(getHiringWorkflow({ ...base, status: "interview_scheduled" }).stage).toBe("interview_booked");
    expect(getHiringWorkflow({ ...base, status: "interview_scheduled" }).canSendOffer).toBe(true);
    expect(getHiringWorkflow({ ...base, status: "accepted", signingStatus: "signed" }).stage).toBe("signed");
  });
});
