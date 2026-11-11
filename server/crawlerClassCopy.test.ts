import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { seoRenderMiddleware } from "./seoRenderer";

function crawl(path: string): string {
  let html = "";
  const response = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    end: vi.fn((body: string) => { html = body; }),
  };
  const next = vi.fn();
  seoRenderMiddleware(
    { method: "GET", path, query: {}, headers: { "user-agent": "Googlebot" } } as Request,
    response as unknown as Response,
    next,
  );
  expect(next).not.toHaveBeenCalled();
  expect(response.status).toHaveBeenCalledWith(200);
  expect(html).toContain("<html");
  return html;
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const publicClassRoutes = ["/", "/puppy-yoga-kitchener", "/puppy-yoga-hamilton", "/puppy-yoga-oakville", "/puppy-yoga-guelph"];
const timedRoutes = publicClassRoutes.slice(0, 4);

describe("crawler public-class copy", () => {
  it("reflects the class format displayed on the homepage and shared city pages", () => {
    expect(read("client/src/components/sections/Experience.tsx")).toContain("40 minutes of guided yoga with puppies");
    expect(read("client/src/components/sections/Experience.tsx")).toContain("20 minutes of dedicated puppy playtime");
    const cityTemplate = read("client/src/components/LocationPage.tsx");
    expect(cityTemplate).toContain('"40 minutes of guided yoga with puppies"');
    expect(cityTemplate).toContain('"20 minutes of dedicated puppy playtime"');
  });

  it.each(timedRoutes)("%s presents the 40/20 format in crawler HTML", path => {
    const html = crawl(path);
    expect(html).toMatch(/40 minutes of guided yoga/i);
    expect(html).toMatch(/20 minutes of (?:dedicated )?puppy playtime/i);
  });

  it.each(publicClassRoutes)("%s does not assert 60 minutes of guided yoga or provided mats", path => {
    const html = crawl(path);
    expect(html).not.toMatch(/60[ -]minute(?:s)?\s+(?:of\s+)?guided yoga/i);
    expect(html).not.toMatch(/all yoga mats and props provided/i);
  });

  it.each([
    ["/puppy-yoga-kitchener", "client/src/pages/Kitchener.tsx", "please bring your own mat", "Please bring your own yoga mat"],
    ["/puppy-yoga-oakville", "client/src/pages/Oakville.tsx", "Bring a yoga mat", "Bring a yoga mat"],
  ])("%s aligns crawler mat guidance with the visible city page", (path, visiblePage, visibleCopy, crawlerCopy) => {
    expect(read(visiblePage)).toContain(visibleCopy);
    expect(crawl(path)).toContain(crawlerCopy);
  });

  it("defers Hamilton mat details to the selected event instead of asserting a venue policy", () => {
    const html = crawl("/puppy-yoga-hamilton");
    expect(html).toContain("Check your selected event listing for yoga mat details");
    expect(html).not.toMatch(/(?:bring|provide[ds]?) (?:your own |a |all )?yoga mats?/i);
  });
});
