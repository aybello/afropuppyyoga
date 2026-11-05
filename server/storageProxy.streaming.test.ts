import express from "express";
import { createServer, request, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.auth } }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.access }));
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://forge.example", forgeApiKey: "test" } }));
import { registerStorageProxy } from "./_core/storageProxy";

const nativeFetch = globalThis.fetch;
let upstream: Server;
let proxy: Server;
let upstreamPort: number;
let proxyPort: number;
let upstreamHandler: (res: ServerResponse) => void;

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

beforeAll(async () => {
  upstream = createServer((_req, res) => upstreamHandler(res));
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  upstreamPort = (upstream.address() as AddressInfo).port;
  const app = express();
  registerStorageProxy(app);
  proxy = createServer(app);
  await new Promise<void>(resolve => proxy.listen(0, "127.0.0.1", resolve));
  proxyPort = (proxy.address() as AddressInfo).port;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  upstream.closeAllConnections();
  proxy.closeAllConnections();
  await Promise.all([upstream, proxy].map(server => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))));
});

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.auth.mockResolvedValue({ id: 1 });
  mocks.access.mockResolvedValue({ level: "owner", canManageOperations: true });
  vi.stubGlobal("fetch", vi.fn((url: string | URL, init?: RequestInit) => String(url).includes("presign/get")
    ? Promise.resolve(new Response(JSON.stringify({ url: `http://127.0.0.1:${upstreamPort}/object` })))
    : nativeFetch(url, init)));
});

function get(path: string) {
  return new Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: proxyPort, path }, res => {
      const chunks: Buffer[] = [];
      res.on("data", chunk => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

function expectPrivate(headers: import("node:http").IncomingHttpHeaders) {
  expect(headers["cache-control"]).toBe("private, no-store");
  expect(headers["surrogate-control"]).toBe("no-store");
  expect(headers["cdn-cache-control"]).toBe("no-store");
}

describe("storage proxy streaming", () => {
  it.each(["logo.png", "applications/resumes/private.pdf"])("returns an uncacheable 502 when %s fails before its first byte", async key => {
    const ready = deferred<ServerResponse>();
    upstreamHandler = res => {
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": "100" });
      res.flushHeaders();
      ready.resolve(res);
    };
    const response = get(`/manus-storage/${key}`);
    const source = await ready.promise;
    // Let fetch resolve from the flushed headers, then fail its body asynchronously.
    await new Promise(resolve => setTimeout(resolve, 100));
    source.destroy();
    const result = await response;
    expect(result.status).toBe(502);
    expectPrivate(result.headers);
    expect(result.headers["content-type"]).toMatch(/^text\/html/);
    expect(result.body).toBe("Storage proxy error");
    expect(Number(result.headers["content-length"])).toBe(Buffer.byteLength(result.body));
  });

  it.each(["logo.png", "applications/resumes/private.pdf"])("aborts an already-started %s response on an upstream failure", async key => {
    const ready = deferred<ServerResponse>();
    const firstByte = deferred<void>();
    const aborted = deferred<void>();
    upstreamHandler = res => {
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": "100" });
      res.write("first-byte");
      ready.resolve(res);
    };
    const req = request({ host: "127.0.0.1", port: proxyPort, path: `/manus-storage/${key}` }, res => {
      expect(res.statusCode).toBe(200);
      if (key.startsWith("applications")) expectPrivate(res.headers);
      else expect(res.headers["cache-control"]).toBe("public, max-age=86400");
      res.once("data", chunk => {
        expect(chunk.toString()).toBe("first-byte");
        firstByte.resolve();
      });
      res.once("aborted", () => aborted.resolve());
      res.on("error", () => {});
    });
    req.on("error", () => {});
    req.end();
    const source = await ready.promise;
    await firstByte.promise;
    source.destroy();
    await aborted.promise;
  });

  it("cancels the upstream HTTP stream when the client disconnects after receiving bytes", async () => {
    const upstreamClosed = deferred<void>();
    upstreamHandler = res => {
      res.once("close", () => upstreamClosed.resolve());
      res.writeHead(200, { "Content-Type": "image/png" });
      res.write("first-byte");
    };
    const req = request({ host: "127.0.0.1", port: proxyPort, path: "/manus-storage/logo.png" }, res => {
      res.once("data", () => res.destroy());
      res.on("error", () => {});
    });
    req.on("error", () => {});
    req.end();
    await upstreamClosed.promise;
  });

  it("cancels the upstream when the client disconnects before the first byte", async () => {
    const upstreamReady = deferred<void>();
    const upstreamClosed = deferred<void>();
    upstreamHandler = res => {
      res.once("close", () => upstreamClosed.resolve());
      res.writeHead(200, { "Content-Type": "image/png" });
      res.flushHeaders();
      upstreamReady.resolve();
    };
    const req = request({ host: "127.0.0.1", port: proxyPort, path: "/manus-storage/logo.png" });
    req.on("error", () => {});
    req.end();
    await upstreamReady.promise;
    req.destroy();
    await upstreamClosed.promise;
  });

  it("aborts a pending presign fetch when the client disconnects", async () => {
    const started = deferred<void>();
    const cancelled = deferred<void>();
    vi.stubGlobal("fetch", vi.fn((_url: string | URL, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => {
        cancelled.resolve();
        reject(new Error("aborted"));
      }, { once: true });
      started.resolve();
    })));
    const req = request({ host: "127.0.0.1", port: proxyPort, path: "/manus-storage/logo.png" });
    req.on("error", () => {});
    req.end();
    await started.promise;
    req.destroy();
    await cancelled.promise;
  });
});
