import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("APY HQ sign-in rate limiting", () => {
  it("rate-limits phone and email code requests and verification attempts", () => {
    const source = readFileSync("server/_core/index.ts", "utf8");
    [
      "staff.requestEmailAccessCode",
      "staff.verifyEmailAccessCode",
      "staff.requestPhoneAccessCode",
      "staff.verifyPhoneAccessCode",
    ].forEach((procedure) => expect(source).toContain(procedure));
    expect(source).toContain("staffSignInLimiter(req, res, next)");
  });
});
