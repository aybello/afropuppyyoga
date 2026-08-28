import { describe, expect, it } from "vitest";
import { lumaGuestAttended } from "./reviewTextSender";

describe("review-text attendance eligibility", () => {
  it("accepts a guest with a top-level Luma check-in", () => {
    expect(lumaGuestAttended({ checked_in_at: "2026-08-28T15:01:00Z" })).toBe(true);
  });

  it("accepts a guest with a captured checked-in event ticket", () => {
    expect(lumaGuestAttended({
      event_tickets: [{ is_captured: true, checked_in_at: "2026-08-28T15:01:00Z" }],
    })).toBe(true);
  });

  it("rejects registration without a check-in", () => {
    expect(lumaGuestAttended({
      approval_status: "approved",
      registered_at: "2026-08-20T10:00:00Z",
      event_tickets: [{ is_captured: true, checked_in_at: null }],
    })).toBe(false);
  });

  it("ignores a check-in on an uncaptured ticket", () => {
    expect(lumaGuestAttended({
      event_tickets: [{ is_captured: false, checked_in_at: "2026-08-28T15:01:00Z" }],
    })).toBe(false);
  });
});
