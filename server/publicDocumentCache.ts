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
export const PUBLIC_SURROGATE_CACHE_CONTROL =
  "max-age=300, stale-while-revalidate=86400";
export const PRIVATE_SURROGATE_CACHE_CONTROL = "no-store";

/**
 * The public marketing SPA document is identical for anonymous visitors and can
 * safely be served from a shared cache. Anything that can read or establish an
 * APY HQ session remains strictly private.
 */
function isPrivateDocumentPath(pathname: string): boolean {
  const normalizedPath = pathname.split("?")[0] || "/";
  return (
    PRIVATE_EXACT_PATHS.has(normalizedPath) ||
    PRIVATE_PREFIXES.some(
      prefix => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    )
  );
}

export function getDocumentCacheControl(pathname: string): string {
  return isPrivateDocumentPath(pathname)
    ? PRIVATE_DOCUMENT_CACHE_CONTROL
    : PUBLIC_DOCUMENT_CACHE_CONTROL;
}

/**
 * Some managed proxies reserve Cache-Control for browser freshness but honour
 * Surrogate-Control for their shared edge cache. This gives public visitors a
 * cache-first document without ever allowing staff or customer-sensitive pages
 * into that shared cache.
 */
export function getDocumentSurrogateCacheControl(pathname: string): string {
  return isPrivateDocumentPath(pathname)
    ? PRIVATE_SURROGATE_CACHE_CONTROL
    : PUBLIC_SURROGATE_CACHE_CONTROL;
}
