import { describe, expect, it } from "vitest";
import {
  detectOfferLetterType,
  requireOfferLetterType,
  resolveOfferLetterType,
  SUPPORTED_OFFER_ROLES,
  type OfferLetterType,
} from "./signingPolicy";
import { getOfferLetterContent } from "../client/src/pages/SignDocuments";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Every job APY can hire for must receive its own offer letter. A role must
 * never silently fall through to a different role's document.
 */
const ROLE_EXPECTATIONS: Array<{ role: string; location: string; expected: OfferLetterType }> = [
  { role: "Yoga Instructor", location: "KW", expected: "yoga_instructor" },
  { role: "Yoga Instructor", location: "OAK", expected: "yoga_instructor" },
  { role: "Yoga Instructor", location: "HAM", expected: "yoga_instructor" },
  { role: "Movement Instructor", location: "KW", expected: "movement_instructor" },
  { role: "Movement Instructor", location: "GUE", expected: "movement_instructor" },
  { role: "Puppy Monitor", location: "KW", expected: "puppy_monitor_kw" },
  { role: "Puppy Monitor", location: "OAK", expected: "puppy_monitor_kw" },
  { role: "Puppy Monitor", location: "GUE", expected: "puppy_monitor_kw" },
  { role: "Puppy Monitor", location: "HAM", expected: "puppy_monitor_hamilton" },
  { role: "Puppy Specialist", location: "HAM / KW", expected: "puppy_specialist" },
  { role: "Operations Specialist", location: "KW", expected: "operations_specialist" },
  { role: "Operations Specialist", location: "GUE", expected: "operations_specialist" },
  { role: "Operations Specialist", location: "OAK", expected: "operations_specialist" },
  { role: "Operations Manager", location: "KW", expected: "operations_manager" },
  { role: "Operations Manager", location: "HAM", expected: "operations_manager" },
  { role: "BDR", location: "CENTRAL", expected: "bdr" },
  { role: "Business Development Representative", location: "REMOTE", expected: "bdr" },
  { role: "Social Media Intern", location: "REMOTE", expected: "social_media_intern" },
  { role: "Social Media Specialist", location: "CENTRAL", expected: "social_media_specialist" },
];

/** The document title each offer letter must state for its role. */
const EXPECTED_DOCUMENT_TITLE: Record<OfferLetterType, string> = {
  yoga_instructor: "Yoga Instructor",
  movement_instructor: "Movement Instructor",
  puppy_monitor_kw: "Puppy Monitor",
  puppy_monitor_hamilton: "Puppy Monitor",
  puppy_specialist: "Puppy Specialist",
  operations_specialist: "Operations Specialist",
  operations_manager: "Operations Manager",
  bdr: "Business Development Representative",
  social_media_intern: "Social Media Intern",
  social_media_specialist: "Social Media Specialist",
};

describe("every APY role receives its own offer letter", () => {
  it.each(ROLE_EXPECTATIONS)("routes $role in $location to $expected", ({ role, location, expected }) => {
    expect(resolveOfferLetterType(role, location)).toBe(expected);
    expect(requireOfferLetterType(role, location)).toBe(expected);
    expect(detectOfferLetterType(role, location)).toBe(expected);
  });

  it.each(ROLE_EXPECTATIONS)("renders a $expected document naming the correct position", ({ role, location, expected }) => {
    const markup = renderToStaticMarkup(
      getOfferLetterContent("Fictional Applicant", role, location, expected) as any
    );
    expect(markup).toContain(EXPECTED_DOCUMENT_TITLE[expected]);
  });

  it("never shows a Puppy Monitor document to a non Puppy Monitor role", () => {
    for (const { role, location, expected } of ROLE_EXPECTATIONS) {
      if (expected.startsWith("puppy_monitor_")) continue;
      const markup = renderToStaticMarkup(
        getOfferLetterContent("Fictional Applicant", role, location, expected) as any
      );
      expect(markup).not.toContain("position of <strong>Puppy Monitor</strong>");
      expect(markup).not.toContain("paid volunteer position");
    }
  });

  it("accepts the stored role spellings used by live applications", () => {
    expect(resolveOfferLetterType("puppy_monitor", "OAK")).toBe("puppy_monitor_kw");
    expect(resolveOfferLetterType("movement_instructor", "KW")).toBe("movement_instructor");
    expect(resolveOfferLetterType("  Operations   Manager  ", "KW")).toBe("operations_manager");
  });

  it("covers every supported role title", () => {
    for (const role of SUPPORTED_OFFER_ROLES) {
      expect(resolveOfferLetterType(role, "KW")).not.toBeNull();
    }
  });
});

describe("unknown roles fail closed instead of borrowing another letter", () => {
  it.each(["Videographer", "Photographer", "Brand Ambassador", "Marketing Lead", ""])(
    "refuses to issue an offer for %j",
    (role) => {
      expect(resolveOfferLetterType(role, "KW")).toBeNull();
      expect(() => requireOfferLetterType(role, "KW")).toThrow(/No approved offer letter/);
    }
  );

  it("does not treat an unrelated title containing instructor as a yoga offer", () => {
    expect(resolveOfferLetterType("Swim Instructor", "KW")).toBeNull();
  });

  it("does not treat an unrelated title containing specialist as a puppy offer", () => {
    expect(resolveOfferLetterType("Marketing Specialist", "KW")).toBeNull();
  });

  it("throws from the compatibility entry point too, so no caller can receive a wrong letter", () => {
    expect(() => detectOfferLetterType("Videographer", "KW")).toThrow(/No approved offer letter/);
  });
});

describe("Puppy Monitor location routing", () => {
  it.each(["HAM", "Hamilton", "hamilton", "HAM / KW", "Hamilton, ON"])(
    "uses the Hamilton letter for %s",
    (location) => {
      expect(resolveOfferLetterType("Puppy Monitor", location)).toBe("puppy_monitor_hamilton");
    }
  );

  it.each(["KW", "Kitchener", "OAK", "Oakville", "GUE", "Guelph", "Chatham", "Grantham"])(
    "uses the Kitchener-Waterloo letter for %s",
    (location) => {
      expect(resolveOfferLetterType("Puppy Monitor", location)).toBe("puppy_monitor_kw");
    }
  );
});
