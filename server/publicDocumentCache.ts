const PRIVATE_PREFIXES = [
  "/admin",
  "/api",
  "/staff",
  "/sign",
  "/invoice",
  "/review",
];

const PRIVATE_EXACT_PATHS = new Set([
  "/staff-access",
  "/staff-login",
  "/invoice-submit",
]);

export const PUBLIC_DOCUMENT_CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
export const PRIVATE_DOCUMENT_CACHE_CONTROL = "no-store, no-cache, must-revalidate";

/**
 * The public marketing SPA document is identical for anonymous visitors and can
 * safely be served from a shared cache. Anything that can read or establish an
 * APY HQ session remains strictly private.
 */
export function getDocumentCacheControl(pathname: string): string {
  const normalizedPath = pathname.split("?")[0] || "/";
  const isPrivate =
    PRIVATE_EXACT_PATHS.has(normalizedPath) ||
    PRIVATE_PREFIXES.some(
      prefix => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    );

  return isPrivate ? PRIVATE_DOCUMENT_CACHE_CONTROL : PUBLIC_DOCUMENT_CACHE_CONTROL;
}
