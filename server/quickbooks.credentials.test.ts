import { describe, expect, it } from "vitest";

describe("QuickBooks Online OAuth credentials", () => {
  it("authenticates the configured production OAuth client without disclosing credentials", async () => {
    const clientId = process.env.QBO_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET;

    expect(clientId).toBeTruthy();
    expect(clientSecret).toBeTruthy();

    const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // This deliberately invalid refresh token lets Intuit authenticate the
      // configured client without authorizing an accounting company or changing data.
      body: "grant_type=refresh_token&refresh_token=credential-health-check-invalid",
    });

    const responseBody = (await response.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
    };

    expect(response.status).toBe(400);
    expect(responseBody.error).toBe("invalid_grant");
  }, 15_000);
});
