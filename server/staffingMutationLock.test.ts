import { describe, expect, it, vi } from "vitest";
import { withStaffingMutationLock } from "./staffingMutationLock";

describe("transaction-scoped staffing mutex", () => {
  it("creates the mutex row and locks it for the full callback transaction", async () => {
    const locked = vi.fn().mockResolvedValue([{ lockName: "apy_staffing_mutation_v1" }]);
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ for: locked })),
        })),
      })),
    };
    const db = {
      transaction: vi.fn(async (callback) => callback(tx)),
    };
    const callback = vi.fn().mockResolvedValue({ success: true });

    await expect(withStaffingMutationLock(db, callback)).resolves.toEqual({ success: true });
    expect(tx.insert).toHaveBeenCalledOnce();
    expect(locked).toHaveBeenCalledWith("update");
    expect(callback).toHaveBeenCalledWith(tx);
  });
});
