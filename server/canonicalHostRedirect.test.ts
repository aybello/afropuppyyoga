import express from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalPublishedHostRedirect } from "./canonicalHostRedirect";

let server: Server;
let base: string;
const preview = "3000-iaa3exp5z1khgyn0lupmd-7e1747e7.us1.manus.computer";
const photoPath = "/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg";
const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

beforeAll(async () => {
  const app = express();
  app.use(canonicalPublishedHostRedirect);
  app.get(photoPath, (_req, res) => res.type("image/jpeg").send(photoBytes));
  app.get("/manus-storage/invoices/test.pdf", (_req, res) => res.status(401).send("Authentication required"));
  app.get("/api/preview-check", (_req, res) => res.json({ environment: "preview" }));
  app.post("/api/preview-check", (_req, res) => res.json({ method: "POST", environment: "preview" }));
  app.get("*", (_req, res) => res.type("html").send("<h1>APY preview</h1>"));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server address unavailable");
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

// Native fetch in this runtime replaces a custom Host header with the URL's host.
// node:http preserves it, allowing these tests to exercise the actual host rule.
const request = (host: string, path = "/", method = "GET") => new Promise<Response>((resolve, reject) => {
  const req = httpRequest(`${base}${path}`, { method, headers: { Host: host } }, response => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("error", reject);
    response.on("end", () => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      resolve(new Response(new Uint8Array(Buffer.concat(chunks)), { status: response.statusCode ?? 500, headers }));
    });
  });
  req.on("error", reject);
  req.end();
});

describe("published host redirects do not break APY preview", () => {
  it.each([
    preview,
    `${preview}:443`,
    "3000-other-preview.us2.manus.computer",
    "localhost:3000",
    "127.0.0.1:3000",
    "[::1]:3000",
    "afropuppyyoga.ca",
    "www.afropuppyyoga.ca",
    "unrelated.manus.space",
    "afropuppyyoga.manus.space.attacker.example",
    "example-afropuppyyoga.manus.space",
  ])("keeps non-published host %s on its own page", async host => {
    const response = await request(host, "/puppy-yoga-guelph?source=preview");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toContain("APY preview");
  });

  it.each([
    "afropuppyyoga.manus.space",
    "afropuppy-tnrbecmt.manus.space",
    "AFROPUPPYYOGA.MANUS.SPACE:443",
    "afropuppyyoga.manus.space.",
  ])("keeps the permanent canonical redirect for published alias %s", async host => {
    const response = await request(host, "/puppy-yoga-guelph?utm_source=instagram&utm_campaign=fall%20classes");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://afropuppyyoga.ca/puppy-yoga-guelph?utm_source=instagram&utm_campaign=fall%20classes");
  });

  it("returns photo bytes on the preview host, not an off-origin redirect", async () => {
    const response = await request(preview, photoPath);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(photoBytes);
  });

  it("does not bypass downstream protection of private invoice files", async () => {
    const response = await request(preview, "/manus-storage/invoices/test.pdf");
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Authentication required");
  });

  it.each(["GET", "POST"])("keeps preview API %s requests in preview without redirecting to production", async method => {
    const response = await request(preview, "/api/preview-check", method);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    const body = await response.json();
    expect(body.environment).toBe("preview");
    if (method === "POST") expect(body.method).toBe("POST");
  });

  it("registers this middleware in the real server before protected storage and Vite", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    expect(source).toContain("app.use(canonicalPublishedHostRedirect)");
    expect(source).not.toContain('host.includes(".manus.computer")');
    expect(source.indexOf("app.use(canonicalPublishedHostRedirect)")).toBeLessThan(source.indexOf("registerStorageProxy(app)"));
    expect(source.indexOf("app.use(canonicalPublishedHostRedirect)")).toBeLessThan(source.indexOf("await setupVite"));
  });
});
