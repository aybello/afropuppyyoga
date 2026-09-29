import { describe, expect, it } from "vitest";
import { APP_STATUS, assertApplicantCanBeRejected } from "./careers";

describe("job application interview statuses", () => {
  it("keeps an interview request separate from a confirmed interview schedule", () => {
    expect(APP_STATUS).toContain("interview_requested");
    expect(APP_STATUS).toContain("interview_scheduled");
    expect(APP_STATUS.indexOf("interview_requested")).not.toBe(APP_STATUS.indexOf("interview_scheduled"));
  });

  it("never allows an onboarded or already-rejected person through the rejection email path", () => {
    expect(() => assertApplicantCanBeRejected({ status: "onboarded", onboardingDeliveryToken: null }))
      .toThrow("cannot be rejected");
    expect(() => assertApplicantCanBeRejected({ status: "rejected", onboardingDeliveryToken: null }))
      .toThrow("already been rejected");
    expect(() => assertApplicantCanBeRejected({ status: "accepted", onboardingDeliveryToken: "delivery-in-progress" }))
      .toThrow("Onboarding delivery is in progress");
    expect(() => assertApplicantCanBeRejected({ status: "reviewed", onboardingDeliveryToken: null }))
      .not.toThrow();
  });
});
