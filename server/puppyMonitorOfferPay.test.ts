import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getOfferLetterContent } from "../client/src/pages/SignDocuments";
import { getPuppyMonitorOfferShiftPay, PUPPY_MONITOR_SHIFT_PAY_CAD } from "../shared/puppyMonitorTerms";

const renderOffer = (savedPay?: number | null, type = "puppy_monitor_kw") =>
  renderToStaticMarkup(getOfferLetterContent("Fictional Applicant", "Puppy Monitor", "Guelph", type, savedPay));

describe("Puppy Monitor offer payment history", () => {
  it("shows the owner-approved CA$60 and shift expectations for newly issued offers", () => {
    expect(PUPPY_MONITOR_SHIFT_PAY_CAD).toBe(60);
    for (const type of ["puppy_monitor_kw", "puppy_monitor_hamilton"]) {
      const html = renderOffer(60, type);
      expect(html).toContain("CA$60.00 per shift");
      expect(html).toContain("paid volunteer");
      expect(html).toContain("9:00 a.m. to 2:30 p.m.");
      expect(html).toContain("three classes, with breaks between classes");
      expect(html).not.toContain("$50.00");
    }
  });

  it.each([undefined, null, 50])("preserves existing CA$50 offer terms for saved value %s", (savedPay) => {
    const html = renderOffer(savedPay);
    expect(html).toContain("$50.00 per shift");
    expect(html).not.toContain("CA$60.00");
    expect(html).not.toContain("9:00 a.m. to 2:30 p.m.");
  });

  it.each([0, 59, 61, -1, NaN, Infinity])("fails closed on unsupported persisted amount %s", (amount) => {
    expect(() => getPuppyMonitorOfferShiftPay(amount)).toThrow("Unsupported");
  });

  it("does not change other role offers even when a monitor payment is present", () => {
    const html = renderToStaticMarkup(getOfferLetterContent("Fictional Applicant", "Movement Instructor", "Guelph", "movement_instructor", 60));
    expect(html).toContain("CA$20.00 per hour");
    expect(html).not.toContain("CA$60.00");
    expect(html).not.toContain("paid volunteer");
  });
});
