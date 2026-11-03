import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ drizzle: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: mocks.drizzle }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  // The driver is mocked, so this placeholder cannot open a connection.
  vi.stubEnv("DATABASE_URL", "mysql://mock.invalid/application_test");
});
afterEach(() => vi.unstubAllEnvs());

async function setup(options: { insertError?: unknown; lockError?: unknown; commitError?: unknown } = {}) {
  const { jobApplications, staffingMutationLocks } = await import("../drizzle/schema");
  const { createJobApplication } = await import("./db");
  const events: string[] = [];
  const input = {
    role: "Yoga Instructor", location: "OAK", name: "Test Applicant",
    email: "test@example.com", submissionKey: "stable-key", status: "new" as const,
  };
  const values = vi.fn(async (data: unknown) => {
    events.push("application insert");
    expect(data).toBe(input);
    if (options.insertError) throw options.insertError;
    return [{ insertId: "12345" }];
  });
  const tx = {
    insert: vi.fn((table: unknown) => {
      if (table === jobApplications) return { values };
      expect(table).toBe(staffingMutationLocks);
      return { values: (data: unknown) => {
        expect(data).toEqual({ lockName: "apy_staffing_mutation_v1" });
        return { onDuplicateKeyUpdate: async (update: unknown) => {
          expect(update).toEqual({ set: data });
          events.push("lock seed");
          if (options.lockError) throw options.lockError;
        } };
      } };
    }),
    select: vi.fn(() => ({ from: (table: unknown) => {
      expect(table).toBe(staffingMutationLocks);
      return { where: () => ({ for: async (mode: string) => {
        expect(mode).toBe("update");
        events.push("lock acquired");
        return [{ lockName: "apy_staffing_mutation_v1" }];
      } }) };
    } })),
  };
  const db = {
    insert: vi.fn(() => { throw new Error("insert must use transaction"); }),
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      events.push("transaction begin");
      try {
        const result = await callback(tx);
        if (options.commitError) throw options.commitError;
        events.push("transaction commit");
        return result;
      } catch (error) {
        events.push("transaction rollback");
        throw error;
      }
    }),
  };
  mocks.drizzle.mockReturnValue(db);
  return { createJobApplication, db, tx, input, values, events };
}

describe("createJobApplication staffing mutation lock", () => {
  it("acquires the lock before inserting unchanged data on the transaction and returns the insert ID", async () => {
    const h = await setup();
    await expect(h.createJobApplication(h.input)).resolves.toBe(12345);
    expect(h.events).toEqual(["transaction begin", "lock seed", "lock acquired", "application insert", "transaction commit"]);
    expect(h.db.transaction).toHaveBeenCalledOnce();
    expect(h.db.insert).not.toHaveBeenCalled();
    expect(h.values).toHaveBeenCalledOnce();
  });

  it("propagates the original duplicate-key insert error and rolls back", async () => {
    const error = Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    const h = await setup({ insertError: error });
    await expect(h.createJobApplication(h.input)).rejects.toBe(error);
    expect(h.events).toEqual(["transaction begin", "lock seed", "lock acquired", "application insert", "transaction rollback"]);
  });

  it("propagates lock errors without attempting the application insert", async () => {
    const error = new Error("lock failed");
    const h = await setup({ lockError: error });
    await expect(h.createJobApplication(h.input)).rejects.toBe(error);
    expect(h.values).not.toHaveBeenCalled();
    expect(h.events).toEqual(["transaction begin", "lock seed", "transaction rollback"]);
  });

  it("propagates transaction commit errors instead of returning the insert ID", async () => {
    const error = new Error("commit failed");
    const h = await setup({ commitError: error });
    await expect(h.createJobApplication(h.input)).rejects.toBe(error);
    expect(h.events.at(-1)).toBe("transaction rollback");
  });

  it("retains the database-unavailable error", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { createJobApplication } = await import("./db");
    await expect(createJobApplication({ role: "Instructor", location: "OAK", name: "Test" })).rejects.toThrow("Database not available");
    expect(mocks.drizzle).not.toHaveBeenCalled();
  });
});
