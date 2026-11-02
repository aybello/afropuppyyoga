import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), values: vi.fn(), duplicate: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({ insert: mocks.insert }) }));
import { ENV } from "./_core/env";
import { upsertUser } from "./db";

describe("configured owner upsert semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "mysql://unused/test");
    ENV.ownerOpenId = "configured-owner";
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockReturnValue({ onDuplicateKeyUpdate: mocks.duplicate });
    mocks.duplicate.mockResolvedValue(undefined);
  });
  it("preserves an existing demotion on ordinary OAuth upsert but permits configured-owner insert", async () => {
    await upsertUser({ openId: "configured-owner", name: "Owner" });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
    expect(mocks.duplicate.mock.calls[0][0].set).not.toHaveProperty("role");
  });
  it("preserves explicit role updates for existing staff behavior", async () => {
    await upsertUser({ openId: "staff:x", role: "staff" });
    expect(mocks.duplicate.mock.calls[0][0].set.role).toBe("staff");
  });
});
