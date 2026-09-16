import { describe, expect, it, vi } from "vitest";
import {
  buildLumaReminderOutcomeEmail,
  deliverLumaReminderOutcomeReport,
  parseLumaReminderOutcomeReport,
  sanitizeLumaReminderEventName,
  type LumaReminderOutcomeRepository,
} from "./lumaReminderOutcome";

const fixedNow = new Date("2026-09-03T14:00:00.000Z");

function reportFixture() {
  return parseLumaReminderOutcomeReport({
    runStatus: "completed",
    outcomes: [
      { eventName: "AfroPuppyYoga | Kitchener | Dachshunds", eventDate: "2026-09-05", status: "sent" },
      { eventName: "AfroPuppyYoga | Hamilton | Poodles", eventDate: "2026-09-06", status: "safely_stopped", reason: "duplicate_blast_today" },
    ],
  });
}

function repositoryFixture(overrides: Partial<LumaReminderOutcomeRepository> = {}): LumaReminderOutcomeRepository {
  return {
    findByScheduleAndDate: vi.fn(async () => null),
    claim: vi.fn(async () => ({ id: 71, deliveryStatus: "pending" as const })),
    updateDelivery: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("Luma reminder outcome owner emails", () => {
  it("formats aggregate sent and safely-stopped outcomes without attendee data", () => {
    const email = buildLumaReminderOutcomeEmail(reportFixture(), fixedNow);

    expect(email.text).toContain("Sent to Invited-only.");
    expect(email.text).toContain("Safely stopped: a promotional blast was already sent or scheduled today.");
    expect(email.text).toContain("contains no attendee or recipient details");
    expect(email.text).not.toMatch(/recipient count|guest|Going/i);
  });

  it("redacts email and phone fragments from event names before they reach the owner email", () => {
    const name = sanitizeLumaReminderEventName("APY event jane@example.com 416-555-0199");
    expect(name).toContain("[redacted email]");
    expect(name).toContain("[redacted phone]");
    expect(name).not.toContain("jane@example.com");
    expect(name).not.toContain("416-555-0199");
  });

  it("does not resend an already-recorded same-day outcome report", async () => {
    const repository = repositoryFixture({
      findByScheduleAndDate: vi.fn(async () => ({ id: 71, deliveryStatus: "sent" })),
    });
    const sendEmail = vi.fn(async () => undefined);
    const result = await deliverLumaReminderOutcomeReport(reportFixture(), {
      repository,
      sendEmail,
      notifyOwner: vi.fn(async () => true),
      now: fixedNow,
    });

    expect(result.delivery).toBe("already_reported");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(repository.claim).not.toHaveBeenCalled();
  });

  it("records a failed email and raises the owner-alert fallback without leaking outcome details", async () => {
    const repository = repositoryFixture();
    const fallback = vi.fn(async () => true);
    const result = await deliverLumaReminderOutcomeReport(reportFixture(), {
      repository,
      sendEmail: vi.fn(async () => { throw new Error("SMTP unavailable"); }),
      notifyOwner: fallback,
      now: fixedNow,
    });

    expect(result.delivery).toBe("failed");
    expect(repository.updateDelivery).toHaveBeenCalledWith(71, "failed", "owner_email_delivery_failed");
    expect(fallback).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("No attendee or recipient details"),
    }));
    expect(fallback.mock.calls[0][0].content).not.toContain("Dachshunds");
  });
});
