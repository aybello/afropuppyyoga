import { describe, expect, it } from "vitest";
import { getSafeReturnPath } from "./oauth";

const encodeState = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64");

describe("OAuth return path", () => {
  it("preserves an internal APY HQ return path", () => {
    expect(getSafeReturnPath(encodeState({ redirectUri: "https://afropuppyyoga.ca/api/oauth/callback", returnPath: "/staff" }))).toBe("/staff");
  });

  it("falls back to the public homepage for legacy, malformed, or external state", () => {
    expect(getSafeReturnPath(Buffer.from("https://afropuppyyoga.ca/api/oauth/callback").toString("base64"))).toBe("/");
    expect(getSafeReturnPath("not-base64")).toBe("/");
    expect(getSafeReturnPath(encodeState({ returnPath: "https://untrusted.example" }))).toBe("/");
    expect(getSafeReturnPath(encodeState({ returnPath: "//untrusted.example" }))).toBe("/");
  });
});
