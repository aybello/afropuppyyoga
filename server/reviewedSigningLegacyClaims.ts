import { legacyHiringOwnershipClaims } from "./hiringDuplicateIdentity";

type LegacyAction = { applicationId: number; action: string; details: string | null };
type Association = { applicationId: number; employeeId: number; canonicalApplicationId: number; recordHash: string };
type ReviewItem = { applicationId: number; recordHash: unknown };
type Candidate = {
  action: LegacyAction;
  employeeId: unknown;
  review?: { employeeId: number; canonicalApplicationId: number; reviewed: ReviewItem[] };
  applicationIds: number[];
};

const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const denied = () => new Error("This application already belongs to an employee; reviewed ownership could not be verified.");

/** JSON.parse silently discards earlier duplicate claim keys, hiding a claim. */
function hasDuplicateKeys(json: string, claimsOnly: boolean): boolean {
  const claimKeys = new Set(["employeeId", "canonicalApplicationId", "applicationId", "duplicateReview", "reviewed"]);
  const containers: Array<Set<string> | null> = [];
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (char === '"') {
      const start = i;
      for (i++; i < json.length; i++) {
        if (json[i] === "\\") i++;
        else if (json[i] === '"') break;
      }
      let next = i + 1;
      while (/\s/.test(json[next] ?? "") && next < json.length) next++;
      const keys = containers[containers.length - 1];
      if (json[next] === ":" && keys) {
        const key = JSON.parse(json.slice(start, i + 1)) as string;
        if ((!claimsOnly || claimKeys.has(key)) && keys.has(key)) return true;
        keys.add(key);
      }
    } else if (char === "{") containers.push(new Set());
    else if (char === "[") containers.push(null);
    else if (char === "}" || char === "]") containers.pop();
  }
  return false;
}

/** Review-shaped data outside the expected envelope can conceal another claim. */
function hasHiddenReviewEvidence(details: Record<string, unknown>): boolean {
  const reviewKeys = new Set(["duplicateReview", "canonicalApplicationId", "reviewed", "recordHash"]);
  const pending: Array<{ value: unknown; location: "details" | "review" | "reviewed" | "item" | "other" }> =
    [{ value: details, location: "details" }];
  while (pending.length) {
    const { value, location } = pending.pop()!;
    if (Array.isArray(value)) {
      for (const child of value) pending.push({ value: child, location: location === "reviewed" ? "item" : "other" });
    }
    else if (object(value)) {
      for (const [key, child] of Object.entries(value)) {
        let next: "review" | "reviewed" | "other" = "other";
        if (location === "details" && key === "duplicateReview") next = "review";
        else if (location === "review" && key === "reviewed") next = "reviewed";
        else if (reviewKeys.has(key)
            && !(location === "review" && key === "canonicalApplicationId")
            && !(location === "item" && key === "recordHash")) return true;
        pending.push({ value: child, location: next });
      }
    }
  }
  return false;
}

// A malformed numeric string may still identify the employee being checked.
function mayIdentifyEmployee(value: unknown, employeeId: number): boolean {
  return value === employeeId || (typeof value === "string" && value.trim() !== "" && Number(value) === employeeId);
}

/**
 * Reviews require every possible ownership ID to establish relevance. Ordinary
 * rows cannot claim another application, but are retained for relevance checks;
 * their employee ID is validated if they turn out to be related. Null details
 * cannot hide a claim, but must likewise be retained until relevance is known:
 * an overlapping review may connect the row to the owner indirectly.
 */
