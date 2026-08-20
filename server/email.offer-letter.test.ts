import { describe, expect, it } from "vitest";
import { buildOfferLetterEmail, buildYogaInstructorOfferLetterEmail } from "./email";

describe("Yoga Instructor offer letter", () => {
  it("includes the consistent two-week written-notice expectation in HTML and plain text", () => {
    const email = buildYogaInstructorOfferLetterEmail({
      applicantName: "Taylor Example",
      location: "Oakville",
    });

    expect(email.html).toContain("Notice of Resignation:");
    expect(email.html).toContain("at least two weeks' written notice whenever reasonably possible");
    expect(email.text).toContain("Notice of Resignation:");
    expect(email.text).toContain("at least two weeks' written notice whenever reasonably possible");
  });

  it("includes the same notice expectation in generic future offer emails", () => {
    const email = buildOfferLetterEmail({
      applicantName: "Taylor Example",
      role: "Puppy Monitor",
      location: "Kitchener",
    });

    expect(email.html).toContain("Notice of Resignation:");
    expect(email.text).toContain("at least two weeks' written notice whenever reasonably possible");
  });
});
