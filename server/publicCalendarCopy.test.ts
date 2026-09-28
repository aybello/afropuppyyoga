import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(resolve(process.cwd(), "client/src/components/sections/LumaCalendar.tsx"), "utf8");

describe("public calendar pricing copy", () => {
  it("shows admission pricing rather than treating an optional mat rental as the event starting price", () => {
    expect(component).toContain("Admission from");
    expect(component).toContain("Mat rental is optional and priced separately at checkout.");
    expect(component).not.toContain("<iframe");
  });

  it("expires completed same-day class cards without requiring a browser refresh", () => {
    expect(component).toContain("isStillUpcomingPublicClass");
    expect(component).toContain("refetchInterval: 60 * 1000");
    expect(component).toContain("setCurrentTime(new Date())");
  });
});
