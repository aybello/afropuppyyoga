import { describe, it, expect } from "vitest";

describe("Anthropic API Key", () => {
  it("should be set and valid", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    expect(key).toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);

    // Test with a minimal API call - just list models (lightweight)
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": key!,
        "anthropic-version": "2023-06-01",
      },
    });

    expect(response.status).toBe(200);
  }, 15000);
});
