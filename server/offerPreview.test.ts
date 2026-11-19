import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getJobApplicationById: vi.fn(), getSigningTokenByApplicationId: vi.fn(), access: vi.fn(), send: vi.fn() }));
vi.mock("./db", () => ({ getJobApplicationById: mocks.getJobApplicationById, getSigningTokenByApplicationId: mocks.getSigningTokenByApplicationId, getDb: vi.fn(() => { throw new Error("Preview must not open a write transaction"); }) }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.access }));
vi.mock("./email", () => ({ sendEmail: mocks.send }));
import { signingRouter } from "./routers/signing";
import { createOfferDocumentSnapshot } from "./offerDocumentSnapshot";

const app = { id: 41, name: "Fictional Applicant", email: "fiction@example.com", role: "Operations Specialist", location: "GUE", deletedAt: null };
const offer = { id: 9, applicationId: app.id, applicantName: app.name, applicantEmail: app.email, role: app.role, location: app.location, offerLetterType: "operations_specialist", signed: 0, createdAt: new Date("2026-11-01T12:00:00Z"), expiresAt: new Date("2099-01-01"), token: "private-token-never-returned", signedDocumentSnapshot: null as string | null };
function caller(user: object | null = { id: 1, role: "admin" }) {
  const setHeader = vi.fn();
  return { api: signingRouter.createCaller({ user, res: { setHeader } } as never), setHeader };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ level: "owner", canManageOperations: true });
  mocks.getJobApplicationById.mockResolvedValue(app);
  mocks.getSigningTokenByApplicationId.mockResolvedValue(undefined);
});
describe("read-only role offer preview", () => {
  it("renders a fresh Operations Specialist offer and NDA without generating a signing link or sending", async () => {
    const { api, setHeader } = caller();
    const result = await api.previewOffer({ applicationId: app.id });
    expect(result.kind).toBe("draft");
    expect(result.offerHtml).toContain("Operations Specialist");
    expect(result.offerHtml).toContain("$20.00 per hour");
    expect(result.ndaHtml).toContain(app.name);
    expect(JSON.stringify(result)).not.toContain("token");
    expect(mocks.getSigningTokenByApplicationId).toHaveBeenCalledWith(app.id);
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reuses the exact current unsigned document date and saved terms", async () => {
    mocks.getSigningTokenByApplicationId.mockResolvedValue(offer);
    const result = await caller().api.previewOffer({ applicationId: app.id });
    expect(result).toEqual({ ...createOfferDocumentSnapshot(offer), kind: "current" });
    expect(JSON.stringify(result)).not.toContain(offer.token);
  });
  it("renders a new-role draft rather than previewing a stale unsigned role", async () => {
    mocks.getSigningTokenByApplicationId.mockResolvedValue({ ...offer, role: "Puppy Monitor", offerLetterType: "puppy_monitor_kw" });
    const result = await caller().api.previewOffer({ applicationId: app.id });
    expect(result.kind).toBe("draft");
    expect(result.offerHtml).toContain("Operations Specialist");
    expect(result.offerHtml).not.toContain("position of <strong>Puppy Monitor</strong>");
  });
  it("shows the saved signed snapshot even when the applicant role has changed", async () => {
    const historical = { ...offer, role: "Puppy Monitor", offerLetterType: "puppy_monitor_kw" };
    const snapshot = createOfferDocumentSnapshot(historical);
    mocks.getSigningTokenByApplicationId.mockResolvedValue({ ...historical, signed: 1, signedDocumentSnapshot: JSON.stringify(snapshot) });
    expect(await caller().api.previewOffer({ applicationId: app.id })).toEqual({ ...snapshot, kind: "signed" });
  });
  it("labels a missing historic snapshot as reconstruction and never replaces it", async () => {
    mocks.getSigningTokenByApplicationId.mockResolvedValue({ ...offer, signed: 1 });
    expect((await caller().api.previewOffer({ applicationId: app.id })).kind).toBe("legacy");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("fails closed on a corrupt saved signed snapshot", async () => {
    mocks.getSigningTokenByApplicationId.mockResolvedValue({ ...offer, signed: 1, signedDocumentSnapshot: "invalid" });
    await expect(caller().api.previewOffer({ applicationId: app.id })).rejects.toThrow();
  });
  it("rejects ordinary staff and unauthenticated access before reading applicant data", async () => {
    mocks.access.mockResolvedValue({ level: "staff", canManageOperations: false });
    await expect(caller({ id: 3 }).api.previewOffer({ applicationId: app.id })).rejects.toThrow();
    await expect(caller(null).api.previewOffer({ applicationId: app.id })).rejects.toThrow();
    expect(mocks.getJobApplicationById).not.toHaveBeenCalled();
  });
  it("rejects an archived application", async () => {
    mocks.getJobApplicationById.mockResolvedValue({ ...app, deletedAt: new Date() });
    await expect(caller().api.previewOffer({ applicationId: app.id })).rejects.toThrow("Application not found or archived.");
  });
});
