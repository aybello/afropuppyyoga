import { describe, expect, it } from "vitest";
import { buildBreederClassCancellationPreview } from "./breederClassCancellation";

const classDetails = {
  id: 88,
  breederId: 14,
  breederName: "Bernese Mountain Dogs Breeder",
  contactName: "Jordan Breeder",
  classDate: "2026-09-20",
  dayOfWeek: "Sunday",
  location: "Oakville",
  breed: "Bernese Mountain Dogs",
  startTime: "11:00",
  endTime: "15:00",
};

describe("breeder class-cancellation preview", () => {
  it("previews the exact breeder apology by available channels without exposing delivery addresses", () => {
    const preview = buildBreederClassCancellationPreview({
      ...classDetails,
      emailAvailable: true,
      smsAvailable: true,
    });

    expect(preview.subject).toBe("Class update — Oakville · Sunday, September 20, 2026");
    expect(preview.emailText).toContain("the Oakville AfroPuppyYoga class with Bernese Mountain Dogs on Sunday, September 20, 2026 has been cancelled");
    expect(preview.emailText).toContain("The scheduled time was 11:00 AM–3:00 PM.");
    expect(preview.smsText).toContain("the Oakville AfroPuppyYoga Bernese Mountain Dogs class on Sunday, September 20, 2026 at 11:00 AM–3:00 PM has been cancelled");
    expect(preview.channels).toEqual({ email: "ready", sms: "ready" });
    expect(JSON.stringify(preview)).not.toMatch(/breeder-contact@example\.com|\+1|289-788-1885/);
    expect(preview.emailText).not.toMatch(/rebooking|coupon|Luma checkout/i);
  });

  it("shows unavailable channels in the preview and produces a different confirmation key when the class details change", () => {
    const emailOnly = buildBreederClassCancellationPreview({
      ...classDetails,
      emailAvailable: true,
      smsAvailable: false,
    });
    const movedClass = buildBreederClassCancellationPreview({
      ...classDetails,
      startTime: "12:30",
      emailAvailable: true,
      smsAvailable: false,
    });

    expect(emailOnly.channels).toEqual({ email: "ready", sms: "unavailable" });
    expect(emailOnly.confirmationKey).not.toBe(movedClass.confirmationKey);
  });
});
