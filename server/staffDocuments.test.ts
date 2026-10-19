import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { signingTokens, type SigningToken, type User } from "../drizzle/schema";
import type { ApyAccess } from "./apyAccess";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSigningTokenByToken: vi.fn(),
  resolveApyAccess: vi.fn(),
  getMySignedOfferApplicationIds: vi.fn(),
  buildSignedOfferPdf: vi.fn(),
}));
// Paths are relative to this server-level test, not to the router module.
vi.mock("./db", () => ({ getDb: mocks.getDb, getSigningTokenByToken: mocks.getSigningTokenByToken }));
vi.mock("./apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
vi.mock("./mySignedOfferOwnership", () => ({ getMySignedOfferApplicationIds: mocks.getMySignedOfferApplicationIds }));
vi.mock("./signedOfferPdf", () => ({ buildSignedOfferPdf: mocks.buildSignedOfferPdf }));
// Deliberately do not mock _core/trpc: authentication and teamMemberProcedure run.
import { staffDocumentsRouter } from "./routers/staffDocuments";

const now = new Date("2026-04-15T12:00:00Z");
const pdf = Buffer.from("%PDF-1.7\nfictional signed offer and NDA\n%%EOF");
const member = {
  id: 42, name: "Ordinary Employee", email: "member@example.com", phone: "+12895550100",
  role: "Puppy Monitor", location: "KW",
};
const user: User = {
  id: 5, openId: "staff-email:member@example.com", name: member.name, email: member.email,
  role: "staff", loginMethod: "test", createdAt: new Date(0), updatedAt: new Date(0), lastSignedIn: new Date(0),
};
const access: ApyAccess = { level: "team_member", teamMember: member, canManageOperations: false };
const ownerAccess: ApyAccess = { level: "owner", teamMember: null, canManageOperations: true };

function signedRecord(overrides: Partial<SigningToken> = {}): SigningToken {
  return {
    id: 101, applicationId: member.id, applicantName: member.name, applicantEmail: member.email,
    role: member.role, location: member.location, offerLetterType: "puppy_monitor_kw",
    puppyMonitorShiftPayCad: null, movementInstructorHourlyPayCad: null, socialMediaHourlyPayCad: null,
    token: "a7c20e639d1458bf".repeat(4), signed: 1, signedName: "Employee Signature",
    signedIp: "192.0.2.45", signedAt: new Date("2026-01-01T12:00:00Z"),
    expiresAt: new Date("2026-01-10T12:00:00Z"), createdAt: new Date("2026-01-01T00:00:00Z"),
    signedDocumentSnapshot: "private-original-offer-and-NDA-snapshot",
    ...overrides,
  };
}

const dialect = new MySqlDialect();
type Predicate = (row: SigningToken) => boolean;
type Column = keyof SigningToken;

/**
 * Evaluate actual Drizzle SQL, not a queue of pre-filtered results. Unsupported
 * syntax throws so a changed/removed ownership predicate cannot silently pass.
 */
function sqlPredicate(condition: SQL): Predicate {
  const { sql, params } = dialect.sqlToQuery(condition);
  const tokens = sql.match(/`[^`]+`|\?|[().=,]|\b(?:and|or|in)\b/gi) ?? [];
  if (tokens.join("") !== sql.replace(/\s/g, "")) throw new Error(`Unsupported SQL: ${sql}`);
  let position = 0;
  let parameter = 0;
  function take(expected?: string): string {
    const token = tokens[position++];
    if (token === undefined || (expected !== undefined && token.toLowerCase() !== expected)) {
      throw new Error(`Expected ${expected ?? "token"} in ${sql}`);
    }
    return token;
  }
  function value(): unknown {
    take("?");
    if (parameter >= params.length) throw new Error(`Missing SQL parameter: ${sql}`);
    return params[parameter++];
  }
  function atom(): Predicate {
    if (tokens[position] === "(") {
      take("(");
      const predicate = expression();
      take(")");
      return predicate;
    }
    take("`signingtokens`");
    take(".");
    const column = take().slice(1, -1) as Column;
    if (!(column in signingTokens)) throw new Error(`Unknown signingTokens column: ${column}`);
    const operator = take().toLowerCase();
    if (operator === "=") {
      const expected = value();
      return (row) => row[column] === expected;
    }
    if (operator !== "in") throw new Error(`Unsupported SQL operator: ${operator}`);
    take("(");
    const values = [value()];
    while (tokens[position] === ",") { take(","); values.push(value()); }
    take(")");
    return (row) => values.includes(row[column]);
  }
  function conjunction(): Predicate {
    let result = atom();
    while (tokens[position]?.toLowerCase() === "and") {
      take("and");
      const left = result;
      const right = atom();
      result = (row) => left(row) && right(row);
    }
    return result;
  }
  function expression(): Predicate {
    let result = conjunction();
    while (tokens[position]?.toLowerCase() === "or") {
      take("or");
      const left = result;
      const right = conjunction();
      result = (row) => left(row) || right(row);
    }
    return result;
  }
  const result = expression();
  if (position !== tokens.length || parameter !== params.length) throw new Error(`Unconsumed SQL: ${sql}`);
  return result;
}

function fakeDb(records: SigningToken[]) {
  const queries: Array<{ sql?: string; params?: unknown[]; orderBy: string[]; limit?: number }> = [];
  const db = {
    select: vi.fn(() => {
      let predicate: Predicate = () => true;
      let ordering: Column[] = [];
      const query: (typeof queries)[number] = { orderBy: [] };
      queries.push(query);
      const chain = {
        from(table: unknown) { expect(table).toBe(signingTokens); return chain; },
        where(condition: SQL) {
          Object.assign(query, dialect.sqlToQuery(condition));
          predicate = sqlPredicate(condition);
          return chain;
        },
        orderBy(...conditions: SQL[]) {
          query.orderBy = conditions.map((condition) => dialect.sqlToQuery(condition).sql);
          ordering = query.orderBy.map((sql) => {
            const match = /^`signingTokens`\.`(\w+)` desc$/i.exec(sql);
            if (!match) throw new Error(`Unsupported ordering: ${sql}`);
            return match[1] as Column;
          });
          return chain;
        },
        limit(limit: number) { query.limit = limit; return chain; },
        then<TResult1 = SigningToken[], TResult2 = never>(
          resolve?: ((rows: SigningToken[]) => TResult1 | PromiseLike<TResult1>) | null,
          reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ): Promise<TResult1 | TResult2> {
          const rows = records.filter(predicate).sort((left, right) => {
            for (const column of ordering) {
              const comparison = Number(right[column]) - Number(left[column]);
              if (comparison) return comparison;
            }
            return 0;
          });
          return Promise.resolve(rows.slice(0, query.limit)).then(resolve, reject);
        },
      };
      return chain;
    }),
  };
  return { db, queries };
}

function caller(identity: User | null = user, extra: Partial<TrpcContext> = {}) {
  const setHeader = vi.fn();
  const ctx = { req: { headers: {} }, res: { setHeader }, user: identity, ...extra } as TrpcContext;
  return { api: staffDocumentsRouter.createCaller(ctx), setHeader };
}
function expectPrivate(setHeader: ReturnType<typeof vi.fn>) {
  expect(setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
}
function expectNoDocumentWork() {
  expect(mocks.getDb).not.toHaveBeenCalled();
  expect(mocks.getMySignedOfferApplicationIds).not.toHaveBeenCalled();
  expect(mocks.getSigningTokenByToken).not.toHaveBeenCalled();
  expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
}
function expectedDownload(record: SigningToken) {
  return { filename: `APY-signed-offer-and-NDA-${record.id}.pdf`, base64: pdf.toString("base64"), mimeType: "application/pdf" };
}

let publicRecords: SigningToken[];
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  publicRecords = [];
  mocks.getDb.mockResolvedValue(fakeDb([]).db);
  mocks.resolveApyAccess.mockResolvedValue(access);
  // Ownership resolution has its own dedicated suite. This boundary stub gives
  // the router explicit current/historical IDs and no implicit owner identity.
  mocks.getMySignedOfferApplicationIds.mockImplementation(async (_db, _user, resolved: ApyAccess) =>
    resolved.teamMember ? [42, 41] : []);
  mocks.getSigningTokenByToken.mockImplementation(async (token: string) =>
    publicRecords.find((record) => record.token === token) ?? null);
  mocks.buildSignedOfferPdf.mockResolvedValue(pdf);
});
afterEach(() => { vi.useRealTimers(); });

describe("staffDocuments real teamMemberProcedure middleware", () => {
  it.each(["list", "download"] as const)("rejects anonymous %s before resolving access or reading documents", async (operation) => {
    const { api } = caller(null, { apyAccess: ownerAccess });
    await expect(operation === "list" ? api.mySignedOffers() : api.downloadMySignedOffer({ id: 101 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.resolveApyAccess).not.toHaveBeenCalled();
    expectNoDocumentWork();
  });

  it.each(["list", "download"] as const)("denies nonmember %s even with forged owner access in context", async (operation) => {
    mocks.resolveApyAccess.mockResolvedValue({ level: "none", teamMember: null, canManageOperations: false });
    const { api } = caller(user, { apyAccess: ownerAccess });
    await expect(operation === "list" ? api.mySignedOffers() : api.downloadMySignedOffer({ id: 101 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(user);
    expectNoDocumentWork();
  });
});

describe("staffDocuments.mySignedOffers", () => {
  it.each([
    { label: "ordinary employee", identity: user, resolved: access },
    {
      label: "phone-only employee", identity: { ...user, email: null, openId: "staff-phone:+12895550100" },
      resolved: { ...access, teamMember: { ...member, email: null } },
    },
  ])("lists only $label's valid signed documents, including expired history behind a newer unsigned offer", async ({ identity, resolved }) => {
    mocks.resolveApyAccess.mockResolvedValue(resolved);
    const older = signedRecord({ id: 100, applicationId: 41, signedAt: new Date("2025-12-01"), signedDocumentSnapshot: null });
    const first = signedRecord();
    const tied = signedRecord({ id: 102 });
    const newerUnsigned = signedRecord({ id: 103, signed: 0, signedName: null, signedAt: null, createdAt: now });
    const otherPerson = signedRecord({ id: 900, applicationId: 99, signedAt: now });
    const { db, queries } = fakeDb([older, first, otherPerson, newerUnsigned, tied,
      signedRecord({ id: 104, signedName: null }), signedRecord({ id: 105, signedName: "  " }),
      signedRecord({ id: 106, signedAt: null }), signedRecord({ id: 107, signedAt: new Date("invalid") }),
    ]);
    mocks.getDb.mockResolvedValue(db);
    const { api, setHeader } = caller(identity, { apyAccess: ownerAccess });
    const result = await api.mySignedOffers();
    expect(result).toEqual([tied, first, older].map((record) => ({
      id: record.id, role: record.role, location: record.location, signedAt: record.signedAt,
      signedName: record.signedName, hasOriginalSnapshot: Boolean(record.signedDocumentSnapshot),
    })));
    for (const record of result) {
      expect(Object.keys(record).sort()).toEqual(["id", "role", "location", "signedAt", "signedName", "hasOriginalSnapshot"].sort());
    }
    const serialized = JSON.stringify(result);
    for (const secret of [first.token, first.applicantEmail, first.signedIp, first.signedDocumentSnapshot]) {
      expect(serialized).not.toContain(secret);
    }
    expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(identity);
    expect(mocks.getMySignedOfferApplicationIds).toHaveBeenCalledExactlyOnceWith(db, identity, resolved);
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("`signingTokens`.`applicationId` in (?, ?)");
    expect(queries[0].sql).toContain("`signingTokens`.`signed` = ?");
    expect(queries[0].params).toEqual([42, 41, 1]);
    expect(queries[0].sql).not.toMatch(/expiresAt|createdAt/i);
    expect(queries[0].limit).toBeUndefined();
    expect(queries[0].orderBy).toEqual(["`signingTokens`.`signedAt` desc", "`signingTokens`.`id` desc"]);
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });

  it("gives an owner with no teamMember no personal documents or staff impersonation", async () => {
    const owner = { ...user, role: "admin" as const };
    mocks.resolveApyAccess.mockResolvedValue(ownerAccess);
    const { db } = fakeDb([signedRecord()]);
    mocks.getDb.mockResolvedValue(db);
    const { api, setHeader } = caller(owner);
    await expect(api.mySignedOffers()).resolves.toEqual([]);
    await expect(api.downloadMySignedOffer({ id: 101 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.resolveApyAccess).toHaveBeenCalledTimes(2);
    expect(mocks.getMySignedOfferApplicationIds).toHaveBeenCalledWith(db, owner, ownerAccess);
    expect(db.select).not.toHaveBeenCalled();
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });

  it("propagates a failed ownership check without selecting or building a document", async () => {
    const { TRPCError } = await import("@trpc/server");
    mocks.getMySignedOfferApplicationIds.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const { db } = fakeDb([signedRecord()]);
    mocks.getDb.mockResolvedValue(db);
    const { api, setHeader } = caller();
    await expect(api.mySignedOffers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.select).not.toHaveBeenCalled();
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });
});

const invalidSignatures: Array<{ label: string; overrides: Partial<SigningToken> }> = [
  { label: "unsigned", overrides: { signed: 0 } },
  { label: "noncanonical signed flag", overrides: { signed: 2 } },
  { label: "missing signed name", overrides: { signedName: null } },
  { label: "empty signed name", overrides: { signedName: "" } },
  { label: "whitespace signed name", overrides: { signedName: " \t\n" } },
  { label: "missing signature date", overrides: { signedAt: null } },
  { label: "invalid signature date", overrides: { signedAt: new Date("invalid") } },
];

describe("staffDocuments.downloadMySignedOffer", () => {
  it("returns PDF bytes for an owned expired signed record with a fixed safe filename and private caching", async () => {
    const record = signedRecord({ signedName: "Name / ../../secret\r\nHeader: injected" });
    const { db, queries } = fakeDb([signedRecord({ id: 102 }), record, signedRecord({ id: 900, applicationId: 99 })]);
    mocks.getDb.mockResolvedValue(db);
    const { api, setHeader } = caller();
    const result = await api.downloadMySignedOffer({ id: record.id });
    expect(result).toEqual(expectedDownload(record));
    expect(Buffer.from(result.base64, "base64")).toEqual(pdf);
    expect(mocks.buildSignedOfferPdf).toHaveBeenCalledExactlyOnceWith(record);
    expect(mocks.getMySignedOfferApplicationIds).toHaveBeenCalledExactlyOnceWith(db, user, access);
    expect(queries[0].params).toEqual([101, 42, 41, 1]);
    expect(queries[0].limit).toBe(1);
    expect(queries[0].sql).not.toContain("expiresAt");
    expectPrivate(setHeader);
  });

  it.each([900, 9999])("returns NOT_FOUND for another person's or nonexistent ID %s, never building a PDF", async (id) => {
    const { db } = fakeDb([signedRecord(), signedRecord({ id: 900, applicationId: 99 })]);
    mocks.getDb.mockResolvedValue(db);
    const { api, setHeader } = caller();
    await expect(api.downloadMySignedOffer({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });

  it.each(invalidSignatures)("refuses an owned $label record before PDF generation", async ({ overrides }) => {
    mocks.getDb.mockResolvedValue(fakeDb([signedRecord(overrides)]).db);
    const { api, setHeader } = caller();
    await expect(api.downloadMySignedOffer({ id: 101 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });

  it.each([
    {}, { id: "101" }, { id: null }, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: NaN }, { id: Infinity },
    { id: 101, applicationId: 99 }, { id: 101, token: "unexpected" },
  ])("strictly rejects malformed or extra ID input %j before document reads", async (input) => {
    const { api } = caller();
    await expect(api.downloadMySignedOffer(input as { id: number })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.resolveApyAccess).toHaveBeenCalledExactlyOnceWith(user);
    expectNoDocumentWork();
  });
});

describe("staffDocuments.downloadFromSigningLink", () => {
  it("allows anonymous access only with the exact unexpired signing bearer token and returns PDF bytes privately", async () => {
    const record = signedRecord({ expiresAt: new Date(now.getTime() + 60_000) });
    publicRecords = [record];
    const { api, setHeader } = caller(null);
    const result = await api.downloadFromSigningLink({ token: record.token });
    expect(result).toEqual(expectedDownload(record));
    expect(Buffer.from(result.base64, "base64")).toEqual(pdf);
    expect(mocks.getSigningTokenByToken).toHaveBeenCalledExactlyOnceWith(record.token);
    expect(mocks.buildSignedOfferPdf).toHaveBeenCalledExactlyOnceWith(record);
    expect(mocks.resolveApyAccess).not.toHaveBeenCalled();
    expect(mocks.getMySignedOfferApplicationIds).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });

  it("denies an expired signed token publicly while the same document remains downloadable in authenticated HQ", async () => {
    const record = signedRecord({ expiresAt: new Date(now.getTime() - 1) });
    publicRecords = [record];
    mocks.getDb.mockResolvedValue(fakeDb([record]).db);
    const publicCaller = caller(null);
    await expect(publicCaller.api.downloadFromSigningLink({ token: record.token })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(publicCaller.setHeader);
    const hq = caller();
    await expect(hq.api.downloadMySignedOffer({ id: record.id })).resolves.toEqual(expectedDownload(record));
    expect(mocks.buildSignedOfferPdf).toHaveBeenCalledExactlyOnceWith(record);
    expectPrivate(hq.setHeader);
  });

  it("denies an incorrect but correctly sized token instead of using an ID or another token's record", async () => {
    publicRecords = [signedRecord({ expiresAt: new Date(now.getTime() + 60_000) })];
    const incorrect = "e03f92bc5a78d641".repeat(4);
    const { api, setHeader } = caller(null);
    await expect(api.downloadFromSigningLink({ token: incorrect })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getSigningTokenByToken).toHaveBeenCalledExactlyOnceWith(incorrect);
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });

  it.each(invalidSignatures)("refuses an unexpired token for a $label record before PDF generation", async ({ overrides }) => {
    const record = signedRecord({ ...overrides, expiresAt: new Date(now.getTime() + 60_000) });
    publicRecords = [record];
    const { api, setHeader } = caller(null);
    await expect(api.downloadFromSigningLink({ token: record.token })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.buildSignedOfferPdf).not.toHaveBeenCalled();
    expectPrivate(setHeader);
  });

  it.each([
    {}, { token: "" }, { token: "a".repeat(31) }, { token: "a".repeat(129) }, { token: 123 }, { token: null },
    { id: 101 }, { token: "a".repeat(64), id: 101 },
  ])("rejects missing, invalid-length/type, or extra public input %j before token lookup", async (input) => {
    const { api } = caller(null);
    await expect(api.downloadFromSigningLink(input as { token: string })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expectNoDocumentWork();
    expect(mocks.resolveApyAccess).not.toHaveBeenCalled();
  });

  it("exposes no public ID-only endpoint and keeps authenticated download a mutation", () => {
    expect(Object.keys(staffDocumentsRouter._def.procedures).sort()).toEqual([
      "downloadFromSigningLink", "downloadMySignedOffer", "mySignedOffers",
    ]);
    expect(staffDocumentsRouter._def.procedures.downloadMySignedOffer._def.type).toBe("mutation");
    expect(staffDocumentsRouter._def.procedures.downloadFromSigningLink._def.type).toBe("mutation");
  });
});
