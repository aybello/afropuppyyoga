import { describe, expect, it } from "vitest";
import { buildBreederConfirmationEmail } from "./email";

describe("breeder confirmation contact paths", () => {
  it("keeps the APY team signature and gives breeders a direct call or text route", () => {
    const email = buildBreederConfirmationEmail({
      breederName: "Happy Tails Kennels",
      contactName: "Avery Smith",
      breed: "French Bulldog",
      classDate: "2026-10-03",
      dayOfWeek: "Saturday",
      location: "Kitchener",
      startTime: "10:00",
      endTime: "12:00",
      classType: "regular",
    });

    expect(email.html).toContain('href="tel:2897881885"');
    expect(email.html).toContain("Call or text 289-788-1885");
    expect(email.html).toContain("For the quickest response, call or text");
    expect(email.text).toContain("call or text 289-788-1885");
    expect(email.text).toContain("The AfroPuppyYoga Team");
  });
});
