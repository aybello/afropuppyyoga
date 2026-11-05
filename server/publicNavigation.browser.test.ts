import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt in with NAV_BROWSER_URL and NAV_PLAYWRIGHT_PATH (a playwright-core entry
// point). The normal unit suite does not require a browser or running server.
const url = process.env.NAV_BROWSER_URL;
const playwrightPath = process.env.NAV_PLAYWRIGHT_PATH;
const describeBrowser = url && playwrightPath ? describe : describe.skip;
const require = createRequire(import.meta.url);

// Playwright is an optional local test tool, not a production dependency.
let browser: any;
let page: any;

describeBrowser("public navigation browser regression", () => {
  beforeAll(async () => {
    const { chromium } = require(playwrightPath!);
    browser = await chromium.launch({
      executablePath: process.env.NAV_CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    page = await browser.newPage();
  });
  afterAll(async () => { await browser?.close(); });

  async function load(width: number, fontSize?: number) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.locator("header.apy-public-nav").waitFor();
    if (fontSize) await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` });
    await page.evaluate(() => document.fonts.ready);
  }

  async function measurements() {
    return page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>("header.apy-public-nav nav")!;
      const desktop = document.querySelector<HTMLElement>(".apy-desktop-nav")!;
      const parts = Array.from(nav.children).map((item) => item.getBoundingClientRect()).filter((rect) => rect.width);
      const controls = Array.from(nav.querySelectorAll<HTMLElement>("a,button"))
        .filter((item) => item.getBoundingClientRect().height > 0)
        .map((item) => {
          const textTops = Array.from(item.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()).flatMap((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return Array.from(range.getClientRects()).map((rect) => rect.top);
          });
          const rect = item.getBoundingClientRect();
          return { text: item.textContent?.trim(), left: rect.left, right: rect.right,
            width: rect.width, height: rect.height, lines: new Set(textTops).size };
        });
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        desktop: getComputedStyle(desktop).display !== "none",
        parts: parts.map((rect) => ({ left: rect.left, right: rect.right })), controls };
    });
  }

  it("keeps all desktop links unwrapped and controls inside the viewport", async () => {
    for (const width of [1280, 1309, 1366, 1440, 1535, 1536]) {
      await load(width);
      const layout = await measurements();
      expect(layout.desktop, `${width}px desktop navigation`).toBe(true);
      expect(layout.documentWidth, `${width}px document overflow`).toBeLessThanOrEqual(width);
      expect(layout.controls.every((control: { height: number; lines: number }) => control.height >= 44 && control.lines <= 1)).toBe(true);
      for (let i = 0; i < layout.parts.length; i++) {
        expect(layout.parts[i].left).toBeGreaterThanOrEqual(0);
        expect(layout.parts[i].right).toBeLessThanOrEqual(width);
        if (i) expect(layout.parts[i - 1].right).toBeLessThanOrEqual(layout.parts[i].left);
      }
    }
  }, 60_000);

  it("reflows at zoom-equivalent widths and keeps enlarged-text mobile controls reachable", async () => {
    for (const width of [320, 390, 640, 768, 910, 1024, 1092, 1241, 1279]) {
      await load(width);
      const layout = await measurements();
      expect(layout.desktop).toBe(false);
      expect(layout.documentWidth).toBeLessThanOrEqual(width);
      expect(layout.controls.every((control: { height: number }) => control.height >= 44)).toBe(true);
    }
    for (const [width, fontSize] of [[320, 20], [320, 24], [320, 32], [390, 32], [768, 32], [1366, 20], [1366, 24], [1366, 32]]) {
      await load(width, fontSize);
      const layout = await measurements();
      expect(layout.desktop).toBe(false);
      for (let i = 0; i < layout.parts.length; i++) {
        expect(layout.parts[i].left).toBeGreaterThanOrEqual(0);
        expect(layout.parts[i].right).toBeLessThanOrEqual(width);
        if (i) expect(layout.parts[i - 1].right).toBeLessThanOrEqual(layout.parts[i].left);
      }
      await page.getByRole("button", { name: "Toggle menu" }).click();
      expect(await page.locator("#apy-mobile-navigation").getByRole("link", { name: "Book a Class" }).count()).toBe(1);
    }
  }, 60_000);

  it("keeps the reported text-size and viewport boundaries accessible without clipping", async () => {
    for (const [width, fontSize] of [[832, 32], [833, 32], [834, 32], [959, 12], [960, 12], [961, 12]]) {
      await load(width, fontSize);
      const layout = await measurements();
      expect(layout.desktop, `${width}px at ${fontSize}px root`).toBe(false);
      expect(layout.documentWidth, `${width}px document overflow`).toBeLessThanOrEqual(width);
      for (const control of layout.controls) {
        expect(control.left, `${width}px ${control.text} left`).toBeGreaterThanOrEqual(0);
        expect(control.right, `${width}px ${control.text} right`).toBeLessThanOrEqual(width);
        expect(control.width, `${width}px ${control.text} width`).toBeGreaterThanOrEqual(44);
        expect(control.height, `${width}px ${control.text} height`).toBeGreaterThanOrEqual(44);
        expect(control.lines, `${width}px ${control.text} wraps`).toBeLessThanOrEqual(1);
      }
      for (let i = 1; i < layout.parts.length; i++) {
        expect(layout.parts[i - 1].right, `${width}px overlapping header groups`).toBeLessThanOrEqual(layout.parts[i].left);
      }
      const toggle = page.getByRole("button", { name: "Toggle menu" });
      await toggle.click();
      const menu = page.locator("#apy-mobile-navigation");
      const book = menu.getByRole("link", { name: "Book a Class", exact: true });
      expect(await menu.locator("li").first().getByRole("link", { name: "Book a Class" }).count()).toBe(1);
      expect(await book.isVisible()).toBe(true);
      await expect.poll(async () => {
        const rect = await book.boundingBox();
        return rect.x + rect.width;
      }).toBeLessThanOrEqual(width);
      const bounds = await book.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
      await page.keyboard.press("Escape");
      expect(await toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    }
  }, 60_000);

  it("changes layout and booking availability safely at their physical and text-size boundaries", async () => {
    await load(1279, 12);
    expect((await measurements()).desktop).toBe(false);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(async () => (await measurements()).desktop).toBe(true);
    const desktopLayout = await measurements();
    for (const control of desktopLayout.controls) {
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(1280);
      expect(control.width).toBeGreaterThanOrEqual(44);
      expect(control.height).toBeGreaterThanOrEqual(44);
      expect(control.lines).toBeLessThanOrEqual(1);
    }

    await load(1280, 32);
    const booking = page.locator(".apy-nav-booking");
    const toggle = page.locator(".apy-mobile-toggle");
    expect(await booking.isVisible()).toBe(true);
    await booking.focus();
    await page.setViewportSize({ width: 1279, height: 900 });
    await expect.poll(() => booking.isVisible()).toBe(false);
    await expect.poll(() => toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await toggle.click();
    expect(await page.locator("#apy-mobile-navigation li").first().getByRole("link", { name: "Book a Class" }).isVisible()).toBe(true);
  }, 30_000);

  it("supports More and mobile menu keyboard interaction and Escape focus return", async () => {
    await load(1366);
    const more = page.getByRole("button", { name: "More" });
    await more.focus();
    await page.keyboard.press("Enter");
    expect(await more.getAttribute("aria-expanded")).toBe("true");
    expect(await page.locator("#apy-more-navigation a").count()).toBe(9);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("🖼️ Gallery");
    await page.keyboard.press("Escape");
    expect(await more.getAttribute("aria-expanded")).toBe("false");
    expect(await more.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await load(390);
    const toggle = page.getByRole("button", { name: "Toggle menu" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    for (const name of ["Home", "Experience", "Memberships", "Private Events", "Class Pictures", "Careers", "🐾 Rewards", "🖼️ Gallery", "📍 Kitchener", "📍 Hamilton", "📍 Oakville", "📍 Guelph", "🏢 Corporate Events", "🤝 Partnerships", "🐶 Private Event Quote", "🌿 Ethical Standards", "Staff Portal", "Book a Class"]) {
      expect(await page.locator("#apy-mobile-navigation").getByRole("link", { name, exact: true }).count()).toBe(1);
    }
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
  }, 30_000);

  it("closes obsolete menus across viewport resizes and Escape returns focus to the visible toggle", async () => {
    await load(390);
    const toggle = page.locator(".apy-mobile-toggle");
    const more = page.locator(".apy-desktop-nav button");
    await toggle.click();
    await page.locator("#apy-mobile-navigation a").first().focus();
    await page.setViewportSize({ width: 1366, height: 900 });
    await expect.poll(() => toggle.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => more.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await more.click();
    await page.locator("#apy-more-navigation a").first().focus();
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(() => more.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await toggle.click();
    await page.locator("#apy-mobile-navigation a").first().focus();
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    expect(await page.locator("#apy-more-navigation").count()).toBe(0);
  }, 30_000);

  it("synchronizes menus on root text-size and container-width changes without stealing outside focus", async () => {
    await load(1366);
    const toggle = page.locator(".apy-mobile-toggle");
    const more = page.locator(".apy-desktop-nav button");
    await more.click();
    await page.locator("#apy-more-navigation a").first().focus();
    await page.evaluate(() => { document.documentElement.style.fontSize = "24px"; });
    await expect.poll(() => more.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await page.keyboard.press("Escape");
    expect(await toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await toggle.click();
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await toggle.click();
    await page.locator("#apy-mobile-navigation a").first().focus();
    await page.evaluate(() => { document.documentElement.style.fontSize = "16px"; });
    await expect.poll(() => toggle.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => more.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await more.click();
    await page.keyboard.press("Escape");
    expect(await more.getAttribute("aria-expanded")).toBe("false");
    expect(await more.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);

    await more.click();
    const brand = page.locator("header.apy-public-nav nav > a");
    await brand.focus();
    await page.evaluate(() => { document.querySelector<HTMLElement>(".apy-nav-responsive")!.style.width = "390px"; });
    await expect.poll(() => more.getAttribute("aria-expanded")).toBe("false");
    expect(await brand.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
  }, 30_000);

  it("keeps menus open within one layout and moves focus off hidden desktop links and staff", async () => {
    await load(1366);
    const more = page.locator(".apy-desktop-nav button");
    const toggle = page.locator(".apy-mobile-toggle");
    await more.click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100);
    expect(await more.getAttribute("aria-expanded")).toBe("true");
    await page.keyboard.press("Escape");
    await page.locator(".apy-desktop-nav a").first().focus();
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(() => toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await page.setViewportSize({ width: 1366, height: 900 });
    await expect.poll(() => more.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await page.locator(".apy-desktop-staff").focus();
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(() => toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
    await page.locator(".apy-nav-booking").focus();
    await page.evaluate(() => { document.documentElement.style.fontSize = "24px"; });
    await expect.poll(() => toggle.evaluate((element: HTMLElement) => element === document.activeElement)).toBe(true);
  }, 30_000);
});
