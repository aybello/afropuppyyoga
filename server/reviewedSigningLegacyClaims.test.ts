import { describe, expect, it } from "vitest";
import { assertReviewedSigningLegacyClaims, hasLegacySigningOwnershipClaim } from "./reviewedSigningLegacyClaims";

const hash = "a".repeat(64), otherHash = "b".repeat(64);
const associations = [
  { applicationId: 41, employeeId: 7, canonicalApplicationId: 42, recordHash: hash },
  { applicationId: 42, employeeId: 7, canonicalApplicationId: 42, recordHash: "c".repeat(64) },
  { applicationId: 55, employeeId: 7, canonicalApplicationId: 42, recordHash: otherHash },
];
const action = (applicationId: number, details: unknown) => ({ applicationId, action: "employee_added_after_signature", details: JSON.stringify(details) });
const review = (canonical = 42, employee = 7, reviewed: unknown[] = [{ applicationId: 41, recordHash: hash }]) =>
  action(canonical, { employeeId: employee, duplicateReview: { version: 2, canonicalApplicationId: canonical, employeeId: employee, reviewed } });
const plain = (id: number, employee: number) => action(id, { employeeId: employee, signingTokenId: 9 });
const malformed = (details: string | null, id = 99) => ({ applicationId: id, action: "employee_added_after_signature", details });
const check = (rows: ReturnType<typeof malformed>[], durable = associations) =>
  assertReviewedSigningLegacyClaims(rows, durable, new Set([41, 42, 55]), 7, 42);
const isClaimed = (rows: ReturnType<typeof malformed>[], id = 41) => hasLegacySigningOwnershipClaim(rows, new Set([id]));

