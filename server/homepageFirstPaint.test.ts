import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

describe("homepage first paint", () => {
  it("ships the complete Home page in the initial application bundle", () => {
    expect(appSource).toContain('import Home from "./pages/Home"');
    expect(appSource).not.toContain('lazy(() => import("./pages/Home"))');
    expect(appSource).not.toContain("HomePageLoader");
  });

  it("preloads the hero without showing an intermediate background shell", () => {
    expect(indexSource).not.toContain("home-pending");
    expect(indexSource).toContain("apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp");
  });
});
