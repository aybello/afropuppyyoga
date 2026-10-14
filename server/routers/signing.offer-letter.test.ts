import { describe, expect, it } from "vitest";
import { detectOfferLetterType } from "./signing";
import { renderToStaticMarkup } from "react-dom/server";
import { getOfferLetterContent } from "../../client/src/pages/SignDocuments";

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

  it("routes Social Media Intern and Social Media Specialist offers to dedicated templates", () => {
    expect(detectOfferLetterType("Social Media Intern", "REMOTE")).toBe("social_media_intern");
    expect(detectOfferLetterType("Social Media Specialist", "REMOTE")).toBe("social_media_specialist");
  });

  it("does not render Puppy Monitor content for a Social Media Intern offer", () => {
    const html = renderToStaticMarkup(getOfferLetterContent(
      "Catherine Halim",
      "Social Media Intern",
      "REMOTE",
      "social_media_intern",
    ));
    expect(html).toContain("Social Media Intern");
    expect(html).toContain("Film and edit Reels");
    expect(html).not.toContain("Puppy Monitor");
    expect(html).not.toContain("puppies are already excited");
  });
});
