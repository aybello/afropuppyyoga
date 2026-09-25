import { describe, expect, it } from "vitest";
import { buildOnboardingEmail, buildYogaInstructorOnboardingEmail } from "./email";
import {
  assertInitialOnboardingStatus,
  assertNoPendingOnboardingClaim,
  assertOnboardingResendStatus,
  onboardingInputSchema,
} from "./routers/careers";

const documents = [
  { title: "Puppy Monitor Training Guide", url: "https://drive.google.com/training-guide" },
  { title: "Team Handbook", url: "https://drive.google.com/team-handbook" },
];

describe("onboarding document delivery", () => {
  it("includes staff-selected document links in generic onboarding email formats", () => {
    const email = buildOnboardingEmail({
      applicantName: "Taylor Example",
      role: "Puppy Monitor",
      location: "Kitchener",
      documents,
      additionalNotes: "Please review these before orientation.",
    });

    expect(email.html).toContain("Your Onboarding Documents");
    expect(email.html).toContain("Puppy Monitor Training Guide");
    expect(email.html).toContain("https://drive.google.com/team-handbook");
    expect(email.text).toContain("Additional onboarding documents:");
    expect(email.text).toContain("Team Handbook: https://drive.google.com/team-handbook");
  });

  it("includes staff-selected document links in yoga instructor onboarding email formats", () => {
    const email = buildYogaInstructorOnboardingEmail({
      applicantName: "Taylor Example",
      location: "Hamilton",
      documents,
    });

    expect(email.html).toContain("Your Onboarding Documents");
    expect(email.html).toContain("Team Handbook");
    expect(email.text).toContain("Puppy Monitor Training Guide: https://drive.google.com/training-guide");
  });

  it("renders staff notes as text instead of executable email markup", () => {
    const email = buildOnboardingEmail({
      applicantName: "Taylor Example",
      role: "Puppy Monitor",
      location: "Kitchener",
      additionalNotes: "Bring ID <img src=x onerror=alert(1)>",
    });

    expect(email.html).toContain("Bring ID &lt;img src=x onerror=alert(1)&gt;");
    expect(email.html).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("escapes supplied orientation details in HTML while preserving the plain-text email", () => {
    const email = buildOnboardingEmail({
      applicantName: "Taylor Example",
      role: "Puppy Monitor",
      location: "Kitchener",
      orientationDate: 'Saturday <img src=x onerror=alert(1)>',
      orientationTime: "9:00 AM",
    });

    expect(email.html).toContain("Saturday &lt;img src=x onerror=alert(1)&gt;");
    expect(email.html).not.toContain("<img src=x onerror=alert(1)>");
  });
});

describe("onboarding workflow guards", () => {
  it("permits initial delivery only for accepted applicants", () => {
    expect(() => assertInitialOnboardingStatus("accepted")).not.toThrow();
    expect(() => assertInitialOnboardingStatus("onboarded")).toThrow("only after the applicant is marked Accepted");
    expect(() => assertInitialOnboardingStatus("interview_scheduled")).toThrow("only after the applicant is marked Accepted");
  });

  it("permits resend after documents are delivered while the applicant remains Accepted", () => {
    expect(() => assertOnboardingResendStatus({ status: "onboarded", onboardingSentAt: new Date() })).not.toThrow();
    expect(() => assertOnboardingResendStatus({ status: "accepted", onboardingSentAt: new Date() })).not.toThrow();
    expect(() => assertOnboardingResendStatus({ status: "accepted", onboardingSentAt: null })).toThrow("only after onboarding documents have been sent");
    expect(() => assertOnboardingResendStatus({ status: "interview_scheduled", onboardingSentAt: new Date() })).toThrow("only after onboarding documents have been sent");
  });

  it("blocks conflicting status changes while an Accepted application has an active send claim", () => {
    expect(() => assertNoPendingOnboardingClaim({ status: "accepted", onboardingDeliveryToken: "claim-123" }))
      .toThrow("Onboarding delivery is in progress");
    expect(() => assertNoPendingOnboardingClaim({ status: "accepted", onboardingDeliveryToken: null })).not.toThrow();
    expect(() => assertNoPendingOnboardingClaim({ status: "onboarded", onboardingDeliveryToken: null })).not.toThrow();
  });

  it("rejects unsafe links, invalid times, and more than four additional documents", () => {
    expect(onboardingInputSchema.safeParse({
      id: 1,
      orientationTime: "8:30 AM",
    }).success).toBe(false);

    expect(onboardingInputSchema.safeParse({
      id: 1,
      orientationTime: "9:00 AM",
    }).success).toBe(false);

    expect(onboardingInputSchema.safeParse({
      id: 1,
      planningDocUrl: "http://example.com/resource",
    }).success).toBe(false);

    expect(onboardingInputSchema.safeParse({
      id: 1,
      planningDocUrl: `https://example.com/${"a".repeat(2049)}`,
    }).success).toBe(false);

    expect(onboardingInputSchema.safeParse({
      id: 1,
      documents: Array.from({ length: 5 }, (_, index) => ({
        title: `Document ${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
    }).success).toBe(false);
  });
});
