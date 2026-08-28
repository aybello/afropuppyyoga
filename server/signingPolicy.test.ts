import { describe, expect, it } from "vitest";
import { canReuseSigningToken, detectOfferLetterType } from "./signingPolicy";

describe("signing policy", () => {
  it("selects the canonical offer template", () => {
    expect(detectOfferLetterType("Yoga Instructor", "Oakville")).toBe("yoga_instructor");
    expect(detectOfferLetterType("Operations Specialist", "KW")).toBe("operations_specialist");
    expect(detectOfferLetterType("Puppy Monitor", "Hamilton")).toBe("puppy_monitor_hamilton");
  });

  it("reuses only a matching, unsigned, unexpired token", () => {
    const application = { email: "candidate@example.com", name: "Alex Candidate", role: "Puppy Monitor", location: "KW" };
    const signing = { ...application, applicantEmail: application.email, applicantName: application.name, signed: 0, expiresAt: new Date("2026-09-01T00:00:00Z") };
    expect(canReuseSigningToken(signing, application, new Date("2026-08-28T00:00:00Z"))).toBe(true);
    expect(canReuseSigningToken({ ...signing, role: "Other" }, application, new Date("2026-08-28T00:00:00Z"))).toBe(false);
    expect(canReuseSigningToken({ ...signing, signed: 1 }, application, new Date("2026-08-28T00:00:00Z"))).toBe(false);
    expect(canReuseSigningToken(signing, application, new Date("2026-09-02T00:00:00Z"))).toBe(false);
  });
});
