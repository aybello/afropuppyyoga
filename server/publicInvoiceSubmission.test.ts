import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
const mocks = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), create: vi.fn(), db: vi.fn(), list: vi.fn(), update: vi.fn(), remove: vi.fn(), find: vi.fn(), llm: vi.fn(), access: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: mocks.put, storageGet: mocks.get }));
vi.mock("./db", () => ({ createInvoice: mocks.create, getDb: mocks.db, getAllInvoices: mocks.list, getInvoiceById: mocks.find, updateInvoice: mocks.update, deleteInvoice: mocks.remove }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.llm, listLLMModels: vi.fn(async () => ({ data: [{ id: "gemini-3.1-pro-preview" }] })) }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.access }));
import uploadRouter from "./uploadRoute";
import { invoicesRouter } from "./routers/invoices";
import { createInvoiceUploadReceipt, verifyInvoiceUploadReceipt } from "./invoiceUploadReceipt";
const fileKey = `invoices/${"a".repeat(64)}-${"b".repeat(32)}.pdf`;
const details = { fileKey, filename: "invoice.pdf", submitterName: "Fictional Payee", submitterEmail: "payee@example.com" };
const headers = vi.fn();
const ctx = (user: any = null) => ({ user, req: { headers: {} }, res: { setHeader: headers } }) as any;
let server: Server;
let url: string;
beforeAll(async () => {
  const app = express(); app.use(uploadRouter); server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as any).port}/api/upload-invoice`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("JWT_SECRET", "fictional-invoice-signing-secret");
  mocks.put.mockResolvedValue({ url: "https://example.com/private-file", key: fileKey });
  mocks.get.mockResolvedValue({ url: "https://example.com/private-file", key: fileKey });
  mocks.create.mockResolvedValue(99); mocks.list.mockResolvedValue([]);
  mocks.llm.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ staffName: null, position: null, payAmount: null, dueDate: null }) } }] });
  mocks.access.mockResolvedValue({ level: "team", canManageOperations: false });
  const q: any = { from: () => q, where: () => q, limit: async () => [] };
  mocks.db.mockResolvedValue({ select: () => q });
});
function form(pdf = "%PDF-1.7\nfictional invoice", email = "payee@example.com", website = "") {
  const body = new FormData(); body.append("submitterName", "Fictional Payee"); body.append("submitterEmail", email); body.append("website", website);
  body.append("invoice", new Blob([pdf], { type: "application/pdf" }), "invoice.pdf"); return body;
}
describe("public invoice upload", () => {
  it("uploads without a session and returns proof without a file URL", async () => {
    const response = await fetch(url, { method: "POST", body: form() });
    expect(response.status).toBe(200); const result = await response.json();
    expect(result.uploadReceipt).toEqual(expect.any(String)); expect(result.url).toBeUndefined(); expect(result.key).toBeUndefined();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await verifyInvoiceUploadReceipt(result.uploadReceipt)).toEqual(expect.objectContaining({ submitterName: details.submitterName, submitterEmail: details.submitterEmail, filename: details.filename }));
    expect(mocks.put).toHaveBeenCalledOnce();
  });
  it.each([["not a pdf", "payee@example.com", ""], ["%PDF-1.7", "bad email", ""], ["%PDF-1.7", "payee@example.com", "spam"]])("rejects invalid PDF/contact/honeypot before storage", async (pdf, email, website) => {
    const response = await fetch(url, { method: "POST", body: form(pdf, email, website) });
    expect(response.status).toBe(400); expect(mocks.put).not.toHaveBeenCalled();
  });
  it("rejects a missing PDF without requiring sign-in", async () => {
    expect((await fetch(url, { method: "POST" })).status).toBe(400); expect(mocks.put).not.toHaveBeenCalled();
  });
  it("rejects oversized and extra-file uploads before storage", async () => {
    const oversized = form(); oversized.set("invoice", new Blob([new Uint8Array(16 * 1024 * 1024 + 1)], { type: "application/pdf" }), "large.pdf");
    expect((await fetch(url, { method: "POST", body: oversized })).status).toBe(400);
    const extra = form(); extra.append("invoice", new Blob(["%PDF-1.7"]), "second.pdf");
    expect((await fetch(url, { method: "POST", body: extra })).status).toBe(400); expect(mocks.put).not.toHaveBeenCalled();
  });
});
describe("invoice receipt verification and registration", () => {
  it("stores supplied contact as unverified and never ties it to an unrelated signed-in account", async () => {
    const receipt = await createInvoiceUploadReceipt(details);
    expect(await invoicesRouter.createCaller(ctx()).submit({ uploadReceipt: receipt })).toEqual({ success: true });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ submittedByUserId: null, submittedByName: details.submitterName, submittedByEmail: details.submitterEmail, status: "pending", workflowStatus: "submitted" }));
    expect(headers).toHaveBeenCalledWith("Cache-Control", "no-store");
    await invoicesRouter.createCaller(ctx({ id: 123, name: "Unrelated user" })).submit({ uploadReceipt: receipt });
    expect(mocks.create.mock.calls[1][0].submittedByUserId).toBeNull();
  });
  it("rejects tampered, expired or wrong-audience proof before storage/database work", async () => {
    const valid = await createInvoiceUploadReceipt(details);
    const expired = await new SignJWT(details).setProtectedHeader({ alg: "HS256" }).setIssuer("apy-invoice-upload").setAudience("apy-invoice-submit").setIssuedAt(1).setExpirationTime(2).sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const wrong = await new SignJWT(details).setProtectedHeader({ alg: "HS256" }).setIssuer("apy-invoice-upload").setAudience("owner-auth").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    for (const token of [valid.slice(0, -8) + "tampered", expired, wrong]) await expect(invoicesRouter.createCaller(ctx()).submit({ uploadReceipt: token })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
  });
  it("rejects arbitrary keys and malformed contact receipt requests", async () => {
    await expect(createInvoiceUploadReceipt({ ...details, fileKey: "applications/private.pdf" })).rejects.toThrow();
    await expect(invoicesRouter.createCaller(ctx()).submit({ fileKey, filename: "invoice.pdf" } as any)).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("withholds duplicate IDs and handles concurrent duplicate inserts", async () => {
    const q: any = { from: () => q, where: () => q, limit: async () => [{ id: 98765 }] };
    mocks.db.mockResolvedValueOnce({ select: () => q }); const receipt = await createInvoiceUploadReceipt(details);
    await expect(invoicesRouter.createCaller(ctx()).submit({ uploadReceipt: receipt })).rejects.toMatchObject({ code: "CONFLICT", message: expect.not.stringContaining("98765") });
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.create.mockRejectedValueOnce({ cause: { code: "ER_DUP_ENTRY" } });
    await expect(invoicesRouter.createCaller(ctx()).submit({ uploadReceipt: receipt })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("keeps listing, review, approval, payments, edits and archives inaccessible anonymously and to team members", async () => {
    for (const user of [null, { id: 1, role: "staff" }]) {
      const caller = invoicesRouter.createCaller(ctx(user));
      const actions = [() => caller.list(), () => caller.review({ id: 1 }), () => caller.approve({ id: 1 }), () => caller.setTotal({ id: 1, totalAmountCents: 6000 }), () => caller.recordPayment({ id: 1, amountPaidCents: 6000 }), () => caller.archive({ id: 1 })];
      for (const action of actions) await expect(action()).rejects.toMatchObject({ code: user ? "FORBIDDEN" : "UNAUTHORIZED" });
    }
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("retains owner invoice visibility", async () => {
    mocks.access.mockResolvedValue({ level: "owner" });
    expect(await invoicesRouter.createCaller(ctx({ id: 1, role: "admin" })).list()).toEqual([]);
  });
});
