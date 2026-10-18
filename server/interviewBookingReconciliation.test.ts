import { describe, expect, it, vi } from "vitest";
import { employees, jobApplicationActions, jobApplications, signingTokens, type JobApplication, type JobApplicationAction } from "../drizzle/schema";
import { reconcileInterviewBookings } from "./interviewBookingReconciliation";
import type { BookingEvent } from "./interviewBookingDetection";

// Keep the real schema and resolver. Only turn query predicates into executable
// filters so the transaction double enforces the same WHERE clauses as the DB.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  const key = (column: { name: string }) => column.name === "appStatus" ? "status" : column.name;
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown) => (row: Record<string, unknown>) => row[key(column)] === value,
    isNull: (column: { name: string }) => (row: Record<string, unknown>) => row[key(column)] == null,
    inArray: (column: { name: string }, values: unknown[]) => (row: Record<string, unknown>) => values.includes(row[key(column)]),
    and: (...filters: Array<(row: Record<string, unknown>) => boolean>) => (row: Record<string, unknown>) => filters.every((filter) => filter(row)),
    desc: (column: { name: string }) => ({ ...column, descending: true }),
  };
});

const actor = { id: 7, name: "Test Staff", email: "staff@example.test" };
const createdAt = new Date("2026-10-01T12:00:00Z");
const receivedAt = new Date("2026-10-12T12:00:00Z");
const auditAt = new Date("2026-10-18T12:00:00Z");
const slot = "Thu Oct 22, 2026 6pm - 6:40pm (EDT)";

type CandidateRow = Pick<JobApplication, "id" | "email" | "status" | "interviewBookedAt" | "interviewSlotLabel" | "createdAt" | "isTeamMember" | "onboardingSentAt" | "onboardingDeliveryToken" | "deletedAt">;
type State = {
  applications: CandidateRow[];
  actions: JobApplicationAction[];
  signings: Array<{ applicationId: number; signed: number }>;
  directory: Array<{ sourceApplicationId: number; employmentStatus: string }>;
};
type RawRow = Record<string, unknown>;
type Column = { name: string; descending?: boolean };
type Filter = (row: RawRow) => boolean;
type Database = Parameters<typeof reconcileInterviewBookings>[0];

function application(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: 1,
    email: "candidate@example.test",
    status: "interview_requested",
    interviewBookedAt: null,
    interviewSlotLabel: null,
    isTeamMember: false,
    onboardingSentAt: null,
    onboardingDeliveryToken: null,
    deletedAt: null,
    createdAt,
    ...overrides,
  };
}

function booking(overrides: Partial<BookingEvent> = {}): BookingEvent {
  return { kind: "booked", attendeeEmail: "candidate@example.test", slotLabel: slot, receivedAt, eventId: "event-1", ...overrides };
}

function action(overrides: Partial<JobApplicationAction> = {}): JobApplicationAction {
  return {
    id: 1, applicationId: 1, action: "interview_invite_sent", fromStatus: "shortlisted", toStatus: "interview_requested",
    actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email, details: null,
    createdAt: new Date("2026-10-10T12:00:00Z"), ...overrides,
  };
}

