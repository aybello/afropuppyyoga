import { afterEach, describe, expect, it, vi } from "vitest";
import { createSubmissionKey } from "../client/src/lib/submissionKey";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createSubmissionKey", () => {
  it("uses a browser UUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "b08abf8a-5720-4e06-83a4-11953b714c84") });
    expect(createSubmissionKey()).toBe("b08abf8a-5720-4e06-83a4-11953b714c84");
  });

  it("creates a valid fallback UUID when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createSubmissionKey()).toMatch(UUID_PATTERN);
  });
});
