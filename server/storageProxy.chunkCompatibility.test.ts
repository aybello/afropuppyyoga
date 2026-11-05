import express from "express";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ files: new Map<string, Buffer>(), reads: [] as string[] }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "https://storage.example", forgeApiKey: "test" } }));
vi.mock("./storage", () => ({
  storagePut: async (key: string, data: Buffer) => {
    state.files.set(key, Buffer.from(data));
    return { key, url: `https://files.example/${key}` };
  },
  storagePutFile: async (key: string, file: string) => {
    state.files.set(key, await readFile(file));
    return { key, url: `https://files.example/${key}` };
  },
  storageGet: async (key: string) => {
    state.reads.push(key);
    return { key, url: `https://files.example/${key}` };
  },
}));
import { registerStorageProxy } from "./_core/storageProxy";
import chunkRouter from "./chunkedUploadRoute";

let server: Server;
let base: string;
const httpFetch = globalThis.fetch;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerStorageProxy(app);
  app.use(chunkRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  state.files.clear();
  state.reads.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const key = String(url).replace("https://files.example/", "");
    const file = state.files.get(key);
    return file ? new Response(new Uint8Array(file)) : new Response("missing", { status: 404 });
  }));
});

it("blocks public chunk GETs while init, chunk, completion and status use server-side storage", async () => {
  const video = Buffer.alloc(40);
  video.write("ftyp", 4, "ascii");
  video.write("hvc1", 8, "ascii");
  const init = await httpFetch(`${base}/api/upload-video-init`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "video.mp4", totalChunks: 1, totalSize: video.length, chunkSize: video.length }),
  });
  expect(init.status).toBe(200);
  const { uploadId, key } = await init.json() as { uploadId: string; key: string };
  const manifestPath = `uploads/chunks/${uploadId}/manifest.json`;
  expect(state.files.has(manifestPath)).toBe(true);
  const blocked = await httpFetch(`${base}/manus-storage/${manifestPath}`);
  expect(blocked.status).toBe(404);
  expect(blocked.headers.get("cache-control")).toBe("private, no-store");
  const form = new FormData();
  form.set("uploadId", uploadId);
  form.set("chunkIndex", "0");
  form.set("chunk", new Blob([new Uint8Array(video)], { type: "video/mp4" }), "part.mp4");
  const uploaded = await httpFetch(`${base}/api/upload-video-chunk`, { method: "POST", body: form });
  expect(uploaded.status).toBe(200);
  const finished = await httpFetch(`${base}/api/upload-video-complete`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uploadId }),
  });
  expect(finished.status).toBe(200);
  expect(await finished.json()).toMatchObject({ key });
  expect(state.files.get(key)).toEqual(video);
  expect(state.reads).toContain(manifestPath);
  expect(state.reads).toContain(`uploads/chunks/${uploadId}/chunk-0`);
  const status = await httpFetch(`${base}/api/upload-video-status/${uploadId}`);
  expect(status.status).toBe(200);
  expect(await status.json()).toMatchObject({ status: "completed", key });
});
