import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JOB_LISTINGS, JobCard } from "../client/src/pages/Careers";
import { PUPPY_MONITOR_SHIFT_DESCRIPTION } from "../shared/newCareersListings";
import { readFileSync } from "node:fs";

const monitors = JOB_LISTINGS.filter((job) => job.title === "Puppy Monitor");
afterEach(() => vi.unstubAllGlobals());

describe("Puppy Monitor shift expectations", () => {
  it("covers all four existing monitor listings without changing their pay or application IDs", () => {
    expect(monitors.map(({ id, locationCode, pay }) => [id, locationCode, pay])).toEqual([
      ["puppy-monitor-guelph", "GUE", "CA$50/shift"],
      ["puppy-monitor-kw", "KW", "$50/shift"],
      ["puppy-monitor-ham", "HAM", "$50/shift"],
      ["puppy-monitor-oakville", "OAK", "$50/shift"],
    ]);
  });

  it.each(monitors)("shows the complete shift in the collapsed $id card", (job) => {
    vi.stubGlobal("window", { location: { origin: "https://example.com" } });
    const html = renderToStaticMarkup(createElement(JobCard, {
      job, expanded: false, onApply: () => {}, onToggle: () => {},
    }));
    expect(job.description).toContain(PUPPY_MONITOR_SHIFT_DESCRIPTION);
    expect(html).toContain("9:00 a.m. to 2:30 p.m.");
    expect(html).toContain("three classes, with breaks between classes");
    expect(html).toContain(job.pay);
    expect(html).toContain("Apply");
    expect(html).not.toContain("unpaid breaks");
  });

  it("does not alter shift wording for unrelated roles", () => {
    for (const job of JOB_LISTINGS.filter((job) => job.title !== "Puppy Monitor")) {
      expect(job.description).not.toContain(PUPPY_MONITOR_SHIFT_DESCRIPTION);
    }
  });

  it("uses the same approved shift wording in the careers crawler response", () => {
    const source = readFileSync(new URL("./seoRenderer.ts", import.meta.url), "utf8");
    expect(source).toContain('<strong>Puppy Monitor shift:</strong> ${PUPPY_MONITOR_SHIFT_DESCRIPTION}');
  });
});