function transactionDatabase(initial: Partial<State> = {}, options: {
  failAuditAt?: number;
  beforeTransaction?: (state: State) => void;
  beforeUpdate?: (state: State) => void;
} = {}) {
  let state: State = structuredClone({ applications: [application()], actions: [], signings: [], directory: [], ...initial });
  const trace: string[] = [];
  const updateCalls: Array<{ table: unknown; values: RawRow }> = [];
  let insertAttempts = 0;
  const tableName = (table: unknown) => table === jobApplications ? "applications" : table === signingTokens ? "signings" : table === employees ? "directory" : table === jobApplicationActions ? "actions" : "unknown";
  const raw = (row: CandidateRow | JobApplicationAction | State["signings"][number] | State["directory"][number]) => row as unknown as RawRow;
  const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    options.beforeTransaction?.(state);
    const draft = structuredClone(state);
    trace.push("begin");
    const rowsFor = (table: unknown) => {
      const name = tableName(table);
      if (name === "unknown") throw new Error("Unexpected table");
      return draft[name].map(raw);
    };
    const tx = {
      select: (fields: Record<string, Column>) => ({
        from: (table: unknown) => {
          let predicate: Filter = () => true;
          let order: Column[] = [];
          const query = {
            where: (filter: Filter) => { predicate = filter; return query; },
            orderBy: (...columns: Column[]) => { order = columns; return query; },
            for: async (lock: string) => {
              expect(lock).toBe("update");
              trace.push(`lock:${tableName(table)}`);
              const records = rowsFor(table).filter(predicate);
              records.sort((left, right) => {
                for (const column of order) {
                  const l = left[column.name] as Date | number;
                  const r = right[column.name] as Date | number;
                  if (l < r) return column.descending ? 1 : -1;
                  if (l > r) return column.descending ? -1 : 1;
                }
                return 0;
              });
              return records.map((row) => Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.name === "appStatus" ? "status" : column.name]])));
            },
          };
          return query;
        },
      }),
      update: (table: unknown) => ({ set: (values: RawRow) => ({ where: async (predicate: Filter) => {
        trace.push("update");
        options.beforeUpdate?.(draft);
        updateCalls.push({ table, values });
        const matches = rowsFor(table).filter(predicate);
        for (const row of matches) Object.assign(row, values);
        return [{ affectedRows: matches.length }];
      } }) }),
      insert: (table: unknown) => ({ values: async (values: RawRow) => {
        trace.push("audit");
        expect(table).toBe(jobApplicationActions);
        insertAttempts += 1;
        if (insertAttempts === options.failAuditAt) throw new Error("Audit unavailable");
        draft.actions.push(action({ ...values, id: Math.max(0, ...draft.actions.map((row) => row.id)) + 1, createdAt: auditAt }));
      } }),
    };
    try {
      const result = await callback(tx);
      state = draft;
      trace.push("commit");
      return result;
    } catch (error) {
      trace.push("rollback");
      throw error;
    }
  });
  return { db: { transaction } as unknown as Database, transaction, trace, updateCalls, state: () => state };
}

