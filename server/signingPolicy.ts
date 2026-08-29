export type OfferLetterType =
  | "puppy_monitor_kw"
  | "puppy_monitor_hamilton"
  | "yoga_instructor"
  | "puppy_specialist"
  | "operations_specialist"
  | "bdr";

export function detectOfferLetterType(role: string, location: string): OfferLetterType {
  const normalizedRole = role.toLowerCase();
  const normalizedLocation = location.toLowerCase();
  if (normalizedRole.includes("yoga") || normalizedRole.includes("instructor")) return "yoga_instructor";
  if (normalizedRole.includes("operations specialist") || normalizedRole.includes("operation specialist")) {
    return "operations_specialist";
  }
  if (normalizedRole.includes("specialist")) return "puppy_specialist";
  if (normalizedRole.includes("bdr") || normalizedRole.includes("business development")) return "bdr";
  if (normalizedLocation.includes("hamilton") || normalizedLocation.includes("ham")) return "puppy_monitor_hamilton";
  return "puppy_monitor_kw";
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
