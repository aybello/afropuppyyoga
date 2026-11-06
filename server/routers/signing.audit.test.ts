import { beforeEach, describe, expect, it, vi } from "vitest";
import { communicationsLog, jobApplicationActions } from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), sign: vi.fn(), sendEmail: vi.fn(), notifyOwner: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../hiringOfferLifecycle", () => ({ prepareHiringOffer: vi.fn(), recordCurrentOfferSignature: mocks.sign, withCurrentHiringOfferDelivery: vi.fn() }));
vi.mock("../email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
import { signingRouter } from "./signing";

const record = { id: 11, applicationId: 22, applicantName: "Fictional Applicant", applicantEmail: "fictional@example.test", role: "Puppy Monitor", location: "Hamilton" };
const input = { token: "fictional", signedName: "Fictional Applicant", confirmedOfferLetterType: "puppy_monitor_hamilton", confirmedDocumentSha256: "a".repeat(64) };
let writes: Array<{ table: unknown; values: any }>;
let events: string[];
const caller = () => signingRouter.createCaller({ user: null, req: { headers: { "x-forwarded-for": "192.0.2.5" } } } as never);

beforeEach(() => {
  vi.resetAllMocks(); writes = []; events = [];
  mocks.getDb.mockResolvedValue({ insert: (table: unknown) => ({ values: (values: unknown) => { writes.push({ table, values }); events.push("history"); return Promise.resolve(); } }) });
  mocks.sendEmail.mockImplementation(async () => { events.push("email"); });
  mocks.notifyOwner.mockImplementation(async () => { events.push("notify"); });
});

describe("signature audit routing (mocked side effects)", () => {
  it.each([true, false])("preserves post-commit communications and writes the correct timeline when associated=%s", async associated => {
    mocks.sign.mockImplementation(async () => { events.push("committed"); return { ...record, associatedAuditRecorded: associated }; });
    await expect(caller().submitSignature(input)).resolves.toEqual({ success: true });
    expect(events.indexOf("notify")).toBeGreaterThan(events.indexOf("committed"));
    expect(events.indexOf("email")).toBeGreaterThan(events.indexOf("committed"));
    expect(writes.filter(w => w.table === communicationsLog)).toHaveLength(1);
    const actions = writes.filter(w => w.table === jobApplicationActions);
    expect(actions).toHaveLength(associated ? 0 : 1);
    if (!associated) expect(actions[0].values).toEqual({ applicationId: 22, action: "offer_signed", fromStatus: "accepted", toStatus: "accepted", actorName: input.signedName, details: JSON.stringify({ signingTokenId: 11, signedIp: "192.0.2.5" }) });
    expect(mocks.notifyOwner).toHaveBeenCalledOnce(); expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });
  it("does not communicate or write history after transaction rejection", async () => {
    mocks.sign.mockRejectedValue(new Error("audit unavailable"));
    await expect(caller().submitSignature(input)).rejects.toThrow("audit unavailable");
    expect(mocks.notifyOwner).not.toHaveBeenCalled(); expect(mocks.sendEmail).not.toHaveBeenCalled(); expect(writes).toEqual([]);
  });
  it("still writes confirmation tracking when post-commit mail fails", async () => {
    mocks.sign.mockResolvedValue({ ...record, associatedAuditRecorded: true });
    mocks.sendEmail.mockRejectedValue(new Error("mock failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(caller().submitSignature(input)).resolves.toEqual({ success: true });
      expect(writes.filter(w => w.table === communicationsLog)[0].values.deliveryStatus).toBe("failed");
      expect(writes.filter(w => w.table === jobApplicationActions)).toHaveLength(0);
    } finally { log.mockRestore(); }
  });
});
