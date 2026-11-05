import express from "express";
import { createServer, request, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), fetch: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.auth } }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.access }));
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://storage.example", forgeApiKey: "test-key" } }));
import { registerStorageProxy, storageProxyCacheHeaders } from "./_core/storageProxy";
import { canonicalPublishedHostRedirect } from "./canonicalHostRedirect";
import { getLegacyImageRecoveryTarget } from "./legacyImageRecovery";

let server: Server;
let port: number;
// Use node:http so the actual request target (including dot segments) is not
// normalized by a browser or WHATWG URL before it reaches Express.
function get(path: string, method = "GET", options: { host?: string; body?: string } = {}): Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (options.host) headers.Host = options.host;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(options.body));
    }
    const req = request({ host: "127.0.0.1", port, method, path, headers }, res => {
      const data: Buffer[] = [];
      res.on("data", chunk => data.push(Buffer.from(chunk)));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(data).toString() }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(options.body);
  });
}

beforeAll(async () => {
  const app = express();
  // Match production's order: early headers, canonical redirect, parsers, legacy recovery, proxy.
  app.use("/manus-storage", storageProxyCacheHeaders);
  app.use(canonicalPublishedHostRedirect);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use((req, res, next) => {
    const replacement = getLegacyImageRecoveryTarget(req.path, req.get("referer"));
    if (!replacement) return next();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Referer");
    return res.redirect(302, replacement);
  });
  registerStorageProxy(app);
  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(err.status ?? 400).send(err.message));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as import("node:net").AddressInfo).port;
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.auth.mockRejectedValue(new Error("not authenticated"));
  mocks.access.mockResolvedValue({ level: "none", canManageOperations: false });
  mocks.fetch.mockImplementation(async (target: URL | string) => String(target).includes("presign/get")
    ? new Response(JSON.stringify({ url: "https://storage.example/signed" }))
    : new Response("synthetic bytes", { headers: { "content-type": "application/octet-stream" } }));
});