describe("atomic interview booking reconciliation", () => {
  it("books with one combined status/field update and a transaction-local attributed audit", async () => {
    const mock = transactionDatabase({ actions: [action()] });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 1, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.transaction).toHaveBeenCalledTimes(1);
    expect(mock.trace).toEqual(["begin", "lock:applications", "lock:signings", "lock:directory", "lock:actions", "update", "audit", "commit"]);
    expect(mock.updateCalls).toEqual([{ table: jobApplications, values: { status: "interview_scheduled", interviewBookedAt: receivedAt, interviewSlotLabel: slot } }]);
    expect(mock.state().applications[0]).toMatchObject({ status: "interview_scheduled", interviewBookedAt: receivedAt, interviewSlotLabel: slot });
    const audit = mock.state().actions[1];
    expect(audit).toMatchObject({ action: "interview_booking_detected", fromStatus: "interview_requested", toStatus: "interview_scheduled", actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email });
    expect(JSON.parse(audit.details!)).toEqual({ source: "calendar_confirmation", slot, eventId: "event-1", eventReceivedAt: receivedAt.toISOString() });
  });

  it("clears a matching cancellation and persists its event watermark in the same transaction", async () => {
    const mock = transactionDatabase({ applications: [application({ status: "interview_scheduled", interviewBookedAt: receivedAt, interviewSlotLabel: slot })] });
    const cancellation = booking({ kind: "canceled", receivedAt: new Date("2026-10-13T12:00:00Z") });
    await expect(reconcileInterviewBookings(mock.db, [cancellation], actor)).resolves.toEqual({ booked: 0, cleared: 1, checked: 1, unresolved: 0 });
    expect(mock.state().applications[0]).toMatchObject({ status: "interview_requested", interviewBookedAt: null, interviewSlotLabel: null });
    const audit = mock.state().actions[0];
    expect(audit).toMatchObject({ action: "interview_booking_cancelled", fromStatus: "interview_scheduled", toStatus: "interview_requested" });
    expect(JSON.parse(audit.details!)).toEqual({ source: "calendar_confirmation", eventId: "event-1", eventReceivedAt: cancellation.receivedAt.toISOString() });
  });

  it("excludes every signing token and every employee link, not just signed or active rows", async () => {
    const mock = transactionDatabase({
      applications: [1, 2, 3, 4].map((id) => application({ id })),
      signings: [{ applicationId: 1, signed: 1 }, { applicationId: 2, signed: 0 }],
      directory: [{ sourceApplicationId: 3, employmentStatus: "inactive" }],
    });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 1, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().applications.map((row) => row.status)).toEqual(["interview_requested", "interview_requested", "interview_requested", "interview_scheduled"]);
    expect(mock.state().actions.map((row) => row.applicationId)).toEqual([4]);
  });

  it("filters archive, team membership, onboarding, and all non-interview statuses before resolving", async () => {
    const mock = transactionDatabase({ applications: [
      application({ id: 1, deletedAt: createdAt }), application({ id: 2, isTeamMember: true }),
      application({ id: 3, onboardingDeliveryToken: "delivery-in-progress" }), application({ id: 4, onboardingSentAt: createdAt }),
      ...(["new", "reviewed", "shortlisted", "accepted", "onboarded", "rejected"] as const).map((status, index) => application({ id: index + 5, status })),
    ] });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 0, unresolved: 0 });
    expect(mock.updateCalls).toEqual([]);
    expect(mock.state().actions).toEqual([]);
    expect(mock.trace).toEqual(["begin", "lock:applications", "commit"]);
  });

  it("rolls back all candidates and previous audits when a later audit insert fails", async () => {
    const initial = [application(), application({ id: 2 })];
    const mock = transactionDatabase({ applications: initial }, { failAuditAt: 2 });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).rejects.toThrow("Audit unavailable");
    expect(mock.transaction).toHaveBeenCalledTimes(1);
    expect(mock.updateCalls).toHaveLength(2);
    expect(mock.state().applications).toEqual(initial);
    expect(mock.state().actions).toEqual([]);
    expect(mock.trace.at(-1)).toBe("rollback");
    expect(mock.trace).not.toContain("commit");
  });

  it("uses fresh locked status after a hiring decision made during mailbox acquisition", async () => {
    const mock = transactionDatabase({}, { beforeTransaction: (state) => { state.applications[0].status = "accepted"; } });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 0, unresolved: 0 });
    expect(mock.state().applications[0].status).toBe("accepted");
    expect(mock.updateCalls).toEqual([]);
    expect(mock.state().actions).toEqual([]);
  });

  it("does not count or audit a guarded update that affects no rows", async () => {
    // Locks normally prevent this interleaving; the final WHERE guard must also
    // protect against a writer or adapter returning an unmatched stale status.
    const mock = transactionDatabase({}, { beforeUpdate: (state) => { state.applications[0].status = "onboarded"; } });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().applications[0].status).toBe("onboarded");
    expect(mock.state().actions).toEqual([]);
    expect(mock.trace).not.toContain("audit");
  });

  it("uses the latest invite scoped to candidates and rejects confirmations predating it", async () => {
    const mock = transactionDatabase({ actions: [
      action({ id: 1, createdAt }),
      action({ id: 2, createdAt: new Date("2026-10-14T12:00:00Z") }),
      action({ id: 3, applicationId: 999, createdAt: auditAt }),
    ] });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.updateCalls).toEqual([]);
  });

  it("falls back to application creation when an invite action is unavailable", async () => {
    const mock = transactionDatabase({ applications: [application({ createdAt: new Date("2026-10-14T12:00:00Z") })] });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.updateCalls).toEqual([]);
  });

  it("is idempotent through the real resolver and persisted timeline event ID", async () => {
    const mock = transactionDatabase();
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 1, cleared: 0, checked: 1, unresolved: 0 });
    // MySQL booking columns keep seconds; signed notice times are retained in JSON.
    const exact = booking({ receivedAt: new Date(receivedAt.getTime() + 700) });
    mock.state().applications[0].interviewBookedAt = receivedAt;
    await expect(reconcileInterviewBookings(mock.db, [exact], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().actions).toHaveLength(1);
    expect(mock.updateCalls).toHaveLength(1);
    expect(mock.transaction).toHaveBeenCalledTimes(2);
  });

  it("does not resurrect a canceled booking on a later partial inbox replay", async () => {
    const mock = transactionDatabase();
    const canceled = booking({ kind: "canceled", receivedAt: new Date("2026-10-13T12:00:00Z") });
    await reconcileInterviewBookings(mock.db, [booking()], actor);
    await reconcileInterviewBookings(mock.db, [booking(), canceled], actor);
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().applications[0].status).toBe("interview_requested");
    expect(mock.state().actions).toHaveLength(2);
  });

  it("persists a cancellation-only tombstone while invited without counting a cleared booking", async () => {
    const mock = transactionDatabase();
    const canceled = booking({ kind: "canceled", receivedAt: new Date("2026-10-13T12:00:00Z") });
    await expect(reconcileInterviewBookings(mock.db, [canceled], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.updateCalls).toEqual([]);
    expect(mock.state().applications[0].status).toBe("interview_requested");
    expect(mock.state().actions[0]).toMatchObject({ action: "interview_booking_cancelled",
      fromStatus: "interview_requested", toStatus: "interview_requested", actorUserId: actor.id });
    expect(JSON.parse(mock.state().actions[0].details!)).toEqual({ source: "calendar_confirmation",
      eventId: "event-1", eventReceivedAt: canceled.receivedAt.toISOString(), advanceWatermark: true });
    await expect(reconcileInterviewBookings(mock.db, [booking(), canceled], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().actions).toHaveLength(1);
    expect(mock.updateCalls).toEqual([]);
  });

  it("persists the same tombstone when booking and cancellation are first scanned together", async () => {
    const mock = transactionDatabase();
    const canceled = booking({ kind: "canceled", receivedAt: new Date("2026-10-13T12:00:00Z") });
    await expect(reconcileInterviewBookings(mock.db, [canceled, booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    await expect(reconcileInterviewBookings(mock.db, [booking()], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().actions).toHaveLength(1);
    expect(mock.updateCalls).toEqual([]);
  });

  it("accepts an equal-time matching cancellation but rejects booking replays", async () => {
    const mock = transactionDatabase();
    const newer = booking({ eventId: "event-2", slotLabel: "Friday", receivedAt: new Date("2026-10-13T12:00:00Z") });
    await reconcileInterviewBookings(mock.db, [booking()], actor);
    await reconcileInterviewBookings(mock.db, [newer], actor);
    await expect(reconcileInterviewBookings(mock.db, [booking(), booking({ kind: "canceled", eventId: newer.eventId,
      receivedAt: newer.receivedAt }), booking({ eventId: "equal-time-other-event", receivedAt: newer.receivedAt })], actor))
      .resolves.toEqual({ booked: 0, cleared: 1, checked: 1, unresolved: 0 });
    expect(mock.state().applications[0]).toMatchObject({ status: "interview_requested", interviewSlotLabel: null, interviewBookedAt: null });
    expect(mock.state().actions).toHaveLength(3);
    expect(mock.updateCalls).toHaveLength(3);
    await expect(reconcileInterviewBookings(mock.db, [newer], actor))
      .resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
  });

  it("converges whether equal-time booking and cancellation arrive together or in separate scans", async () => {
    const combined = transactionDatabase();
    const split = transactionDatabase();
    const original = booking();
    const cancel = booking({ kind: "canceled", receivedAt: original.receivedAt });
    await reconcileInterviewBookings(combined.db, [original, cancel], actor);
    await reconcileInterviewBookings(split.db, [original], actor);
    await reconcileInterviewBookings(split.db, [cancel], actor);
    expect(split.state().applications).toEqual(combined.state().applications);
    await expect(reconcileInterviewBookings(split.db, [original, cancel], actor))
      .resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
  });

  it("keeps unmatched cancellation tombstones separate from the current booking watermark", async () => {
    const mock = transactionDatabase();
    const unrelatedCancel = booking({ kind: "canceled", eventId: "event-2", receivedAt: new Date("2026-10-14T12:00:00Z") });
    const currentCancel = booking({ kind: "canceled", receivedAt: new Date("2026-10-13T12:00:00Z") });
    const replayAt = new Date("2026-10-13T18:00:00Z");
    await reconcileInterviewBookings(mock.db, [booking()], actor);
    await expect(reconcileInterviewBookings(mock.db, [unrelatedCancel], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().applications[0].status).toBe("interview_scheduled");
    expect(JSON.parse(mock.state().actions[1].details!)).toMatchObject({ eventId: "event-2", advanceWatermark: false });
    // This cancellation must not be dropped just because the other event's audit is newer.
    await expect(reconcileInterviewBookings(mock.db, [currentCancel], actor)).resolves.toEqual({ booked: 0, cleared: 1, checked: 1, unresolved: 0 });
    // Its per-event tombstone still blocks a replay newer than the global watermark.
    await expect(reconcileInterviewBookings(mock.db, [booking({ eventId: "event-2", receivedAt: replayAt }), unrelatedCancel], actor))
      .resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    await expect(reconcileInterviewBookings(mock.db, [booking({ eventId: "event-3", receivedAt: replayAt })], actor))
      .resolves.toEqual({ booked: 1, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().actions).toHaveLength(4);
  });

  it("does not clear unknown legacy bookings on an email-only cancellation and reports manual review", async () => {
    const legacy = application({ status: "interview_scheduled" });
    const mock = transactionDatabase({ applications: [legacy] });
    const canceled = booking({ kind: "canceled", receivedAt: new Date("2026-10-13T12:00:00Z") });
    await expect(reconcileInterviewBookings(mock.db, [canceled], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 1 });
    expect(mock.state().applications).toEqual([legacy]);
    expect(mock.updateCalls).toEqual([]);
    expect(JSON.parse(mock.state().actions[0].details!)).toMatchObject({ advanceWatermark: false });
    await expect(reconcileInterviewBookings(mock.db, [canceled], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 1 });
    expect(mock.state().actions).toHaveLength(1);
    // An old canceled notice is not sufficient to identify the unknown current booking.
    await expect(reconcileInterviewBookings(mock.db, [booking(), canceled], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 1 });
    // A genuinely newer verified booking recovers the current identity safely.
    await expect(reconcileInterviewBookings(mock.db, [booking({ receivedAt: new Date("2026-10-14T12:00:00Z") })], actor))
      .resolves.toEqual({ booked: 1, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.state().applications[0].status).toBe("interview_scheduled");
  });

  it("reports unknown legacy booked statuses even with no new notices", async () => {
    const mock = transactionDatabase({ applications: [application({ status: "interview_scheduled" }), application({ id: 2 })] });
    await expect(reconcileInterviewBookings(mock.db, [], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 2, unresolved: 1 });
    expect(mock.updateCalls).toEqual([]);
    expect(mock.state().actions).toEqual([]);
  });

  it("rolls back cancellation-only audit failures without changing status or counting updates", async () => {
    const mock = transactionDatabase({}, { failAuditAt: 1 });
    await expect(reconcileInterviewBookings(mock.db, [booking({ kind: "canceled" })], actor)).rejects.toThrow("Audit unavailable");
    expect(mock.state().applications[0].status).toBe("interview_requested");
    expect(mock.state().actions).toEqual([]);
    expect(mock.updateCalls).toEqual([]);
    expect(mock.trace.at(-1)).toBe("rollback");
  });

  it("reads the latest same-second sync action by ID and honors event correlation", async () => {
    const cancelAt = new Date("2026-10-14T12:00:00Z");
    const mock = transactionDatabase({
      applications: [application({ status: "interview_scheduled", interviewBookedAt: receivedAt, interviewSlotLabel: slot })],
      actions: [
        action({ id: 10, action: "interview_booking_detected", createdAt: auditAt, details: JSON.stringify({ eventId: "older-event", eventReceivedAt: createdAt.toISOString() }) }),
        action({ id: 11, action: "interview_booking_detected", createdAt: auditAt, details: JSON.stringify({ eventId: "event-1", eventReceivedAt: receivedAt.toISOString() }) }),
      ],
    });
    await expect(reconcileInterviewBookings(mock.db, [booking({ kind: "canceled", slotLabel: "different wording", receivedAt: cancelAt })], actor)).resolves.toEqual({ booked: 0, cleared: 1, checked: 1, unresolved: 0 });
    expect(mock.state().applications[0].status).toBe("interview_requested");
  });

  it("tolerates malformed legacy audit details without accepting a stale creation-era event", async () => {
    const mock = transactionDatabase({ actions: [action({ action: "interview_booking_detected", details: "{bad json" })] });
    await expect(reconcileInterviewBookings(mock.db, [booking({ receivedAt: new Date("2026-09-30T12:00:00Z") })], actor)).resolves.toEqual({ booked: 0, cleared: 0, checked: 1, unresolved: 0 });
    expect(mock.updateCalls).toEqual([]);
  });
});
