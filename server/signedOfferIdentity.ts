/** A signed offer's recorded identity must match the reviewed application's identity. */
export function signedOfferIdentityMatches(
  offer: { applicantName: unknown; applicantEmail: unknown },
  profile: { name: string; email: string },
): boolean {
  const normalizedName = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  return typeof offer.applicantName === "string" && normalizedName(offer.applicantName) === normalizedName(profile.name)
    && typeof offer.applicantEmail === "string" && offer.applicantEmail.trim().toLowerCase() === profile.email.trim().toLowerCase();
}
