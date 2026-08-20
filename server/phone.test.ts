import { describe, expect, it } from "vitest";
import { formatCanadianPhoneNumber, normalizeCanadianPhoneNumber } from "../shared/phone";

describe("Canadian private-event phone validation", () => {
  it("normalizes valid common Canadian phone formats", () => {
    expect(normalizeCanadianPhoneNumber("2897881885")).toBe("+12897881885");
    expect(normalizeCanadianPhoneNumber("(289) 788-1885")).toBe("+12897881885");
    expect(normalizeCanadianPhoneNumber("+1 289-788-1885")).toBe("+12897881885");
    expect(formatCanadianPhoneNumber("2897881885")).toBe("+1 (289) 788-1885");
  });

  it("rejects incomplete and structurally invalid phone numbers", () => {
    expect(normalizeCanadianPhoneNumber("289788188")).toBeNull();
    expect(normalizeCanadianPhoneNumber("1234567890")).toBeNull();
    expect(normalizeCanadianPhoneNumber("289-188-1885")).toBeNull();
  });
});
