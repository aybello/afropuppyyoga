export const PRIMARY_HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp";
export const FALLBACK_HERO_IMAGE = "/manus-storage/afropuppyyoga-hero_3919ee3c.webp";

/** Returns one fallback source, then stops retrying after that source fails. */
export function getNextHeroImageOnError(currentImage: string): string | null {
  return currentImage === PRIMARY_HERO_IMAGE ? FALLBACK_HERO_IMAGE : null;
}
