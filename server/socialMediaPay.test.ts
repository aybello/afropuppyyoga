import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getOfferLetterContent } from "../client/src/pages/SignDocuments";
import { JOB_LISTINGS } from "../client/src/pages/Careers";
import {
  SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD,
  SOCIAL_MEDIA_INTERN_POST_PROBATION_HOURLY_PAY_CAD,
  SOCIAL_MEDIA_INTERN_PROBATION_MONTHS,
  getSocialMediaCompensationText,
  getSocialMediaOfferStartHourlyPay,
} from "../shared/socialMediaTerms";

const ONTARIO_MINIMUM_WAGE_CAD = 17.95;

describe("approved Social Media Intern rate", () => {
  it("starts at CA$19 and rises to CA$20 after a 3-month probation", () => {
    expect(SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD).toBe(19);
    expect(SOCIAL_MEDIA_INTERN_POST_PROBATION_HOURLY_PAY_CAD).toBe(20);
    expect(SOCIAL_MEDIA_INTERN_PROBATION_MONTHS).toBe(3);
  });

  it("never falls below the Ontario minimum wage", () => {
    expect(SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD).toBeGreaterThanOrEqual(ONTARIO_MINIMUM_WAGE_CAD);
    expect(SOCIAL_MEDIA_INTERN_POST_PROBATION_HOURLY_PAY_CAD).toBeGreaterThan(SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD);
  });
});

describe("public Social Media Intern posting", () => {
  const posting = JOB_LISTINGS.find((job) => job.id === "social-media-intern");

  it("shows the starting rate instead of only saying Paid", () => {
    expect(posting).toBeDefined();
    expect(posting?.pay).toBe("CA$19/hr");
  });

  it("states the full rate progression in the perks", () => {
    const perks = posting?.perks.join(" ") ?? "";
    expect(perks).toContain("CA$19/hr to start");
    expect(perks).toContain("CA$20/hr");
    expect(perks).toContain("3-month probation");
  });

  it("leaves every other advertised rate unchanged", () => {
    const payById = Object.fromEntries(JOB_LISTINGS.filter((job) => job.pay).map((job) => [job.id, job.pay]));
    expect(payById["yoga-instructor-kw"]).toBe("$22/hr");
    expect(payById["operations-specialist-kw"]).toBe("$20/hr");
    expect(payById["puppy-specialist"]).toBe("$18/hr");
  });
});

describe("Social Media offer letter compensation", () => {
  it("states the starting rate and the post-probation increase when a rate is saved", () => {
    const text = getSocialMediaCompensationText(19);
    expect(text).toContain("CA$19.00 per hour");
    expect(text).toContain("3-month probationary period");
    expect(text).toContain("CA$20.00 per hour");
  });

  it("preserves the original wording for offers issued before a rate was approved", () => {
    const text = getSocialMediaCompensationText(null);
    expect(text).toContain("terms confirmed in writing by APY");
    expect(text).not.toContain("CA$19");
    expect(text).not.toContain("CA$20");
  });

  it("refuses an unrecognized saved amount rather than showing a wrong rate", () => {
    expect(() => getSocialMediaOfferStartHourlyPay(15)).toThrow(/Unsupported Social Media offer payment/);
    expect(getSocialMediaOfferStartHourlyPay(null)).toBeNull();
    expect(getSocialMediaOfferStartHourlyPay(19)).toBe(19);
  });

  it.each(["social_media_intern", "social_media_specialist"])(
    "renders the saved rate inside the %s offer letter",
    (offerType) => {
      const html = renderToStaticMarkup(
        getOfferLetterContent("Fictional Applicant", "Social Media Intern", "REMOTE", offerType, null, null, 19) as any
      );
      expect(html).toContain("CA$19.00 per hour");
      expect(html).toContain("CA$20.00 per hour");
      expect(html).not.toContain("terms confirmed in writing by APY");
    }
  );

  it("keeps a previously issued offer unchanged when no rate was saved", () => {
    const html = renderToStaticMarkup(
      getOfferLetterContent("Fictional Applicant", "Social Media Intern", "REMOTE", "social_media_intern", null, null, null) as any
    );
    expect(html).toContain("terms confirmed in writing by APY");
    expect(html).not.toContain("CA$19.00 per hour");
  });

  it("does not add a rate line to unrelated roles", () => {
    const html = renderToStaticMarkup(
      getOfferLetterContent("Fictional Applicant", "Operations Specialist", "KW", "operations_specialist", null, null, null) as any
    );
    expect(html).toContain("$20.00 per hour");
    expect(html).not.toContain("CA$19.00 per hour");
  });
});
