import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getOfferLetterContent } from "../client/src/pages/SignDocuments";
import {
  getMovementInstructorOfferHourlyPay,
  MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD,
  MOVEMENT_INSTRUCTOR_PAY_DESCRIPTION,
  MOVEMENT_INSTRUCTOR_PAY_LABEL,
} from "../shared/movementInstructorTerms";
import { NEW_CAREERS_LISTINGS } from "../shared/newCareersListings";
import { PUPPY_MONITOR_PAY_LABEL } from "../shared/puppyMonitorTerms";

const renderMovementOffer = (savedPay?: number | null) =>
  renderToStaticMarkup(
    getOfferLetterContent("Fictional Applicant", "Movement Instructor", "Guelph", "movement_instructor", null, savedPay),
  );

const movementListings = NEW_CAREERS_LISTINGS.filter((listing) => listing.title === "Movement Instructor");

describe("Movement Instructor CA$22 hourly rate", () => {
  it("publishes CA$22 on both Movement Instructor cards", () => {
    expect(MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD).toBe(22);
    expect(MOVEMENT_INSTRUCTOR_PAY_LABEL).toBe("CA$22/hr");
    expect(MOVEMENT_INSTRUCTOR_PAY_DESCRIPTION).toBe("CA$22 per hour");
    expect(movementListings.map((listing) => listing.location).sort()).toEqual(["Guelph", "Kitchener"]);
    for (const listing of movementListings) {
      expect(listing.pay).toBe("CA$22/hr");
      expect(listing.perks).toContain("CA$22 per hour");
      expect(listing.perks.join(" ")).not.toContain("CA$20");
    }
  });

  it("leaves every other role's published pay unchanged", () => {
    const others = NEW_CAREERS_LISTINGS.filter((listing) => listing.title !== "Movement Instructor");
    const operations = others.find((listing) => listing.title === "Operations Specialist");
    const monitor = others.find((listing) => listing.title === "Puppy Monitor");
    expect(operations?.pay).toBe("CA$20/hr");
    expect(operations?.perks).toContain("CA$20 per hour");
    expect(monitor?.pay).toBe(PUPPY_MONITOR_PAY_LABEL);
  });

  it("issues new Movement Instructor offers at CA$22", () => {
    const html = renderMovementOffer(22);
    expect(html).toContain("CA$22.00 per hour for guided movement sessions");
    expect(html).not.toContain("CA$20.00");
  });

  it.each([undefined, null, 20])("preserves previously issued CA$20 offer terms for saved value %s", (savedPay) => {
    const html = renderMovementOffer(savedPay);
    expect(html).toContain("CA$20.00 per hour for guided movement sessions");
    expect(html).not.toContain("CA$22.00 per hour for guided movement sessions");
  });

  it.each([0, 19, 21, 23, -1, NaN, Infinity])("fails closed on unsupported persisted amount %s", (amount) => {
    expect(() => getMovementInstructorOfferHourlyPay(amount)).toThrow("Unsupported");
  });

  it("does not change the Yoga Instructor offer even when a movement amount is present", () => {
    const html = renderToStaticMarkup(
      getOfferLetterContent("Fictional Applicant", "Yoga Instructor", "Kitchener", "yoga_instructor", null, 22),
    );
    expect(html).toContain("$22.00 per hour for teaching yoga classes");
    expect(html).not.toContain("guided movement sessions");
  });

  it("does not change the Puppy Monitor offer when a movement amount is present", () => {
    const html = renderToStaticMarkup(
      getOfferLetterContent("Fictional Applicant", "Puppy Monitor", "Guelph", "puppy_monitor_kw", 60, 22),
    );
    expect(html).toContain("CA$60.00 per shift");
    expect(html).not.toContain("per hour");
  });
});
