import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), twilio: vi.fn(), suppressed: vi.fn(), getDb: vi.fn() }));
vi.mock("twilio", () => ({ default: mocks.twilio }));
vi.mock("./smsConsent", () => ({ isSmsSuppressed: mocks.suppressed }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { sendOfferSigningSms } from "./offerSigningSms";

type Row = {
  recipient: string | null;
  subject: string | null;
  deliveryStatus: string;
  providerMessageId: string | null;
  idempotencyKey: string;
  [key: string]: unknown;
};

function duplicateError(nested = false) {
  const error = Object.assign(new Error("query failed"), { code: "ER_QUERY" });
  return nested ? Object.assign(error, { cause: { cause: { code: "ER_DUP_ENTRY" } } }) : Object.assign(error, { code: "ER_DUP_ENTRY" });
}

function makeDb(options: { claimFails?: boolean; updateFails?: boolean; nestedDuplicate?: boolean } = {}) {
  const rows = new Map<string, Row>();
  const db = {
    insert: vi.fn(() => ({ values: vi.fn(async (value: Row) => {
      if (options.claimFails) throw new Error("write unavailable");
      if (rows.has(value.idempotencyKey)) throw duplicateError(options.nestedDuplicate);
      rows.set(value.idempotencyKey, { ...value });
    }) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => {
      const row = [...rows.values()][0];
      return row ? [{ recipient: row.recipient, subject: row.subject, deliveryStatus: row.deliveryStatus, providerMessageId: row.providerMessageId }] : [];
    }) })) })) })),
    update: vi.fn(() => ({ set: vi.fn((change: Partial<Row>) => ({ where: vi.fn(async () => {
      if (options.updateFails) throw new Error("update unavailable");
      const key = [...rows.keys()][0];
      if (key) rows.set(key, { ...rows.get(key)!, ...change });
    }) })) })),
  };
  return { db, rows };
}

const token = "a".repeat(96);
const signingLink = `https://afropuppyyoga.ca/sign?token=${token}`;
const baseInput = {
  applicationId: 42,
  applicantName: "Avery Johnson",
  role: "Yoga Instructor",
  phone: "(289) 788-1885",
  signingLink,
  requestKey: "550e8400-e29b-41d4-a716-446655440000",
  actor: { id: 7, name: "Hiring Lead" },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "secret";
  process.env.TWILIO_PHONE_NUMBER = "+14165550100";
  mocks.suppressed.mockResolvedValue(false);
  mocks.twilio.mockReturnValue({ messages: { create: mocks.create } });
});