function candidates(actions: readonly LegacyAction[], options?: { deferNullDetails: boolean }): Candidate[] {
  const result: Candidate[] = [];
  for (const action of actions) {
    if (action.action !== "employee_added_after_signature") continue;
    if (!positiveId(action.applicationId) || (action.details !== null && typeof action.details !== "string")) throw denied();
    let details: unknown;
    try {
      details = JSON.parse(action.details ?? "null");
      if (action.details !== null && hasDuplicateKeys(action.details, true)) throw denied();
    } catch { throw denied(); }
    if (details === null && options?.deferNullDetails) {
      result.push({ action, employeeId: undefined, applicationIds: [action.applicationId] });
      continue;
    }
    if (typeof action.details !== "string" || !object(details) || hasHiddenReviewEvidence(details)) throw denied();
    if (!("duplicateReview" in details)) {
      if (hasDuplicateKeys(action.details, false)) throw denied();
      result.push({ action, employeeId: details.employeeId, applicationIds: [action.applicationId] });
      continue;
    }
    if (!positiveId(details.employeeId)) throw denied();
    const review = details.duplicateReview;
    if (!object(review) || !positiveId(review.employeeId) || !positiveId(review.canonicalApplicationId)
        || !Array.isArray(review.reviewed) || review.reviewed.length === 0) throw denied();
    const reviewed: ReviewItem[] = [];
    for (const item of review.reviewed) {
      if (!object(item) || !positiveId(item.applicationId)) throw denied();
      reviewed.push({ applicationId: item.applicationId, recordHash: item.recordHash });
    }
    result.push({ action, employeeId: details.employeeId,
      review: { employeeId: review.employeeId, canonicalApplicationId: review.canonicalApplicationId, reviewed },
      applicationIds: [action.applicationId, review.canonicalApplicationId, ...reviewed.map(item => item.applicationId)] });
  }
  return result;
}

/** Validate only after relevance has been established; never derive authority. */
function validateReview(candidate: Candidate): void {
  try {
    if (hasDuplicateKeys(candidate.action.details as string, false)
        || !legacyHiringOwnershipClaims([candidate.action]).length) throw denied();
  } catch { throw denied(); }
}

/**
 * For an unassociated signer, preserve historical claims without parsing all
 * complete but unrelated reviews as authoritative. No associations are created.
 */
export function hasLegacySigningOwnershipClaim(actions: readonly LegacyAction[], applicationIds: ReadonlySet<number>): boolean {
  const rows = candidates(actions, { deferNullDetails: true });
  let claimed = false;
  for (const row of rows) {
    if (!row.applicationIds.some(id => applicationIds.has(id))) continue;
    if (!row.review) {
      if (!positiveId(row.employeeId)) throw denied();
      continue; // Ordinary historical hires are not review claims.
    }
    validateReview(row);
    claimed = true;
  }
  return claimed;
}

/**
 * Check legacy history against already-validated durable reviewed ownership.
 * Associations, not the legacy evidence, are the sole source of authority.
 * The caller must keep all existing owner, identity and association checks.
 */
export function assertReviewedSigningLegacyClaims(
  actions: readonly LegacyAction[], associations: readonly Association[],
  knownApplicationIds: ReadonlySet<number>, employeeId: number, canonicalApplicationId: number,
): void {
  if (!positiveId(employeeId) || !positiveId(canonicalApplicationId)
      || Array.from(knownApplicationIds).some(id => !positiveId(id))) throw denied();
  const rows = candidates(actions, { deferNullDetails: true });
  const relatedIds = new Set([...Array.from(knownApplicationIds), canonicalApplicationId]);
  const related = new Set<Candidate>();
  // Follow overlapping historical application IDs, including IDs for which
  // durable rows no longer exist. These IDs can only make checks stricter.
  let changed: boolean;
  do {
    changed = false;
    for (const row of rows) {
      if (related.has(row)) continue;
      if (!mayIdentifyEmployee(row.employeeId, employeeId) && row.review?.employeeId !== employeeId
          && !row.applicationIds.some(id => relatedIds.has(id))) continue;
      related.add(row);
      for (const id of row.applicationIds) if (!relatedIds.has(id)) { relatedIds.add(id); changed = true; }
    }
  } while (changed);

  const hashes = new Map<number, string>();
  for (const row of Array.from(related)) {
    if (!row.review) {
      if (!positiveId(row.employeeId) || hasDuplicateKeys(row.action.details as string, false)
          || row.action.applicationId !== canonicalApplicationId || row.employeeId !== employeeId) throw denied();
      continue;
    }
    validateReview(row);
    if (row.employeeId !== employeeId || row.review.employeeId !== employeeId
        || row.review.canonicalApplicationId !== canonicalApplicationId) throw denied();
    for (const item of row.review.reviewed) {
      // validateReview has already established the exact SHA-256 format.
      const hash = item.recordHash as string;
      const previous = hashes.get(item.applicationId);
      if (previous !== undefined && previous !== hash) throw denied();
      hashes.set(item.applicationId, hash);
      const durable = associations.filter(entry => entry.applicationId === item.applicationId);
      if (durable.length && (durable.length !== 1 || durable[0].employeeId !== employeeId
          || durable[0].canonicalApplicationId !== canonicalApplicationId || durable[0].recordHash !== hash)) throw denied();
    }
  }
}
