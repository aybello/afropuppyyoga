import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("APY November 4 public content refresh", () => {
  it("shows the 13.7K Instagram count consistently on all public claims", () => {
    const sources = [
      read("../client/src/components/sections/InstagramFeed.tsx"),
      read("../client/src/components/sections/Contact.tsx"),
      read("../client/src/pages/Careers.tsx"),
    ];
    for (const source of sources) {
      expect(source).toContain("13.7K");
      expect(source).not.toMatch(/12\.2[Kk]/);
    }
    expect(sources[0]).toContain("@afropuppyyoga · 13.7K followers");
    expect(sources[2]).toContain("13.7K Instagram followers");
  });

  it("uses polished portraits instead of the rejected hero and couple photos", () => {
    const hero = read("../client/src/components/sections/Hero.tsx");
    const privateEvents = read("../client/src/components/sections/PrivateEvents.tsx");
    const quote = read("../client/src/pages/PrivateEventQuote.tsx");
    const shell = read("../client/index.html");
    expect(hero).toContain("apy_portrait_chow_cuddle_nov01_52f30f49.jpg");
    expect(hero).not.toContain("apy_kitchener_gallery_07_jun21_on_mat_172ef0af.jpg");
    expect(shell).not.toContain("apy_kitchener_gallery_07_jun21_on_mat_172ef0af.jpg");
    for (const source of [privateEvents, quote]) {
      expect(source).toContain("apy_portrait_two_goldens_oct13_44cd44f3.jpg");
      expect(source).not.toContain("apy_private_events_hero_43ef0f7d.jpg");
    }
  });
});
