export type OfferLetterType =
  | "puppy_monitor_kw"
  | "puppy_monitor_hamilton"
  | "yoga_instructor"
  | "movement_instructor"
  | "puppy_specialist"
  | "operations_specialist"
  | "operations_manager"
  | "bdr"
  | "social_media_intern"
  | "social_media_specialist";

/**
 * Job titles APY can issue an offer letter for today. A title outside this list
 * must never silently receive another role's letter.
 */
export const SUPPORTED_OFFER_ROLES = [
  "Yoga Instructor",
  "Movement Instructor",
  "Puppy Monitor",
  "Puppy Specialist",
  "Operations Specialist",
  "Operations Manager",
  "BDR",
  "Business Development Representative",
  "Social Media Intern",
  "Social Media Specialist",
] as const;

function normalizeOfferRole(role: string): string {
  return role.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

/** Returns the matching offer letter, or null when APY has no approved letter for the role. */
export function resolveOfferLetterType(role: string, location: string): OfferLetterType | null {
  const normalizedRole = normalizeOfferRole(role);
  const normalizedLocation = location.toLowerCase();
  if (normalizedRole === "movement instructor") return "movement_instructor";
  if (normalizedRole === "yoga instructor") return "yoga_instructor";
  if (normalizedRole === "operations manager") return "operations_manager";
  if (normalizedRole === "operations specialist" || normalizedRole === "operation specialist") {
    return "operations_specialist";
  }
  if (normalizedRole === "social media intern") return "social_media_intern";
  if (normalizedRole === "social media specialist") return "social_media_specialist";
  if (normalizedRole === "puppy specialist") return "puppy_specialist";
  if (normalizedRole === "bdr" || normalizedRole === "business development representative") return "bdr";
  if (normalizedRole === "puppy monitor") {
    return normalizedLocation.includes("ham") ? "puppy_monitor_hamilton" : "puppy_monitor_kw";
  }
  return null;
}

/**
 * Offer creation entry point. Fails closed instead of issuing another role's
 * letter when the job title is not an approved APY role.
 */
export function requireOfferLetterType(role: string, location: string): OfferLetterType {
  const resolved = resolveOfferLetterType(role, location);
  if (!resolved) {
    throw new Error(
      `No approved offer letter exists for the role "${role}". Update this applicant to an approved APY role before sending an offer.`
    );
  }
  return resolved;
}

/** Existing callers and tests; delegates to the fail-closed resolver. */
export function detectOfferLetterType(role: string, location: string): OfferLetterType {
  return requireOfferLetterType(role, location);
}

export function canReuseSigningToken(
  signing: {
    signed: number;
    expiresAt: Date;
    applicantEmail: string;
    applicantName: string;
    role: string;
    location: string;
  } | null,
  application: { email: string; name: string; role: string; location: string },
  now = new Date(),
) {
  return Boolean(
    signing &&
    signing.signed !== 1 &&
    signing.expiresAt > now &&
    signing.applicantEmail === application.email &&
    signing.applicantName === application.name &&
    signing.role === application.role &&
    signing.location === application.location
  );
}
