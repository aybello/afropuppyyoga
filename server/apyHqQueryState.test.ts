import { describe, expect, it } from "vitest";
import {
  getSafeApyHqReturnPath,
  getApyHqSessionRedirect,
  isApyUnauthorizedError,
  shouldRetryApyQuery,
} from "../shared/apyHqQueryState";

describe("APY HQ query loading safeguards", () => {
  it("recognizes the tRPC unauthorized error and never retries it", () => {
    const error = { message: "Please login (10001)", data: { code: "UNAUTHORIZED" } };
    expect(isApyUnauthorizedError(error)).toBe(true);
    expect(shouldRetryApyQuery(0, error)).toBe(false);
  });

  it("allows only one retry for a transient non-authenticated request failure", () => {
    const error = { message: "Temporary network failure", data: { code: "INTERNAL_SERVER_ERROR" } };
    expect(shouldRetryApyQuery(0, error)).toBe(true);
    expect(shouldRetryApyQuery(1, error)).toBe(false);
  });

  it("returns expired APY HQ sessions to passwordless Staff Access with their original path", () => {
    expect(getApyHqSessionRedirect("/admin/employees", "?tab=active"))
      .toBe("/staff-access?returnTo=%2Fadmin%2Femployees%3Ftab%3Dactive");
    expect(getApyHqSessionRedirect("/staff")).toBe("/staff-access?returnTo=%2Fstaff");
    expect(getApyHqSessionRedirect("/")).toBeNull();
  });

  it("only accepts APY HQ paths from the return-to query", () => {
    expect(getSafeApyHqReturnPath("?returnTo=%2Fadmin%2Femployees%3Ftab%3Dactive"))
      .toBe("/admin/employees?tab=active");
    expect(getSafeApyHqReturnPath("?returnTo=https%3A%2F%2Fevil.example")).toBe("/staff");
    expect(getSafeApyHqReturnPath("")).toBe("/staff");
  });
});