const noStore = "private, no-store";
function expectNoStore(headers: import("node:http").IncomingHttpHeaders) {
  expect(headers["cache-control"]).toBe(noStore);
  expect(headers["surrogate-control"]).toBe("no-store");
  expect(headers["cdn-cache-control"]).toBe("no-store");
}
describe("storage proxy HTTP security", () => {
  it.each(["applications/resumes/a.pdf", "applications/videos/a.mp4", "applications/legacy.pdf", "applications"]) (
    "denies anonymous access to %s before any upstream request", async path => {
      const response = await get(`/manus-storage/${path}`);
      expect(response.status).toBe(401);
      expectNoStore(response.headers);
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );
  it("denies ordinary team members but permits operations managers and owners", async () => {
    mocks.auth.mockResolvedValue({ id: 1 });
    for (const level of ["none", "team_member"]) {
      mocks.access.mockResolvedValue({ level, canManageOperations: false });
      const response = await get("/manus-storage/applications/videos/a.mp4");
      expect(response.status).toBe(403);
      expectNoStore(response.headers);
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
    for (const level of ["operations_manager", "owner"]) {
      mocks.access.mockResolvedValue({ level, canManageOperations: true });
      const response = await get("/manus-storage/applications/resumes/a.pdf");
      expect(response.status).toBe(200);
      expect(response.body).toBe("synthetic bytes");
      expectNoStore(response.headers);
    }
  });
  it.each(["uploads/chunks/id/manifest.json", "uploads/chunks/id/status.json", "uploads/chunks/id/chunk-0", "uploads/chunks", "UPLOADS//CHUNKS/id/chunk-0", "%75ploads%2fchunks/id/manifest.json"]) (
    "denies chunk namespace %s even to owners without authentication or upstream calls", async path => {
      mocks.auth.mockResolvedValue({ id: 1 });
      mocks.access.mockResolvedValue({ level: "owner", canManageOperations: true });
      const response = await get(`/manus-storage/${path}`);
      expect(response.status).toBe(404);
      expectNoStore(response.headers);
      expect(mocks.auth).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );
  it.each(["APPLICATIONS/videos/a.mp4", "//applications//resumes/a.pdf", "%61pplications%2fvideos/a.mp4", "InVoIcEs/a.pdf", "META-CAMPAIGNS/a.jpg"]) (
    "protects case, separator and encoding variant %s", async path => {
      const response = await get(`/MANUS-STORAGE/${path}`);
      expect(response.status).toBe(401);
      expectNoStore(response.headers);
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );
  it.each(["public/../applications/videos/a.mp4", "public/%2e%2e%2fapplications/a.pdf", "applications/%252e%252e/a.pdf", "public/%5capplications/a.pdf", "applications/%00a.pdf", "applications/%ZZ"]) (
    "rejects ambiguous or malformed key %s without upstream calls", async path => {
      const response = await get(`/manus-storage/${path}`);
      expect(response.status).toBe(400);
      expectNoStore(response.headers);
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );
  it("keeps invoice and campaign policies owner-only, even for operations managers", async () => {
    mocks.auth.mockResolvedValue({ id: 1 });
    mocks.access.mockResolvedValue({ level: "operations_manager", canManageOperations: true });
    for (const path of ["invoices/a.pdf", "meta-campaigns/a.jpg"]) {
      const response = await get(`/manus-storage/${path}`);
      expect(response.status).toBe(403);
      expectNoStore(response.headers);
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.access.mockResolvedValue({ level: "owner", canManageOperations: true });
    const response = await get("/manus-storage/meta-campaigns/a.jpg");
    expect(response.status).toBe(200);
    expectNoStore(response.headers);
  });
  it("retains public image access and cache policy without authentication", async () => {
    for (const path of ["logo.png", "assets/photo.jpg", "applications-photo.jpg", "uploads/other/image.png"]) {
      const response = await get(`/manus-storage/${path}`);
      expect(response.status).toBe(200);
      expect(response.body).toBe("synthetic bytes");
      expect(response.headers["cache-control"]).toBe("public, max-age=86400");
      expect(response.headers["surrogate-control"]).toBeUndefined();
      expect(response.headers["cdn-cache-control"]).toBeUndefined();
    }
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("marks upstream failures no-store and does not expose private URLs", async () => {
    mocks.auth.mockResolvedValue({ id: 1 });
    mocks.access.mockResolvedValue({ level: "owner", canManageOperations: true });
    mocks.fetch.mockResolvedValue(new Response("error", { status: 500 }));
    const response = await get("/manus-storage/applications/videos/a.mp4");
    expect(response.status).toBe(502);
    expectNoStore(response.headers);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("mounts storage headers in production before early responders", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const mount = source.indexOf('app.use("/manus-storage", storageProxyCacheHeaders)');
    expect(mount).toBeGreaterThan(-1);
    for (const later of ["app.use(canonicalPublishedHostRedirect)", "app.use(express.json(", "app.use(express.urlencoded(", "getLegacyImageRecoveryTarget(req.path", "registerStorageProxy(app)"]) {
      expect(source.indexOf(later)).toBeGreaterThan(mount);
    }
  });
  it.each(["GET", "HEAD"])("marks canonical and legacy redirects no-store on %s", async method => {
    const canonical = await get("/manus-storage/applications/resumes/a.pdf?x=1", method, { host: "afropuppyyoga.manus.space" });
    expect(canonical.status).toBe(301);
    expect(canonical.headers.location).toBe("https://afropuppyyoga.ca/manus-storage/applications/resumes/a.pdf?x=1");
    expectNoStore(canonical.headers);
    const legacy = await get("/manus-storage/IMG_0657_84447a5e.jpg", method);
    expect(legacy.status).toBe(302);
    expect(legacy.headers.location).toBe("/manus-storage/apy_kitchener_01_be82fd91.jpg");
    expectNoStore(legacy.headers);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["GET", "HEAD", "POST"])("marks malformed JSON parser errors no-store on %s", async method => {
    const response = await get("/manus-storage/applications/resumes/a.pdf", method, { body: "{" });
    expect(response.status).toBe(400);
    expectNoStore(response.headers);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("keeps public upstream errors no-store and allows public HEAD success", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("error", { status: 500 }));
    const failure = await get("/manus-storage/logo.png");
    expect(failure.status).toBe(502);
    expectNoStore(failure.headers);
    const success = await get("/manus-storage/logo.png", "HEAD");
    expect(success.status).toBe(200);
    expect(success.body).toBe("");
    expect(success.headers["cache-control"]).toBe("public, max-age=86400");
    expect(success.headers["surrogate-control"]).toBeUndefined();
    expect(success.headers["cdn-cache-control"]).toBeUndefined();
  });
  it("enforces the same restrictions on HEAD requests", async () => {
    const response = await get("/manus-storage/applications/resumes/a.pdf", "HEAD");
    expect(response.status).toBe(401);
    expectNoStore(response.headers);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