describe("reviewed signing legacy claims (pure, no database)", () => {
  it("accepts matching reviewed claims and a canonical ordinary hire without deriving authority", () => {
    expect(() => check([review(), plain(42, 7)])).not.toThrow();
    expect(() => check([])).not.toThrow();
    expect(isClaimed([review()])).toBe(true);
    expect(isClaimed([plain(41, 7)])).toBe(false);
    expect(isClaimed([review()], 42)).toBe(true);
  });

  it("accepts complete unrelated reviews even if their version, hashes, or non-relevance fields are malformed", () => {
    const unrelated = action(99, { employeeId: 8, duplicateReview: { version: "broken", employeeId: 9, canonicalApplicationId: 98,
      reviewed: [{ applicationId: 100, recordHash: null }, { applicationId: 100, recordHash: "bad" }] } });
    expect(() => check([review(), unrelated, plain(101, 10)])).not.toThrow();
    expect(isClaimed([unrelated])).toBe(false);
  });

  it.each([
    ["missing", {}],
    ["null", { employeeId: null }],
    ["string", { employeeId: "8" }],
    ["zero", { employeeId: 0 }],
    ["fractional", { employeeId: 1.5 }],
    ["object", { employeeId: {} }],
  ])("ignores an unrelated ordinary action with %s employee ID in both paths", (_label, details) => {
    const ordinary = action(99, details);
    expect(() => check([review(), ordinary])).not.toThrow();
    expect(isClaimed([ordinary])).toBe(false);
    expect(isClaimed([review(), ordinary])).toBe(true);
  });

  it.each([
    ["missing", {}],
    ["null", { employeeId: null }],
    ["string", { employeeId: "7" }],
    ["zero", { employeeId: 0 }],
    ["fractional", { employeeId: 1.5 }],
    ["object", { employeeId: {} }],
  ])("fails closed for an ordinary action with %s employee ID on a related application", (_label, details) => {
    const ordinary = action(41, details);
    expect(() => check([review(), ordinary])).toThrow("reviewed ownership could not be verified");
    expect(() => isClaimed([ordinary])).toThrow("reviewed ownership could not be verified");
  });

  it("fails closed when an invalid string employee ID may refer to the reviewed employee", () => {
    expect(() => check([action(99, { employeeId: "7" })])).toThrow("reviewed ownership could not be verified");
  });

  it("checks invalid ordinary rows reached through indirect reviewed-application overlaps", () => {
    const bridge = review(42, 7, [{ applicationId: 80, recordHash: hash }]);
    const ordinary = action(80, {});
    expect(() => check([ordinary, bridge])).toThrow("reviewed ownership could not be verified");
    expect(() => check([bridge, ordinary])).toThrow("reviewed ownership could not be verified");
  });

  it.each([null, "null", " \n\tnull\r "])("ignores unrelated null details %j in both paths", details => {
    const empty = malformed(details);
    expect(() => check([review(), empty])).not.toThrow();
    expect(isClaimed([empty])).toBe(false);
    expect(isClaimed([review(), empty])).toBe(true);
  });

  it.each([null, "null", " \n\tnull\r "])("fails closed for null details %j on every known or canonical application", details => {
    for (const id of [41, 42, 55]) {
      expect(() => check([review(), malformed(details, id)])).toThrow("reviewed ownership could not be verified");
      expect(() => isClaimed([malformed(details, id)], id)).toThrow("reviewed ownership could not be verified");
    }
    // Canonical relevance must not depend on its presence in knownApplicationIds.
    expect(() => assertReviewedSigningLegacyClaims([malformed(details, 42)], associations, new Set([41]), 7, 42)).toThrow();
  });

  it.each([null, "null"])("fails closed for null details %j connected by an indirect review in either order", details => {
    const bridge = review(42, 7, [{ applicationId: 80, recordHash: hash }]);
    const empty = malformed(details, 80);
    expect(() => check([empty, bridge])).toThrow("reviewed ownership could not be verified");
    expect(() => check([bridge, empty])).toThrow("reviewed ownership could not be verified");
    // A review that reaches the signer is itself a claim even when the empty row comes first.
    const claimant = review(80, 7, [{ applicationId: 41, recordHash: hash }]);
    expect(isClaimed([empty, claimant])).toBe(true);
    expect(isClaimed([claimant, empty])).toBe(true);
  });

  it.each([null, "null"])("does not excuse null details %j with an invalid action application ID", details => {
    expect(() => check([malformed(details, 0)])).toThrow();
    expect(() => isClaimed([malformed(details, 0)])).toThrow();
  });

  it.each([null, "null"])("does not let unrelated null details %j mask conflicts or hidden reviews", details => {
    const empty = malformed(details);
    const conflict = review(42, 7, [{ applicationId: 41, recordHash: otherHash }]);
    const hidden = action(99, { employeeId: 8, extra: { duplicateReview: { reviewed: [{ applicationId: 41 }] } } });
    expect(() => check([empty, review(), conflict])).toThrow("reviewed ownership could not be verified");
    expect(() => check([empty, review(), hidden])).toThrow("reviewed ownership could not be verified");
    expect(() => isClaimed([empty, hidden])).toThrow("reviewed ownership could not be verified");
  });

  it("continues to reject ordinary hires related through a valid employee ID", () => {
    expect(() => check([plain(99, 7)])).toThrow("reviewed ownership could not be verified");
    expect(isClaimed([plain(99, 7)])).toBe(false);
    expect(() => check([plain(99, 8)])).not.toThrow();
  });

  it.each([
    ["duplicate non-claim keys", malformed('{"signingTokenId":1,"signingTokenId":2}')],
    ["duplicate review keys", malformed('{"duplicateReview":{"employeeId":7},"duplicateReview":null}')],
    ["hidden review inside overwritten field", malformed('{"extra":{"duplicateReview":{"employeeId":7}},"extra":{}}')],
    ["nested review", action(99, { extra: [{ duplicateReview: { employeeId: 7 } }] })],
    ["orphaned review fields", action(99, { canonicalApplicationId: 42, reviewed: [{ applicationId: 41, recordHash: hash }] })],
    ["escaped nested review with valid employee", malformed('{"employeeId":8,"extra":{"duplicate\\u0052eview":{"reviewed":[{"applicationId":41}]}}}')],
    ["duplicate ordinary fields with valid employee", malformed('{"employeeId":8,"other":1,"other":2}')],
  ])("fails closed for %s instead of misclassifying an ordinary action", (_label, bad) => {
    expect(() => check([review(), bad])).toThrow("reviewed ownership could not be verified");
    expect(() => isClaimed([bad])).toThrow("reviewed ownership could not be verified");
  });

  it("does not mistake review-like text in ordinary values for hidden keys", () => {
    const ordinary = action(99, { note: 'duplicateReview: {"reviewed": []}' });
    expect(() => check([ordinary])).not.toThrow();
    expect(isClaimed([ordinary])).toBe(false);
  });

  it("fails closed for hidden secondary review evidence alongside an unrelated complete review", () => {
    const hidden = action(99, { employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99,
      reviewed: [{ applicationId: 100, recordHash: hash }] }, extra: { duplicateReview: { reviewed: [{ applicationId: 41 }] } } });
    expect(() => check([review(), hidden])).toThrow("reviewed ownership could not be verified");
    expect(() => isClaimed([hidden])).toThrow("reviewed ownership could not be verified");
  });

  it("does not let unrelated duplicate non-claim fields obscure related duplicates", () => {
    const raw = (canonical: number, employee: number, reviewed: number) => malformed('{"employeeId":' + employee + ',"duplicateReview":{"version":1,"version":2,"employeeId":' + employee + ',"canonicalApplicationId":' + canonical + ',"reviewed":[{"applicationId":' + reviewed + ',"recordHash":"' + hash + '"}]}}', canonical);
    expect(() => check([raw(99, 8, 100)])).not.toThrow();
    expect(() => check([raw(42, 7, 41)])).toThrow();
  });

  it.each([
    ["invalid JSON", malformed('{"employeeId":8,"duplicateReview":')],
    ["truncated array", malformed('{"employeeId":8,"duplicateReview":{"employeeId":8,"canonicalApplicationId":99,"reviewed":[{"applicationId":41}')],
    ["array details", malformed("[]")],
    ["empty details", malformed("")],
    ["quoted null", malformed('"null"')],
    ["boolean details", malformed("false")],
    ["null followed by extra data", malformed("null {}")],
    ["missing employee id", action(99, { duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["string employee id", action(99, { employeeId: "8", duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["null review", action(99, { employeeId: 8, duplicateReview: null })],
    ["missing review employee", action(99, { employeeId: 8, duplicateReview: { version: 2, canonicalApplicationId: 99, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["missing canonical", action(99, { employeeId: 8, duplicateReview: { version: 2, employeeId: 8, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["missing reviewed", action(99, { employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99 } })],
    ["empty reviewed", action(99, { employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [] } })],
    ["missing reviewed ID", action(99, { employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ recordHash: hash }] } })],
    ["string reviewed ID", action(99, { employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: "100", recordHash: hash }] } })],
    ["hidden duplicate top-level employee", malformed('{"employeeId":7,"employeeId":8}')],
    ["escaped duplicate reviewed id", malformed('{"employeeId":8,"duplicateReview":{"version":2,"employeeId":8,"canonicalApplicationId":99,"reviewed":[{"applicationId":41,"application\\u0049d":100,"recordHash":"' + hash + '"}]}}')],
  ])("fails closed for ambiguous %s even when the row ID differs", (_label, bad) => {
    expect(() => check([review(), bad])).toThrow("reviewed ownership could not be verified");
    expect(() => isClaimed([bad])).toThrow("reviewed ownership could not be verified");
  });

  it.each([
    ["row ID", action(41, { employeeId: 8, duplicateReview: { version: 1, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["top-level employee", action(99, { employeeId: 7, duplicateReview: { version: 1, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["review employee", action(99, { employeeId: 8, duplicateReview: { version: 1, employeeId: 7, canonicalApplicationId: 99, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["canonical ID", action(99, { employeeId: 8, duplicateReview: { version: 1, employeeId: 8, canonicalApplicationId: 42, reviewed: [{ applicationId: 100, recordHash: hash }] } })],
    ["reviewed ID", action(99, { employeeId: 8, duplicateReview: { version: 2, employeeId: 8, canonicalApplicationId: 99, reviewed: [{ applicationId: 41, recordHash: hash }] } })],
    ["malformed hash", review(42, 7, [{ applicationId: 41, recordHash: "not-hash" }])],
    ["duplicate reviewed ID", review(42, 7, [{ applicationId: 41, recordHash: hash }, { applicationId: 41, recordHash: hash }])],
    ["self reviewed", review(42, 7, [{ applicationId: 42, recordHash: hash }])],
    ["ordinary action on reviewed application", plain(41, 7)],
    ["ordinary action on canonical for another employee", plain(42, 8)],
  ])("rejects related conflicting or malformed claim identified via %s", (_label, bad) => {
    expect(() => check([review(), bad])).toThrow("reviewed ownership could not be verified");
  });

  it("rejects hash mismatch against every durable association, not just the signed applicant", () => {
    const bad = review(42, 7, [{ applicationId: 41, recordHash: hash }, { applicationId: 55, recordHash: hash }]);
    expect(() => check([bad])).toThrow();
    expect(() => check([review()], [{ ...associations[0], employeeId: 8 }])).toThrow();
    expect(() => check([review()], [associations[0], associations[0]])).toThrow();
  });

  it("rejects conflicting hashes in related legacy reviews even without a durable association for the extra record", () => {
    const first = review(42, 7, [{ applicationId: 80, recordHash: hash }]);
    const second = review(42, 7, [{ applicationId: 80, recordHash: otherHash }]);
    expect(() => check([first, second])).toThrow();
  });

  it("rejects an indirect overlapping claim regardless of action ordering", () => {
    const bridge = review(42, 7, [{ applicationId: 80, recordHash: hash }]);
    const conflict = review(99, 8, [{ applicationId: 80, recordHash: hash }]);
    expect(() => check([bridge, conflict])).toThrow();
    expect(() => check([conflict, bridge])).toThrow();
  });

  it("blocks historical claims with missing owners or durable rows in the unassociated path", () => {
    expect(isClaimed([review()], 41)).toBe(true);
    expect(isClaimed([review()], 42)).toBe(true);
    expect(isClaimed([review()], 999)).toBe(false);
    expect(() => isClaimed([review(99, 8, [{ applicationId: 41, recordHash: "invalid" }])])).toThrow();
  });

  it("does not treat other action types as hiring evidence", () => {
    const wrongType = { ...malformed("not json"), action: "offer_signed" };
    expect(() => check([wrongType])).not.toThrow();
    expect(isClaimed([wrongType])).toBe(false);
  });
});
