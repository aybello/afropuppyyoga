export type OfferLetterType =
  | "puppy_monitor_kw"
  | "puppy_monitor_hamilton"
  | "yoga_instructor"
  | "puppy_specialist"
  | "operations_specialist"
  | "bdr";

export function detectOfferLetterType(role: string, location: string): OfferLetterType {
  const roleLower = role.toLowerCase();
  const locationLower = location.toLowerCase();

  if (roleLower.includes("yoga")) return "yoga_instructor";
  if (roleLower.includes("operations specialist") || roleLower.includes("operation specialist")) {
    return "operations_specialist";
  }
  if (roleLower.includes("specialist")) return "puppy_specialist";
  if (roleLower.includes("bdr") || roleLower.includes("business development")) return "bdr";
  if (locationLower.includes("hamilton") || locationLower.includes("ham")) {
    return "puppy_monitor_hamilton";
  }
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
  application: {
    email: string;
    name: string;
    role: string;
    location: string;
  },
  now = new Date()
): boolean {
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
