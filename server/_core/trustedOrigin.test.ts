import { afterEach, describe, expect, it } from "vitest";
import { getTrustedAppOrigin } from "./trustedOrigin";

describe("getTrustedAppOrigin", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

  it("always uses the APY domain in production", () => {
    process.env.NODE_ENV = "production";
    expect(getTrustedAppOrigin("https://attacker.example")).toBe("https://afropuppyyoga.ca");
  });

  it("allows localhost during development", () => {
    process.env.NODE_ENV = "development";
    expect(getTrustedAppOrigin("http://localhost:5173/path")).toBe("http://localhost:5173");
  });
});
