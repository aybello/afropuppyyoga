/** Drizzle wraps MySQL errors in `cause`; only restrictive parent deletes are conflicts. */
export function isStaffingDeleteRestrictedError(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    const failure = error as { code?: unknown; errno?: unknown; cause?: unknown };
    if (failure.code === "ER_ROW_IS_REFERENCED_2" || failure.code === "ER_ROW_IS_REFERENCED"
      || failure.errno === 1451 || failure.errno === 1217) return true;
    error = failure.cause;
  }
  return false;
}
