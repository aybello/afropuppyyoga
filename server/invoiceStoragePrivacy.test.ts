import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), fetch: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.auth } }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.access }));
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://example.com", forgeApiKey: "fictional-test-only" } }));
import { registerStorageProxy } from "./_core/storageProxy";
let server: Server; let url: string;
const realFetch = globalThis.fetch;
beforeAll(async () => {
  const app = express(); registerStorageProxy(app); server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => { vi.unstubAllGlobals(); await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch);
  mocks.auth.mockRejectedValue(new Error("not signed in")); mocks.access.mockResolvedValue({ level: "team" });
  mocks.fetch.mockImplementation(async (request: any) => String(request).includes("presign/get") ? new Response(JSON.stringify({ url: "https://example.com/fake-pdf" })) : new Response("%PDF-fictional", { headers: { "Content-Type": "application/pdf" } }));
});
describe("invoice storage privacy", () => {
  it("blocks anonymous invoice downloads before contacting storage", async () => {
    const response = await realFetch(`${url}/manus-storage/invoices/test.pdf`);
    expect(response.status).toBe(401); expect(mocks.fetch).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects encoded traversal and double encoding before storage access", async () => {
    for (const path of ["assets/%2e%2e%2finvoices/test.pdf", "%2569nvoices/test.pdf", "assets/%5cinvoices/test.pdf"]) {
      expect((await realFetch(`${url}/manus-storage/${path}`)).status).toBe(400);
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("blocks team and Operations Manager downloads", async () => {
    mocks.auth.mockResolvedValue({ id: 2 });
    for (const level of ["team", "operations_manager"]) {
      mocks.access.mockResolvedValue({ level });
      expect((await realFetch(`${url}/manus-storage/invoices/test.pdf`)).status).toBe(403);
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("allows owner downloads with private no-store caching", async () => {
    mocks.auth.mockResolvedValue({ id: 1 }); mocks.access.mockResolvedValue({ level: "owner" });
    const response = await realFetch(`${url}/manus-storage/invoices/test.pdf`);
    expect(response.status).toBe(200); expect(await response.text()).toBe("%PDF-fictional");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("keeps public image access unchanged", async () => {
    const response = await realFetch(`${url}/manus-storage/logo.png`);
    expect(response.status).toBe(200); expect(mocks.auth).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
  });
});
