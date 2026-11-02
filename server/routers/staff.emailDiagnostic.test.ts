import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({
  getDb: mocks.getDb,
  createStaffInvite: vi.fn(), getStaffInviteByToken: vi.fn(), getAllActiveStaff: vi.fn(),
  updateStaffInvite: vi.fn(), upsertUser: vi.fn(),
}));
import { staffRouter } from "./staff";

const owner = { openId: "sensitive-owner-id", role: "admin", email: "owner@example.test" };
const manager = { openId: "staff:manager@example.test", role: "staff", email: "manager@example.test" };
const caller = (user: unknown) => staffRouter.createCaller({ user, req: {}, res: {} } as any);
const input = { email: "  OWNER@example.test  " };
const dbUrl = "mysql://sensitive-user:sensitive-password@db.example.test:3307/private_db?ssl=true";

function database(row: { role: string; email: string | null } | null = { role: "admin", email: " OWNER@EXAMPLE.TEST " }) {
  const execute = vi.fn().mockResolvedValue([]);
  const limit = vi.fn().mockResolvedValue(row ? [row] : []);
  const team = [{ id: 9, name: "Manager", role: "Operations Manager", location: "KW", email: manager.email, phone: null, isTeamMember: true, status: "onboarded", deletedAt: null }];
  const select = vi.fn((fields?: unknown) => fields
    ? { from: () => ({ where: () => ({ limit }) }) }
    : { from: () => ({ where: async () => team }) });
  const db = { execute, select, insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
  mocks.getDb.mockResolvedValue(db);
  return db;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OWNER_OPEN_ID", owner.openId);
  vi.stubEnv("DATABASE_URL", dbUrl);
  vi.stubEnv("JWT_SECRET", "sensitive-jwt-secret");
  vi.stubEnv("GMAIL_APP_PASSWORD", "sensitive-gmail-password");
});
afterEach(() => vi.unstubAllEnvs());

describe("temporary email sign-in diagnostic", () => {
  it("rejects unauthenticated callers without touching the database", async () => {
    await expect(caller(null).emailSignInDiagnostic(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("rejects an actual operations manager despite operations-management access", async () => {
    const db = database();
    await expect(caller(manager).emailSignInDiagnostic(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.select).toHaveBeenCalledTimes(1);
  });
  it("rejects non-admin users without team access", async () => {
    const db = database();
    await expect(caller({ ...manager, email: null, openId: "user:other" }).emailSignInDiagnostic(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.execute).not.toHaveBeenCalled();
  });
  it("returns only permitted booleans, marker, and a credential-free target fingerprint", async () => {
    const db = database();
    const result = await caller(owner).emailSignInDiagnostic(input);
    expect(result).toEqual({
      buildMarker: "email-signin-diagnostic-c42d14bc-v1",
      ownerOpenIdPresent: true, ownerOpenIdMatchesSession: true,
      ownerRowExists: true, ownerRowIsAdmin: true, ownerRowEmailMatches: true,
      databaseUrlPresent: true, jwtSecretPresent: true, gmailAppPasswordPresent: true,
      databaseTargetFingerprint: createHash("sha256").update(JSON.stringify(["db.example.test", "3307", "private_db"])).digest("hex"),
    });
    const output = JSON.stringify(result);
    for (const sensitive of [owner.openId, "owner@example.test", "sensitive-user", "sensitive-password", "sensitive-jwt-secret", "sensitive-gmail-password", "db.example.test", "private_db"]) expect(output).not.toContain(sensitive);
    expect(db.execute).toHaveBeenCalledOnce();
    expect(db.insert).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled(); expect(db.delete).not.toHaveBeenCalled();
  });
  it("does not vary the fingerprint with credentials or query parameters and normalizes default port and host", async () => {
    database();
    vi.stubEnv("DATABASE_URL", "mysql://first:password@DB.EXAMPLE.TEST/private_db?secret=one");
    const first = await caller(owner).emailSignInDiagnostic(input);
    vi.stubEnv("DATABASE_URL", "mysql://second:changed@db.example.test:3306/private_db?secret=two");
    const second = await caller(owner).emailSignInDiagnostic(input);
    expect(first.databaseTargetFingerprint).toBe(second.databaseTargetFingerprint);
    vi.stubEnv("DATABASE_URL", "mysql://second:changed@db.example.test/another_db");
    const third = await caller(owner).emailSignInDiagnostic(input);
    expect(third.databaseTargetFingerprint).not.toBe(second.databaseTargetFingerprint);
  });
  it("reports missing owner ID without querying the owner row, while still testing DB connectivity", async () => {
    const db = database();
    vi.stubEnv("OWNER_OPEN_ID", "  ");
    vi.stubEnv("JWT_SECRET", ""); vi.stubEnv("GMAIL_APP_PASSWORD", "");
    const result = await caller(owner).emailSignInDiagnostic(input);
    expect(result).toMatchObject({ ownerOpenIdPresent: false, ownerOpenIdMatchesSession: false, ownerRowExists: false, ownerRowIsAdmin: false, ownerRowEmailMatches: false, jwtSecretPresent: false, gmailAppPasswordPresent: false });
    expect(db.execute).toHaveBeenCalledOnce(); expect(db.select).not.toHaveBeenCalled();
  });
  it("distinguishes session mismatch, missing row, wrong role and wrong email", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "another-owner");
    database(null);
    expect(await caller(owner).emailSignInDiagnostic(input)).toMatchObject({ ownerOpenIdMatchesSession: false, ownerRowExists: false, ownerRowIsAdmin: false, ownerRowEmailMatches: false });
    database({ role: "staff", email: "someone@example.test" });
    expect(await caller(owner).emailSignInDiagnostic(input)).toMatchObject({ ownerOpenIdMatchesSession: false, ownerRowExists: true, ownerRowIsAdmin: false, ownerRowEmailMatches: false });
    database({ role: "staff", email: "owner@example.test" });
    expect(await caller(owner).emailSignInDiagnostic(input)).toMatchObject({ ownerRowExists: true, ownerRowIsAdmin: false, ownerRowEmailMatches: true });
  });
  it.each(["missing", "malformed", "connection", "query"])('returns a generic unavailable error for %s database failure', async failure => {
    const db = database();
    if (failure === "missing") vi.stubEnv("DATABASE_URL", "");
    if (failure === "malformed") vi.stubEnv("DATABASE_URL", "not a URL sensitive-password");
    if (failure === "connection") db.execute.mockRejectedValue(new Error("sensitive-password db.example.test"));
    if (failure === "query") db.select.mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async () => { throw new Error("sensitive-password"); } }) }) }) as any);
    await expect(caller(owner).emailSignInDiagnostic(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Diagnostic unavailable." });
  });
  it("rejects malformed email input", async () => {
    const db = database();
    await expect(caller(owner).emailSignInDiagnostic({ email: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.execute).not.toHaveBeenCalled();
  });
});
