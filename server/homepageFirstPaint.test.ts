import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

describe("homepage first paint", () => {
  it("does not show the generic spinner while the Home route loads", () => {
    expect(appSource).toContain('location === "/" ? <HomePageLoader /> : <PageLoader />');
    expect(appSource).toContain('className="min-h-screen bg-transparent"');
  });

  it("paints the preloaded hero behind React before the Home route is ready", () => {
    expect(indexSource).toContain('document.documentElement.classList.add("home-pending")');
    expect(indexSource).toContain("html.home-pending body");
    expect(indexSource).toContain("apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp");
  });
});
