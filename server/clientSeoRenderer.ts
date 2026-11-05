import { getPublicSeoSnapshot } from "./seoRenderer";

// Keep in sync with the explicit <Route path=...> entries in client/src/App.tsx.
// A test checks the list against App.tsx so adding a client route cannot silently
// turn it into an HTTP 404. The fallback <Route> is deliberately excluded.
export const SPA_ROUTE_PATTERNS = [
  "/", "/predictor", "/breeder-calculator", "/submit-invoice",
  "/admin/invoices", "/admin/applications", "/admin/partnerships", "/admin/staff-training",
  "/careers", "/staff", "/staff/training", "/staff/documents", "/staff/get-started",
  "/partnerships", "/staff-login", "/staff-access", "/admin/run-apy", "/admin/staff",
  "/sign", "/private-events/quote", "/admin/private-events", "/admin/breeders",
  "/admin/puppy-schedule", "/admin/schedule-calendar", "/admin/refunds", "/admin/cancellation",
  "/admin/sms-broadcast", "/admin/sms-inbox", "/admin/review-texts", "/admin/revenue",
  "/admin/quickbooks", "/admin/meta-campaigns", "/admin/employees", "/staff/revenue-dashboard",
  "/admin/employee-directory", "/admin/breeder-leads/:id", "/admin/staff-availability",
  "/admin/breeder-leads", "/breeder-availability", "/loyalty", "/ethics", "/privacy", "/terms",
  "/refund-policy", "/quickbooks-disconnect", "/puppy-yoga-kitchener", "/puppy-yoga-hamilton",
  "/puppy-yoga-oakville", "/puppy-yoga-guelph", "/kitchener", "/hamilton", "/oakville",
  "/corporate-puppy-yoga", "/private-puppy-yoga-events", "/admin-login", "/404",
] as const;

// Wouter's default regexparam matcher is case-insensitive, permits one trailing
// slash, matches :id to one nonempty segment, and decodeURI's the pathname.
const spaRouteMatchers = SPA_ROUTE_PATTERNS.map(route => {
  const segments = route.split("/").filter(Boolean).map(segment =>
    segment.startsWith(":") ? "[^/]+?" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`^${segments.map(segment => `/${segment}`).join("")}/?$`, "i");
});

export function isRegisteredSpaPath(pathname: string): boolean {
  let decoded = pathname;
  try { decoded = decodeURI(pathname); } catch { /* Wouter keeps malformed paths unchanged. */ }
  return spaRouteMatchers.some(matcher => matcher.test(decoded));
}

/**
 * Keep the actual SPA shell and its scripts intact. Only the document head is
 * adjusted; this is not SSR and must never be used as a React hydration tree.
 * Snapshot metadata is limited to the explicitly registered public routes.
 */
export function renderClientSeoHead(template: string, pathname: string, options: { noindex?: boolean } = {}): string {
  // Only normalize paths the client actually accepts; in particular, do not
  // turn malformed or unknown paths into a known marketing page.
  const snapshot = !options.noindex && isRegisteredSpaPath(pathname)
    ? getPublicSeoSnapshot(pathname)
    : undefined;
  const headMatch = template.match(/<head\b[^>]*>[\s\S]*?<\/head>/i);
  if (!headMatch) return template;
  let head = headMatch[0];

  // The template's homepage-only schema must not leak into other routes, and
  // contains date/price assertions that have not been independently verified.
  head = head.replace(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  if (!snapshot) {
    head = head.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\/?>/i, "");
    if (options.noindex) {
      // A private shell must not advertise the homepage's title or social URL.
      head = head.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "<title>AfroPuppyYoga</title>");
      head = head.replace(/<meta\b(?=[^>]*\b(?:name=["'](?:description|keywords|twitter:title|twitter:description)["']|property=["']og:(?:url|title|description)["']))[^>]*\/?>/gi, "");
      const robots = '<meta name="robots" content="noindex, nofollow, noarchive" />';
      const robotsPattern = /<meta\b(?=[^>]*\bname=["']robots["'])[^>]*\/?>/i;
      head = robotsPattern.test(head) ? head.replace(robotsPattern, robots) : head.replace(/<\/head>/i, `${robots}\n</head>`);
    }
    return template.replace(headMatch[0], () => head);
  }

  const title = snapshot.match(/<title>[^<]*<\/title>/i)?.[0];
  if (title) head = head.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => title);
  const names = ["description", "twitter:title", "twitter:description", "twitter:image"];
  const properties = ["og:title", "og:description", "og:url", "og:image"];
  for (const [attribute, keys] of [["name", names], ["property", properties]] as const) {
    for (const key of keys) {
      const tagPattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${key}["'])[^>]*\\/?>`, "i");
      const tag = snapshot.match(tagPattern)?.[0];
      if (tag) head = head.replace(tagPattern, () => tag);
    }
  }
  const canonicalPattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\/?>/i;
  const canonical = snapshot.match(canonicalPattern)?.[0];
  if (canonical) head = head.replace(canonicalPattern, () => canonical);
  // The stock dimensions/alt describe the logo, not an arbitrary route image.
  head = head.replace(/<meta\b(?=[^>]*\bproperty=["']og:image:(?:width|height|alt)["'])[^>]*\/?>/gi, "");

  // A breadcrumb from the same page snapshot is the only initial schema we
  // carry over. Remove it when the document is parsed so SPA navigation cannot retain stale
  // server breadcrumbs. Page-owned React schemas continue to work normally.
  const scripts = snapshot.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
  const breadcrumb = scripts.find(script => script.includes('"@type":"BreadcrumbList"'));
  if (breadcrumb) {
    const tagged = breadcrumb.replace("<script ", '<script id="initial-route-breadcrumb" ');
    head = head.replace(/<\/head>/i, () => `${tagged}\n<script>document.addEventListener("DOMContentLoaded",function(){document.getElementById("initial-route-breadcrumb")?.remove()},{once:true});</script>\n</head>`);
  }
  return template.replace(headMatch[0], () => head);
}
