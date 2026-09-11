import { describe, expect, it } from "vitest";
import { buildBreederReplacementPreview } from "./breederReplacement";

describe("breeder replacement preview", () => {
  it("previews an outgoing breeder notice without claiming the public class itself is cancelled", () => {
    const preview = buildBreederReplacementPreview({
      id: 501,
      outgoingBreederId: 14,
      incomingBreederId: 27,
      outgoingBreederName: "Current Frenchie Breeder",
      incomingBreederName: "Bernese Mountain Dogs Breeder",
      contactName: "Jordan Breeder",
      classDate: "2026-09-20",
      dayOfWeek: "Sunday",
      location: "Oakville",
      breed: "Bernese Mountain Dogs",
      startTime: "11:00",
      endTime: "15:00",
      emailAvailable: true,
      smsAvailable: true,
    });

    expect(preview.subject).toBe("Breeder update — Oakville · Sunday, September 20, 2026");
    expect(preview.emailText).toContain("your participation in the Oakville AfroPuppyYoga class with Bernese Mountain Dogs on Sunday, September 20, 2026 has been cancelled");
    expect(preview.emailText).toContain("The public class itself will continue with a different breeder, so please do not plan to bring puppies for this class.");
    expect(preview.emailText).toContain("11:00 AM–3:00 PM");
    expect(preview.smsText).toContain("your participation in the Oakville AfroPuppyYoga Bernese Mountain Dogs class on Sunday, September 20, 2026 at 11:00 AM–3:00 PM has been cancelled");
    expect(preview.emailText).not.toContain("rebook");
    expect(preview.channels).toEqual({ email: "ready", sms: "ready" });
    expect(preview.confirmationKey).toHaveLength(64);
  });
});
