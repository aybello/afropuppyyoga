import { describe, it, expect } from "vitest";

/**
 * Validates that the LUMA_API_KEY secret is set and can authenticate
 * against the Luma API by calling the /v2/calendar/list-owned endpoint.
 */
describe("Luma API key validation", () => {
  it("should have LUMA_API_KEY set in environment", () => {
    const key = process.env.LUMA_API_KEY;
    expect(key, "LUMA_API_KEY must be set").toBeTruthy();
    expect(key!.startsWith("secret-"), "LUMA_API_KEY should start with 'secret-'").toBe(true);
  });

  it("should authenticate successfully against the Luma API", async () => {
    const key = process.env.LUMA_API_KEY;
    if (!key) {
      throw new Error("LUMA_API_KEY is not set — cannot validate");
    }

    const response = await fetch("https://api.lu.ma/public/v1/user/get-self", {
      method: "GET",
      headers: {
        "x-luma-api-key": key,
        "Accept": "application/json",
      },
    });

    // 200 = authenticated, 401/403 = bad key
    expect(
      response.status,
      `Luma API returned ${response.status} — check that LUMA_API_KEY is correct`
    ).toBe(200);

    const body = await response.json() as { user?: { email?: string } };
    expect(body.user?.email, "Response should include authenticated user email").toBeTruthy();
  }, 15_000); // allow up to 15s for the network call
});
