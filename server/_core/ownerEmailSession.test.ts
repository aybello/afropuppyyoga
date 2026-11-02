import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";

// Simulate the pin for a synthetic subject without embedding the actual subject.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHash: (algorithm: string) => {
    const hash = actual.createHash(algorithm); let value = "";
    const wrapper = { update(input: string) { value += input; hash.update(input); return wrapper; },
      digest(encoding: "hex") { return value === "owner-id" ? "48a298ad24d31a86dfdaf645ab845f97499dfad52b4250b9bf666182b7c5d2e3" : hash.digest(encoding); } };
    return wrapper;
  } };
});
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getDb: vi.fn(), upsert: vi.fn(), refresh: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb, getUserByOpenId: mocks.getUser, upsertUser: mocks.upsert, updateExistingUserLastSignedIn: mocks.refresh }));
import { sdk } from "./sdk";
import { ENV } from "./env";
import { ownerEmailFingerprint } from "../ownerIdentity";

const original = { openId: "owner-id", role: "admin", name: "Owner", email: "belllo.ayoola@gmail.com" };
let owner: typeof original | undefined;
let otherAdmins: typeof original[];
const connection = {
  select: () => {
    const query: any = {
      from: () => query,
      where: () => query,
      then: (resolve: (value: typeof original[]) => void) => Promise.resolve([...(owner ? [owner] : []), ...otherAdmins]).then(resolve),
    };
    return query;
  },
};
async function token() {
  return sdk.createSessionToken(original.openId, {
    name: original.name, ownerEmailOtp: true,
    ownerEmailFingerprint: ownerEmailFingerprint(original.openId, original.email),
  });
}
async function authenticate(value: string) {
  return sdk.authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${value}` } } as any);
}

describe("owner email OTP session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ENV.cookieSecret = "session-test-secret";
    ENV.appId = "test-app";
    vi.stubEnv("OWNER_OPEN_ID", "");
    owner = { ...original };
    otherAdmins = [];
    mocks.getDb.mockResolvedValue(connection);
    mocks.getUser.mockImplementation(async () => owner);
    mocks.refresh.mockResolvedValue(undefined);
  });
  it("signs a private fingerprint, resolves the pinned owner, and never upserts", async () => {
    const value = await token();
    const claims = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
    expect(JSON.stringify(claims)).not.toContain(original.email);
    expect(claims.ownerEmailFingerprint).toMatch(/^[a-f0-9]{64}$/);
    await expect(authenticate(value)).resolves.toEqual(owner);
    expect(mocks.refresh).toHaveBeenCalledWith(original.openId, expect.any(Date));
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each(["configuration conflict", "email changed", "demoted", "user deleted", "case-colliding subject"])("rejects after %s", async (change) => {
    const value = await token();
    switch (change) {
      case "configuration conflict": vi.stubEnv("OWNER_OPEN_ID", "different-owner"); break;
      case "email changed": owner = { ...original, email: "new@example.com" }; break;
      case "demoted": owner = { ...original, role: "user" }; break;
      case "user deleted": owner = undefined; break;
      case "case-colliding subject": owner = { ...original, openId: "OWNER-ID" }; break;
    }
    await expect(authenticate(value)).rejects.toThrow("Owner session no longer authorized");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("survives configured owner removal and restoration without an env-source fingerprint", async () => {
    vi.stubEnv("OWNER_OPEN_ID", original.openId);
    const value = await token();
    await expect(authenticate(value)).resolves.toEqual(owner);
    vi.stubEnv("OWNER_OPEN_ID", "");
    await expect(authenticate(value)).resolves.toEqual(owner);
    vi.stubEnv("OWNER_OPEN_ID", "different-owner");
    await expect(authenticate(value)).rejects.toThrow("Owner session no longer authorized");
    vi.stubEnv("OWNER_OPEN_ID", original.openId);
    await expect(authenticate(value)).resolves.toEqual(owner);
  });
  it("may become valid again if the original email and admin role are restored", async () => {
    const value = await token();
    owner = { ...original, email: "changed@example.com", role: "user" };
    await expect(authenticate(value)).rejects.toThrow("Owner session no longer authorized");
    owner = { ...original, email: " BELLLO.AYOOLA@GMAIL.COM " };
    await expect(authenticate(value)).resolves.toEqual(owner);
  });
  it("rejects even a matching fingerprint minted for a changed DB recovery address", async () => {
    owner = { ...original, email: "attacker@example.com" };
    const value = await sdk.createSessionToken(original.openId, {
      name: original.name,
      ownerEmailOtp: true,
      ownerEmailFingerprint: ownerEmailFingerprint(original.openId, owner.email),
    });
    await expect(authenticate(value)).rejects.toThrow("Owner session no longer authorized");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects marked legacy tokens without an eligibility fingerprint", async () => {
    const value = await sdk.signSession({ openId: original.openId, appId: "test-app", name: "Owner", ownerEmailOtp: true });
    await expect(sdk.verifySession(value)).resolves.toBeNull();
    await expect(authenticate(value)).rejects.toThrow("Invalid session cookie");
  });
  it("does not grant ownership by matching another admin's email", async () => {
    const value = await token();
    owner = undefined;
    otherAdmins = [{ ...original, openId: "other-id" }];
    mocks.getUser.mockResolvedValue(otherAdmins[0]);
    await expect(authenticate(value)).rejects.toThrow("Owner session no longer authorized");
  });
});
