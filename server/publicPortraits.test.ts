import { describe, expect, it } from "vitest";
import type { SyntheticEvent } from "react";
import { readFileSync } from "node:fs";
import { publicPortraitUrl, publicPortraitSources, nextPublicPortraitSource } from "../shared/publicPortraits";
import { recoverPublicPortrait } from "../client/src/lib/publicPortraitRecovery";

const portraits = [
  ["/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg", "zstgfhkhgJOsMcBx.jpg"],
  ["/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg", "tkTWwpxwClsSwSww.jpg"],
  ["/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg", "sVIpZHnGcGArBGBj.jpg"],
];

describe("exact approved portrait delivery", () => {
  it.each(portraits)("maps %s to its own public photo copy", (managed, filename) => {
    const direct = publicPortraitUrl(managed);
    expect(direct).toBe(`https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/${filename}`);
    expect(direct).not.toMatch(/Expires=|Signature=|Key-Pair-Id=/);
    const sources = publicPortraitSources(managed);
    expect(sources).toEqual([direct, `${managed}?v=apy-portraits-20261104`]);
    expect(nextPublicPortraitSource(direct)).toBe(sources[1]);
    expect(nextPublicPortraitSource(sources[1])).toBeNull();
  });

  it.each([
    "/manus-storage/invoices/private.pdf", "/manus-storage/meta-campaigns/private.jpg",
    "/manus-storage/apy_corporate_hero_202ea280.jpg", "/api/trpc/auth.me",
    "https://d2xsxph8kpxj0f.cloudfront.net/gallery.jpg", "__proto__", "constructor",
    "/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg?arbitrary=1",
  ])("does not rewrite unrelated, private or unknown source %s", source => {
    expect(publicPortraitUrl(source)).toBe(source);
    expect(publicPortraitSources(source)).toEqual([source]);
    expect(nextPublicPortraitSource(source)).toBeNull();
  });

  it("recovers only once on the same img element without returning to the CDN or changing another photo", () => {
    let current = publicPortraitUrl(portraits[0][0]);
    let writes = 0;
    const image = {
      getAttribute: (name: string) => name === "src" ? current : null,
      set src(value: string) { writes++; current = value; },
    };
    const event = { currentTarget: image } as unknown as SyntheticEvent<HTMLImageElement>;
    recoverPublicPortrait(event);
    expect(current).toBe(publicPortraitSources(portraits[0][0])[1]);
    recoverPublicPortrait(event);
    expect(writes).toBe(1);
  });

  it.each([
    "components/sections/About.tsx", "components/sections/PrivateEvents.tsx",
    "components/sections/Gallery.tsx", "pages/PrivateEventQuote.tsx",
    "pages/Guelph.tsx", "components/LocationPage.tsx",
  ])("wires direct delivery and same-photo recovery in %s", file => {
    const source = readFileSync(new URL(`../client/src/${file}`, import.meta.url), "utf8");
    expect(source).toContain('import { publicPortraitUrl } from "@shared/publicPortraits"');
    expect(source).toContain('import { recoverPublicPortrait } from "@/lib/publicPortraitRecovery"');
    expect(source).toContain("publicPortraitUrl(");
    expect(source).toContain("onError={recoverPublicPortrait}");
  });
});
