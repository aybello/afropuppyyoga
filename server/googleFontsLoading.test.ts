import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(import.meta.dirname, "../client/index.html"), "utf8");
const originalUrl = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,400;1,9..144,600;1,9..144,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap";

describe("Google Fonts loading", () => {
  it("loads the original stylesheet without blocking screen rendering and activates it safely", () => {
    expect(html).toContain(`<link id="google-fonts" href="${originalUrl}" rel="stylesheet" media="print" />`);
    expect(html).toContain('googleFonts.addEventListener("load", activateGoogleFonts, { once: true })');
    expect(html).toContain('if (googleFonts.sheet) activateGoogleFonts()');
    expect(html).toContain('googleFonts.media = "all"');
    expect(html).toContain(`<noscript><link href="${originalUrl}" rel="stylesheet" /></noscript>`);
  });
});
