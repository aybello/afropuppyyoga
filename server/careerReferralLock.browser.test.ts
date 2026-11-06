import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import react from "@vitejs/plugin-react";
import { createServer, type ViteDevServer } from "vite";
import superjson from "superjson";

// Opt in with a locally installed playwright-core. This starts an isolated Vite
// server, intercepts every API call, and blocks all external network requests.
const playwrightPath = process.env.CAREERS_PLAYWRIGHT_PATH;
const describeBrowser = playwrightPath ? describe : describe.skip;
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

describeBrowser("career referral submission lock (isolated browser)", () => {
  let vite: ViteDevServer;
  let browser: any;
  let page: any;
  let origin: string;

  beforeAll(async () => {
    vite = await createServer({
      configFile: false,
      root: path.join(root, "client"),
      plugins: [react()],
      resolve: { alias: {
        "@": path.join(root, "client/src"),
        "@shared": path.join(root, "shared"),
      } },
      server: { host: "127.0.0.1", port: 0, hmr: false },
      logLevel: "error",
    });
    await vite.listen();
    const address = vite.httpServer!.address();
    if (!address || typeof address === "string") throw new Error("No local Vite port");
    origin = `http://127.0.0.1:${address.port}`;
    const { chromium } = require(playwrightPath!);
    browser = await chromium.launch({
      executablePath: process.env.CAREERS_CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    page = await browser.newPage();
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
    await vite?.close();
  });

  it("stays locked across retry and pending submission, then permits correction and reuse of uploads", async () => {
    const initGate = deferred();
    const resumeGate = deferred();
    const mutationGate = deferred();
    const videoFailureGate = deferred();
    let initCount = 0;
    let resumeCount = 0;
    let mutationCount = 0;
    const payloads: any[] = [];
    let savedApplication: any;

    await page.route("**/*", async (route: any) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/careers") return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      });
      if (url.pathname === "/api/upload-video-init") {
        initCount++;
        if (initCount === 1) return route.fulfill({ status: 503, headers: { "Retry-After": "0.001" }, body: "retry" });
        if (initCount === 3) {
          await videoFailureGate.promise;
          return route.fulfill({ status: 400, json: { error: "Synthetic video failure" } });
        }
        await initGate.promise;
        return route.fulfill({ json: { uploadId: "synthetic-upload" } });
      }
      if (url.pathname === "/api/upload-video-chunk") return route.fulfill({ json: { ok: true } });
      if (url.pathname === "/api/upload-video-complete") return route.fulfill({ json: { url: "https://example.invalid/video", key: "video-key" } });
      if (url.pathname === "/api/upload-resume") {
        resumeCount++;
        if (resumeCount === 1) {
          await resumeGate.promise;
          return route.fulfill({ status: 500, json: { error: "synthetic failure" } });
        }
        return route.fulfill({ json: { url: "https://example.invalid/resume", key: "resume-key" } });
      }
      if (url.pathname.startsWith("/api/trpc/careers.submitApplication")) {
        mutationCount++;
        payloads.push(superjson.deserialize(JSON.parse(request.postData())["0"]));
        if (mutationCount === 1) {
          // Simulate persistence followed by a lost response, not a failed save.
          savedApplication = { ...payloads[0] };
          await mutationGate.promise;
          return route.abort("connectionreset");
        }
        if (mutationCount === 2) return route.fulfill({ json: [{ result: { data: { json: { success: true, duplicate: true, notificationWarning: false } } } }] });
        return route.fulfill({ json: [{ result: { data: { json: { success: true } } } }] });
      }
      // No unmocked API or mutating request is ever allowed through.
      if (url.pathname.startsWith("/api/") || request.method() !== "GET") return route.abort();
      return route.continue();
    });

    try {
      await page.goto(`${origin}/careers`);
      await page.getByRole("button", { name: "Apply", exact: true }).first().click();
      const referral = page.getByLabel("Referred By");
      await page.getByPlaceholder("Your full name").fill("Test Applicant");
      await page.getByPlaceholder("your@email.com").fill("test@example.invalid");
      await referral.fill("  First Referrer  ");
      await page.locator('input[accept^=".pdf"]').setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("test resume") });
      await page.locator('input[accept=".mp4,.mov,.webm,.avi"]').setInputFiles({ name: "video.mp4", mimeType: "video/mp4", buffer: Buffer.from("test video") });

      // Observe disabled transitions before clicking; any upload/mutation handoff
      // flicker would be recorded as a false transition.
      await page.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>("#career-referred-by")!;
        (window as any).__referralDisabledTransitions = [];
        new MutationObserver(() => (window as any).__referralDisabledTransitions.push(input.disabled))
          .observe(input, { attributes: true, attributeFilter: ["disabled"] });
      });
      await page.getByRole("button", { name: "Submit Application" }).click();
      await expect.poll(() => initCount).toBe(2);
      expect(await referral.isDisabled()).toBe(true);
      expect(await referral.getAttribute("aria-describedby")).toContain("career-referred-by-help");
      expect(await page.locator("#career-referred-by-help").innerText()).toMatch(/locked while your application uploads and submits/i);
      expect(await referral.inputValue()).toBe("  First Referrer  ");
      initGate.resolve();
      await expect.poll(() => resumeCount).toBe(1);
      expect(await referral.isDisabled()).toBe(true);
      resumeGate.resolve();
      await expect.poll(() => referral.isEnabled()).toBe(true);
      expect(await page.getByRole("alert").innerText()).toContain("synthetic failure");
      await referral.fill("  Corrected After Upload  ");
      await page.getByRole("button", { name: "Submit Application" }).click();
      await expect.poll(() => mutationCount).toBe(1);
      expect(await referral.isDisabled()).toBe(true);
      expect(payloads[0].referredBy).toBe("Corrected After Upload");
      expect(initCount).toBe(2); // failed request + retry; successful video reused
      expect(resumeCount).toBe(2);
      const transitions = await page.evaluate(() => (window as any).__referralDisabledTransitions);
      expect(transitions).toEqual([true, false, true]); // no upload-to-mutation unlock
      mutationGate.resolve();
      await expect.poll(() => referral.isEnabled()).toBe(true);
      expect(await page.getByRole("alert").innerText()).toMatch(/may already have been saved/i);
      expect(await page.getByRole("alert").innerText()).toMatch(/changes.*may not update the original application/i);
      expect(await page.getByRole("alert").locator('a[href="mailto:afropuppyyoga@gmail.com"]').count()).toBe(1);
      await referral.fill("  Final Referrer  ");
      expect(await page.getByRole("alert").innerText()).toMatch(/may already have been saved/i);
      await page.getByRole("button", { name: "Submit Application" }).click();
      await expect.poll(() => mutationCount).toBe(2);
      expect(payloads[1].referredBy).toBe("Final Referrer");
      expect(payloads[1].submissionKey).toBe(payloads[0].submissionKey);
      expect(savedApplication.referredBy).toBe("Corrected After Upload");
      expect(initCount).toBe(2);
      expect(resumeCount).toBe(2); // successful resume reused too
      await page.getByText("Application Received!").waitFor();
      expect(await page.getByText(/An application has already been received/).innerText()).toMatch(/changes.*may not update the original application/i);
      expect(await page.getByRole("alert").count()).toBe(0);
      expect(await page.locator('a[href="mailto:afropuppyyoga@gmail.com"]').count()).toBeGreaterThan(0);

      // A fresh form may still be submitted with no referral.
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("button", { name: "Apply", exact: true }).first().click();
      await page.getByPlaceholder("Your full name").fill("Another Applicant");
      await page.getByPlaceholder("your@email.com").fill("another@example.invalid");
      await page.locator('input[accept^=".pdf"]').setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("test resume") });
      await page.getByRole("button", { name: "Paste a Link" }).click();
      await page.getByPlaceholder("https://youtube.com/... or Google Drive / Dropbox link").fill("https://example.invalid/video");
      await page.getByRole("button", { name: "Submit Application" }).click();
      await expect.poll(() => mutationCount).toBe(3);
      expect(payloads[2].referredBy).toBeUndefined();
      await page.getByText("Application Received!").waitFor();
      await page.getByText(/We'll review it and reach out/).waitFor();

      // A video upload failure also unlocks the referral and preserves the
      // existing option to retry using a pasted video link.
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("button", { name: "Apply", exact: true }).first().click();
      await page.getByPlaceholder("Your full name").fill("Video Failure Applicant");
      await page.getByPlaceholder("your@email.com").fill("video@example.invalid");
      await referral.fill("Before Video Failure");
      await page.locator('input[accept^=".pdf"]').setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("test resume") });
      await page.locator('input[accept=".mp4,.mov,.webm,.avi"]').setInputFiles({ name: "video.mp4", mimeType: "video/mp4", buffer: Buffer.from("test video") });
      await page.getByRole("button", { name: "Submit Application" }).click();
      await expect.poll(() => initCount).toBe(3);
      expect(await referral.isDisabled()).toBe(true);
      videoFailureGate.resolve();
      await expect.poll(() => referral.isEnabled()).toBe(true);
      expect(await page.getByRole("alert").innerText()).toContain("Synthetic video failure");
      await referral.fill("Corrected After Video Failure");
      await page.getByRole("button", { name: "Paste a Link" }).click();
      await page.getByPlaceholder("https://youtube.com/... or Google Drive / Dropbox link").fill("https://example.invalid/video");
      await page.getByRole("button", { name: "Submit Application" }).click();
      await expect.poll(() => mutationCount).toBe(4);
      expect(payloads[3].referredBy).toBe("Corrected After Video Failure");
      await page.getByText("Application Received!").waitFor();
    } finally {
      initGate.resolve();
      resumeGate.resolve();
      mutationGate.resolve();
      videoFailureGate.resolve();
    }
  }, 60_000);

  it("starts the submit while offline and does not replay it after close and reconnect", async () => {
    await page.unrouteAll({ behavior: "wait" });
    const resumeGate = deferred();
    const mutationGate = deferred();
    let resumeCount = 0;
    let mutationCount = 0;

    await page.route("**/*", async (route: any) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/careers") return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      });
      if (url.pathname === "/api/upload-resume") {
        resumeCount++;
        await resumeGate.promise;
        return route.fulfill({ json: { url: "https://example.invalid/resume", key: "resume-key" } });
      }
      if (url.pathname.startsWith("/api/trpc/careers.submitApplication")) {
        mutationCount++;
        await mutationGate.promise;
        return route.abort("internetdisconnected");
      }
      if (url.pathname.startsWith("/api/") || request.method() !== "GET") return route.abort();
      return route.continue();
    });

    try {
      await page.goto(`${origin}/careers`);
      await page.getByRole("button", { name: "Apply", exact: true }).first().click();
      await page.getByPlaceholder("Your full name").fill("Offline Applicant");
      await page.getByPlaceholder("your@email.com").fill("offline@example.invalid");
      await page.getByLabel("Referred By").fill("Offline Referrer");
      await page.locator('input[accept^=".pdf"]').setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("test resume") });
      await page.getByRole("button", { name: "Paste a Link" }).click();
      await page.getByPlaceholder("https://youtube.com/... or Google Drive / Dropbox link").fill("https://example.invalid/video");
      await page.getByRole("button", { name: "Submit Application" }).click();
      await expect.poll(() => resumeCount).toBe(1);
      await page.context().setOffline(true);
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
      resumeGate.resolve();
      // networkMode: online would leave the mutation paused here instead.
      await expect.poll(() => mutationCount, { timeout: 5_000 }).toBe(1);
      await page.getByRole("button", { name: "Close application form" }).click();
      const requestFailed = page.waitForEvent("requestfailed", {
        predicate: (request: any) => request.url().includes("careers.submitApplication"),
      });
      mutationGate.resolve();
      await requestFailed;
      await page.context().setOffline(false);
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
      await page.waitForTimeout(1_000);
      expect(mutationCount).toBe(1);
    } finally {
      resumeGate.resolve();
      mutationGate.resolve();
      await page.context().setOffline(false);
      await page.unrouteAll({ behavior: "wait" });
    }
  }, 30_000);
});
