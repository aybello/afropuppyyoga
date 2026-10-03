const MAX_AUDIT_BYTES = 48_000;
type Duty = Record<string, unknown>;

/** Bounded records fit MySQL TEXT; the original assignment rows stay intact. */
export function buildRetirementHistoryEntries(classAssignments: Duty[], leadershipCoverage: Duty[]) {
  const entries: string[] = [];
  let current: { classAssignments: Duty[]; leadershipCoverage: Duty[] } = { classAssignments: [], leadershipCoverage: [] };
  for (const [key, values] of [["classAssignments", classAssignments], ["leadershipCoverage", leadershipCoverage]] as const) {
    for (const value of values) {
      current[key].push(value);
      if (Buffer.byteLength(JSON.stringify(current), "utf8") > MAX_AUDIT_BYTES) {
        current[key].pop();
        entries.push(JSON.stringify(current));
        current = { classAssignments: [], leadershipCoverage: [] };
        current[key].push(value);
      }
    }
  }
  if (current.classAssignments.length || current.leadershipCoverage.length) entries.push(JSON.stringify(current));
  return entries;
}