describe("sendOfferSigningSms", () => {
  it.each([
    "http://afropuppyyoga.ca/sign?token=" + token,
    "https://www.afropuppyyoga.ca/sign?token=" + token,
    "https://user@afropuppyyoga.ca/sign?token=" + token,
    "https://afropuppyyoga.ca:443/sign?token=" + token,
    signingLink + "&next=x",
    signingLink + "#fragment",
    "https://afropuppyyoga.ca/sign?token=" + "A".repeat(96),
    "https://afropuppyyoga.ca/sign?token=" + "a".repeat(95),
  ])("rejects a non-canonical signing URL before any dispatch: %s", async (badLink) => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    await expect(sendOfferSigningSms({ ...baseInput, signingLink: badLink })).resolves.toMatchObject({ status: "failed", reason: "Offer signing link is invalid." });
    expect(mocks.suppressed).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("skips missing/invalid phones and missing Twilio configuration", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    await expect(sendOfferSigningSms({ ...baseInput, phone: null })).resolves.toMatchObject({ status: "skipped", phone: null });
    await expect(sendOfferSigningSms({ ...baseInput, phone: "123" })).resolves.toMatchObject({ status: "skipped", phone: null });
    delete process.env.TWILIO_AUTH_TOKEN;
    await expect(sendOfferSigningSms(baseInput)).resolves.toMatchObject({ status: "skipped", reason: "SMS is not configured." });
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("fails closed on suppression errors and skips suppressed recipients", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.suppressed.mockRejectedValueOnce(new Error("private db error")).mockResolvedValueOnce(true);
    await expect(sendOfferSigningSms(baseInput)).resolves.toMatchObject({ status: "unknown", reason: "SMS consent could not be verified." });
    await expect(sendOfferSigningSms(baseInput)).resolves.toMatchObject({ status: "skipped", reason: "Applicant opted out of SMS." });
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("sends exact private APY copy and stores only a redacted preview, fingerprint, safe SID, and token-free key", async () => {
    const { db, rows } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockResolvedValue({ sid: "SM123", status: "queued" });
    const result = await sendOfferSigningSms(baseInput);
    expect(result).toEqual({ status: "queued", phone: "+12897881885", providerMessageId: "SM123" });
    expect(mocks.twilio).toHaveBeenCalledWith("AC_test", "secret", { timeout: 10_000, autoRetry: false });
    expect(mocks.create).toHaveBeenCalledWith({
      to: "+12897881885", from: "+14165550100",
      body: `AfroPuppyYoga: Hi Avery, please review and sign your Yoga Instructor offer letter and NDA on the same page: ${signingLink}. This link is private; do not forward it. Help: afropuppyyoga@gmail.com. Reply STOP to opt out.`,
    });
    const [key, row] = [...rows.entries()][0]!;
    expect(key).toBe("offer-sms:42:550e8400-e29b-41d4-a716-446655440000");
    expect(key).not.toContain(token);
    expect(row).toMatchObject({ action: "offer_signing_sms", bodyPreview: "Private offer letter and NDA signing link sent by text. Link redacted.", subject: expect.stringMatching(/^[a-f0-9]{64}$/), deliveryStatus: "queued", providerMessageId: "SM123" });
    expect(JSON.stringify(row)).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(signingLink);
    expect(String((mocks.create.mock.calls[0]![0] as { body: string }).body)).not.toMatch(/pay|salary|wage/i);
  });

  it("allows one concurrent provider send and replays the durable outcome, including nested duplicate codes", async () => {
    const { db } = makeDb({ nestedDuplicate: true });
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockResolvedValue({ sid: "SMconcurrent", status: "sent" });
    const results = await Promise.all([sendOfferSigningSms(baseInput), sendOfferSigningSms(baseInput)]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(results.some(result => result.status === "sent")).toBe(true);
    expect(results.every(result => ["sent", "unknown"].includes(result.status))).toBe(true);
    const replay = await sendOfferSigningSms(baseInput);
    expect(replay).toMatchObject({ status: "sent", providerMessageId: "SMconcurrent" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("fails a same-key payload mismatch without another send", async () => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockResolvedValue({ sid: "SMonce", status: "queued" });
    await sendOfferSigningSms(baseInput);
    await expect(sendOfferSigningSms({ ...baseInput, role: "Puppy Monitor" })).resolves.toMatchObject({ status: "failed", reason: "SMS request conflicts with a previous request." });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it.each([408, 500, 503])("treats provider %s as uncertain and never resends", async (status) => {
    const { db } = makeDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.create.mockRejectedValueOnce(Object.assign(new Error(`private ${signingLink}`), { status }));
    await expect(sendOfferSigningSms(baseInput)).resolves.toMatchObject({ status: "unknown", reason: "SMS provider outcome is unknown." });
    await expect(sendOfferSigningSms(baseInput)).resolves.toMatchObject({ status: "unknown" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("sanitizes provider errors/SIDs, distinguishes explicit rejection, and never claims queued as delivered", async () => {
    const rejected = makeDb();
    mocks.getDb.mockResolvedValueOnce(rejected.db);
    mocks.create.mockRejectedValueOnce(Object.assign(new Error(`secret ${signingLink}`), { status: 400 }));
    const result = await sendOfferSigningSms(baseInput);
    expect(result).toEqual({ status: "failed", reason: "SMS provider rejected the message.", phone: "+12897881885" });
    expect(JSON.stringify(result)).not.toContain(token);

    const unsafeSid = makeDb();
    mocks.getDb.mockResolvedValueOnce(unsafeSid.db);
    mocks.create.mockResolvedValueOnce({ sid: `SM-${signingLink}`, status: "queued" });
    await expect(sendOfferSigningSms({ ...baseInput, requestKey: "second-uuid" })).resolves.toMatchObject({ status: "unknown" });
    expect([...unsafeSid.rows.values()][0]!.providerMessageId).toBeNull();
  });

  it("does not dispatch when claiming fails and returns unknown with safe SID if outcome persistence fails", async () => {
    const claim = makeDb({ claimFails: true });
    mocks.getDb.mockResolvedValueOnce(claim.db);
    await expect(sendOfferSigningSms(baseInput)).resolves.toMatchObject({ status: "unknown" });
    expect(mocks.create).not.toHaveBeenCalled();

    const update = makeDb({ updateFails: true });
    mocks.getDb.mockResolvedValueOnce(update.db);
    mocks.create.mockResolvedValueOnce({ sid: "SMaccepted", status: "queued" });
    await expect(sendOfferSigningSms({ ...baseInput, requestKey: "third-uuid" })).resolves.toEqual({ status: "unknown", reason: "SMS outcome could not be recorded.", phone: "+12897881885", providerMessageId: "SMaccepted" });
  });
});
