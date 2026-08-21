import { describe, expect, it } from "vitest";
import { canReuseSigningToken, detectOfferLetterType } from "../signingPolicy";

describe("offer-letter type routing", () => {
  it("uses the BDR offer letter for BDR and Business Development Representative roles", () => {
    expect(detectOfferLetterType("BDR", "CENTRAL")).toBe("bdr");
    expect(detectOfferLetterType("Business Development Representative", "REMOTE")).toBe("bdr");
  });

  it("continues to route Yoga Instructor offers correctly", () => {
    expect(detectOfferLetterType("Yoga Instructor", "OAK")).toBe("yoga_instructor");
  });

  it("routes Operations Specialist offers to their dedicated template", () => {
    expect(detectOfferLetterType("Operations Specialist", "Kitchener")).toBe("operations_specialist");
  });
});

describe("offer signing token reuse", () => {
  const application = {
    email: "applicant@example.com",
    name: "Applicant Name",
    role: "Yoga Instructor",
    location: "OAK",
  };

  it("reuses the latest active unsigned token for the same canonical applicant", () => {
    expect(canReuseSigningToken({
      applicantEmail: application.email,
      applicantName: application.name,
      role: application.role,
      location: application.location,
      signed: 0,
      expiresAt: new Date("2026-08-25T00:00:00Z"),
    }, application, new Date("2026-08-21T00:00:00Z"))).toBe(true);
  });

  it("does not reuse signed, expired, or mismatched tokens", () => {
    const base = {
      applicantEmail: application.email,
      applicantName: application.name,
      role: application.role,
      location: application.location,
      signed: 0,
      expiresAt: new Date("2026-08-25T00:00:00Z"),
    };

    expect(canReuseSigningToken({ ...base, signed: 1 }, application)).toBe(false);
    expect(canReuseSigningToken(base, application, new Date("2026-08-26T00:00:00Z"))).toBe(false);
    expect(canReuseSigningToken({ ...base, applicantEmail: "wrong@example.com" }, application)).toBe(false);
  });
});
