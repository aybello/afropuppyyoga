import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("public route bootstrap", () => {
  it("loads the home or app bootstrap without speculative page imports", () => {
    expect(main).toMatch(/window\.location\.pathname === "\/"\s*\? import\("\.\/homeBootstrap"\)\s*:\s*import\("\.\/appBootstrap"\)/);
    expect(main).toContain("void bootstrap.then(({ mount }) => mount())");
    expect(main).not.toMatch(/import\(["']\.\/pages\//);
  });

  it("leaves route rendering and lazy-load error handling in the app", () => {
    expect(app).toContain('lazy(() => import("./pages/PrivateEventQuote"))');
    expect(app).toContain('lazy(() => import("./pages/Guelph"))');
    expect(app).toContain('<Route path={"/private-events/quote"} component={PrivateEventQuote} />');
    expect(app).toContain('<Route path="/puppy-yoga-guelph" component={Guelph} />');
    expect(app).toContain("<ErrorBoundary>");
  });
});
