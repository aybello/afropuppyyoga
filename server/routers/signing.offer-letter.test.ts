import { describe, expect, it } from "vitest";
import { detectOfferLetterType } from "./signing";

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
