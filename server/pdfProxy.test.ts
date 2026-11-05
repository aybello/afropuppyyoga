import express from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), access: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticate } }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.access }));
import { canonicalPublishedHostRedirect } from "./canonicalHostRedirect";
import { pdfProxyCacheHeaders, registerPdfProxy } from "./_core/pdfProxy";

const nativeFetch = globalThis.fetch;
const pdfUrl = "https://d2xsxph8kpxj0f.cloudfront.net/synthetic.pdf";
const pdfBytes = Buffer.from("%PDF-1.7\nsynthetic applicant document");
let server: Server;
let base: string;
const upstreamFetch = vi.fn();

beforeAll(async () => {
  const app = express();
  app.use("/api/pdf-proxy", pdfProxyCacheHeaders);
  app.use(canonicalPublishedHostRedirect);
  app.use(express.json());
  registerPdfProxy(app);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}/api/pdf-proxy`;
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockResolvedValue({ id: 1 });
  mocks.access.mockResolvedValue({ canManageOperations: true });
  upstreamFetch.mockResolvedValue(new Response(pdfBytes, { status: 200 }));
  vi.stubGlobal("fetch", upstreamFetch);
});
function request(url = pdfUrl, init?: RequestInit) {
  return nativeFetch(`${base}?url=${encodeURIComponent(url)}`, init);
}
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("surrogate-control")).toBe("no-store");
  expect(response.headers.get("cdn-cache-control")).toBe("no-store");
}

describe("authenticated PDF proxy caching", () => {
  it("mounts protection before redirects, parsers and the route in production", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const header = source.indexOf('app.use("/api/pdf-proxy", pdfProxyCacheHeaders)');
    expect(header).toBeGreaterThan(-1);
    expect(header).toBeLessThan(source.indexOf("app.use(canonicalPublishedHostRedirect)"));
    expect(header).toBeLessThan(source.indexOf("app.use(express.json("));
    expect(header).toBeLessThan(source.indexOf("registerPdfProxy(app)"));
  });
  it("returns synthetic PDF bytes only to an authorized caller, without caching", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdfBytes);
    expect(upstreamFetch).toHaveBeenCalledExactlyOnceWith(pdfUrl);
    expect(mocks.access).toHaveBeenCalledOnce();
  });
  it.each(["missing", "exception", "forbidden"])("protects a %s authentication response", async (kind) => {
    if (kind === "missing") mocks.authenticate.mockResolvedValue(null);
    if (kind === "exception") mocks.authenticate.mockRejectedValue(new Error("synthetic auth error"));
    if (kind === "forbidden") mocks.access.mockResolvedValue({ canManageOperations: false });
    const response = await request();
    expect(response.status).toBe(kind === "forbidden" ? 403 : 401);
    expectPrivate(response);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
  it("protects invalid URL and upstream HTTP/transport errors", async () => {
    const invalid = await request("https://example.com/synthetic.pdf");
    expect(invalid.status).toBe(400); expectPrivate(invalid);
    expect(upstreamFetch).not.toHaveBeenCalled();
    const duplicated = await nativeFetch(`${base}?url=${encodeURIComponent(pdfUrl)}&url=${encodeURIComponent(pdfUrl)}`);
    expect(duplicated.status).toBe(400); expectPrivate(duplicated);
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockResolvedValueOnce(new Response("no", { status: 404 }));
    const upstream = await request();
    expect(upstream.status).toBe(404); expectPrivate(upstream);
    upstreamFetch.mockRejectedValueOnce(new Error("synthetic transport failure"));
    const failed = await request();
    expect(failed.status).toBe(500); expectPrivate(failed);
  });
  it("protects parsing errors before authentication", async () => {
    const response = await request(pdfUrl, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect(response.status).toBe(400); expectPrivate(response);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("protects canonical host redirects and HEAD responses", async () => {
    const redirect = await new Promise<{ status: number | undefined; headers: import("node:http").IncomingHttpHeaders }>((resolve, reject) => {
      const req = httpRequest(base, { headers: { Host: "afropuppyyoga.manus.space" } }, res => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
      });
      req.on("error", reject);
      req.end();
    });
    expect(redirect.status).toBe(301);
    expect(redirect.headers["cache-control"]).toBe("private, no-store");
    expect(redirect.headers["surrogate-control"]).toBe("no-store");
    expect(redirect.headers["cdn-cache-control"]).toBe("no-store");
    const head = await request(pdfUrl, { method: "HEAD" });
    expect(head.status).toBe(200); expectPrivate(head);
  });
});
