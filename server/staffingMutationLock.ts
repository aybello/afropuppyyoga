import { eq } from "drizzle-orm";
import { staffingMutationLocks } from "../drizzle/schema";

const STAFFING_MUTATION_LOCK = "apy_staffing_mutation_v1";

/**
 * Serializes APY HQ removals and Puppy Monitor assignments across application
 * instances. The `FOR UPDATE` row lock is held until the surrounding database
 * transaction commits or rolls back.
 */
export async function withStaffingMutationLock<T>(db: any, callback: (tx: any) => Promise<T>): Promise<T> {
  return db.transaction(async (tx: any) => {
    // Seeding and locking happen on the same transaction/connection. A
    // concurrent first caller therefore blocks at this upsert or FOR UPDATE
    // rather than passing a gap between two independent operations.
    await tx.insert(staffingMutationLocks)
      .values({ lockName: STAFFING_MUTATION_LOCK })
      .onDuplicateKeyUpdate({ set: { lockName: STAFFING_MUTATION_LOCK } });
    await tx.select({ lockName: staffingMutationLocks.lockName })
      .from(staffingMutationLocks)
      .where(eq(staffingMutationLocks.lockName, STAFFING_MUTATION_LOCK))
      .for("update");
    return callback(tx);
  });
}
