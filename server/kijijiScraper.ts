import https from "https";
import { URL } from "url";

export interface KijijiListing {
  id: string;
  title: string;
  description: string;
  price: number | null;
  location: { city: string; province: string };
  imageUrls: string[];
  url: string;
  postedAt: string | null;
  attributes: Record<string, string>;
}

type HttpResult = {
  status: number;
  url: string;
  body: string;
  contentType: string;
};

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-CA,en;q=0.9",
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
};

function httpsGet(url: string, redirects = 0): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error("Kijiji redirected too many times"));
      return;
    }

    const parsed = new URL(url);
    const options = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: DEFAULT_HEADERS,
    };

    const req = https.get(options, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;

      if ([301, 302, 303, 307, 308].includes(status) && location) {
        res.resume();
        const nextUrl = new URL(location, url).toString();
        httpsGet(nextUrl, redirects + 1).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        resolve({
          status,
          url,
          body: Buffer.concat(chunks).toString("utf8"),
          contentType: String(res.headers["content-type"] ?? ""),
        });
      });
      res.on("error", reject);
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error("Kijiji request timed out"));
    });
    req.on("error", reject);
  });
}

function assertUsefulResponse(result: HttpResult, context: string) {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${context}: Kijiji returned HTTP ${result.status}`);
  }

  // Only flag as blocked if the page has NO real content (no __NEXT_DATA__)
  // AND looks like a challenge page. Real Kijiji pages can contain "captcha" in scripts.
  const hasRealContent = result.body.includes("__NEXT_DATA__");
  if (!hasRealContent) {
    const bodyLower = result.body.toLowerCase();
    const looksBlocked =
      bodyLower.includes("captcha") ||
      bodyLower.includes("access denied") ||
      bodyLower.includes("verify you are human") ||
      bodyLower.includes("cf-chl-") ||
      (bodyLower.includes("akamai") && bodyLower.includes("reference #"));
    if (looksBlocked) {
      throw new Error(`${context}: Kijiji returned a bot/challenge page instead of listings`);
    }
  }

  if (result.body.length < 1000) {
    throw new Error(`${context}: Kijiji returned an unexpectedly short response`);
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractNextData(html: string): any {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parseMoneyToCents(value: unknown): number | null {
  // Kijiji's Apollo state stores price.amount in cents (e.g. 180000 = $1800.00)
  // We return the value in cents as-is for numbers from Apollo state
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const parsed = Number.parseFloat(cleaned);
  // For string prices like "$1,800.00", convert to cents
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function parseListingFromApollo(apolloState: Record<string, any>): KijijiListing[] {
  const listings: KijijiListing[] = [];

  for (const [key, val] of Object.entries(apolloState ?? {})) {
    if (!key.startsWith("StandardListing:") && !key.startsWith("TopAdListing:")) continue;
    const v = val as any;
    if (!v?.title) continue;

    const priceRef = v.price;
    let price: number | null = null;
    if (priceRef?.__ref) {
      const priceObj = apolloState[priceRef.__ref] as any;
      price = parseMoneyToCents(priceObj?.amount ?? priceObj?.formattedValue);
    } else {
      price = parseMoneyToCents(v.price?.amount ?? v.price);
    }

    const locRef = v.location;
    let location = { city: "", province: "" };
    if (locRef?.__ref) {
      const locObj = apolloState[locRef.__ref] as any;
      location = {
        city: locObj?.name ?? locObj?.city ?? "",
        province: locObj?.province ?? locObj?.provinceName ?? "",
      };
    } else if (v.location) {
      location = {
        city: v.location?.name ?? v.location?.city ?? "",
        province: v.location?.province ?? "",
      };
    }

    const imageUrls: string[] = [];
    if (Array.isArray(v.imageUrls)) {
      imageUrls.push(...v.imageUrls.slice(0, 5).map((u: string) => u.replace("kijijica-200-jpg", "kijijica-640-jpg")));
    } else if (Array.isArray(v.images)) {
      for (const imgRef of v.images.slice(0, 5)) {
        const imgObj = imgRef?.__ref ? apolloState[imgRef.__ref] : imgRef;
        const imageUrl = imgObj?.url ?? imgObj?.href;
        if (imageUrl) imageUrls.push(imageUrl);
      }
    }

    const attrs: Record<string, string> = {};
    if (Array.isArray(v.attributes)) {
      for (const attrRef of v.attributes) {
        const attrObj = attrRef?.__ref ? apolloState[attrRef.__ref] : attrRef;
        if (attrObj?.machineKey && attrObj?.value != null) {
          attrs[String(attrObj.machineKey)] = String(attrObj.value);
        }
      }
    }

    const id = String(v.id ?? v.listingId ?? key.split(":").slice(1).join(":") ?? key);
    const slug = v.seoUrl ?? v.slug ?? v.url ?? "";
    const absoluteUrl = slug
      ? new URL(slug, "https://www.kijiji.ca").toString()
      : `https://www.kijiji.ca/v-pets/${encodeURIComponent(id)}`;

    listings.push({
      id,
      title: String(v.title ?? ""),
      description: String(v.description ?? ""),
      price,
      location,
      imageUrls,
      url: absoluteUrl,
      postedAt: v.sortingDate ?? v.activationDate ?? v.datePosted ?? null,
      attributes: attrs,
    });
  }

  return listings;
}

function flattenJsonLd(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value !== "object") return [];
  if (Array.isArray(value["@graph"])) return [value, ...value["@graph"].flatMap(flattenJsonLd)];
  return [value];
}

function extractJsonLd(html: string): any[] {
  const blocks: any[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    try {
      blocks.push(...flattenJsonLd(JSON.parse(match[1].trim())));
    } catch {
      // Ignore malformed structured-data blocks and continue to other fallbacks.
    }
  }
  return blocks;
}

function parseJsonLdListing(node: any, fallbackUrl: string): KijijiListing | null {
  const type = Array.isArray(node?.["@type"]) ? node["@type"].join(" ") : String(node?.["@type"] ?? "");
  const isListing = /product|offer|itempage|thing/i.test(type) || Boolean(node?.name && (node?.offers || node?.description));
  if (!isListing || !node?.name) return null;

  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const address = node?.address ?? node?.availableAtOrFrom?.address ?? node?.itemOffered?.address ?? {};
  const imageRaw = node.image ?? node?.itemOffered?.image ?? [];
  const imageUrls = (Array.isArray(imageRaw) ? imageRaw : [imageRaw])
    .map((img: any) => typeof img === "string" ? img : img?.url)
    .filter(Boolean)
    .slice(0, 5);

  const rawUrl = node.url ?? offer?.url ?? fallbackUrl;
  return {
    id: String(node.sku ?? node.productID ?? node.identifier ?? rawUrl),
    title: String(node.name),
    description: stripHtml(String(node.description ?? node?.itemOffered?.description ?? "")),
    price: parseMoneyToCents(offer?.price ?? node?.price),
    location: {
      city: String(address?.addressLocality ?? address?.name ?? ""),
      province: String(address?.addressRegion ?? ""),
    },
    imageUrls,
    url: new URL(String(rawUrl), "https://www.kijiji.ca").toString(),
    postedAt: node.datePosted ?? node.datePublished ?? null,
    attributes: {},
  };
}

function extractListingLinksFromHtml(html: string): KijijiListing[] {
  const results: KijijiListing[] = [];
  const seen = new Set<string>();

  // Kijiji listing URLs typically contain /v-.../<numeric id>. We deliberately
  // keep this fallback broad so a frontend markup change does not zero the search.
  const linkRegex = /<a\b[^>]*href=["']([^"']*\/v-[^"'#?]+\/[0-9]+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html))) {
    const absoluteUrl = new URL(decodeHtml(match[1]), "https://www.kijiji.ca").toString();
    if (seen.has(absoluteUrl)) continue;

    const inner = match[2];
    const title = stripHtml(inner);
    if (!title || title.length < 3) continue;

    seen.add(absoluteUrl);
    const idMatch = absoluteUrl.match(/\/([0-9]{6,})(?:\?|$)/);
    results.push({
      id: idMatch?.[1] ?? absoluteUrl,
      title: title.slice(0, 250),
      description: "",
      price: null,
      location: { city: "", province: "Ontario" },
      imageUrls: [],
      url: absoluteUrl,
      postedAt: null,
      attributes: {},
    });
  }

  return results;
}

function dedupeListings(listings: KijijiListing[]): KijijiListing[] {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    const key = listing.url || listing.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractListingsFromHtml(html: string, pageUrl: string): KijijiListing[] {
  const candidates: KijijiListing[] = [];

  const nextData = extractNextData(html);
  const apolloState = nextData?.props?.pageProps?.__APOLLO_STATE__ ?? nextData?.props?.pageProps?.apolloState ?? nextData?.props?.pageProps?.apollo?.state ?? {};
  candidates.push(...parseListingFromApollo(apolloState));

  for (const node of extractJsonLd(html)) {
    if (String(node?.["@type"] ?? "").toLowerCase() === "itemlist" && Array.isArray(node.itemListElement)) {
      for (const element of node.itemListElement) {
        const item = element?.item ?? element;
        const parsed = parseJsonLdListing(item, pageUrl);
        if (parsed) candidates.push(parsed);
      }
    } else {
      const parsed = parseJsonLdListing(node, pageUrl);
      if (parsed) candidates.push(parsed);
    }
  }

  if (candidates.length === 0) {
    candidates.push(...extractListingLinksFromHtml(html));
  }

  return dedupeListings(candidates);
}

// Location coords for APY studio areas
const LOCATION_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  kitchener: { lat: 43.4516, lng: -80.4925, label: "Kitchener, ON" },
  hamilton: { lat: 43.2557, lng: -79.8711, label: "Hamilton, ON" },
  oakville: { lat: 43.4675, lng: -79.6877, label: "Oakville, ON" },
  gta: { lat: 43.6532, lng: -79.3832, label: "Toronto, ON" },
};

export async function searchKijiji(keyword: string, maxResults = 20, location = "gta"): Promise<KijijiListing[]> {
  const loc = LOCATION_COORDS[location] ?? LOCATION_COORDS.gta;
  const encoded = encodeURIComponent(keyword.trim()).replace(/%20/g, "+");
  const url = `https://www.kijiji.ca/b-pets/ontario/${encoded}/k0c112l9004?radius=100.0&address=${loc.label.replace(/ /g, "+")}&ll=${loc.lat},${loc.lng}`;

  const result = await httpsGet(url);
  assertUsefulResponse(result, "Kijiji search failed");

  const listings = extractListingsFromHtml(result.body, result.url).slice(0, maxResults);
  if (listings.length === 0) {
    throw new Error(
      "Kijiji search returned a valid page but no listings could be extracted. Kijiji may have changed its page structure."
    );
  }

  return listings;
}

export async function scrapeKijijiListing(listingUrl: string): Promise<KijijiListing | null> {
  let parsed: URL;
  try {
    parsed = new URL(listingUrl);
  } catch {
    throw new Error("Invalid Kijiji URL");
  }

  if (!/(^|\.)kijiji\.ca$/i.test(parsed.hostname)) {
    throw new Error("Only kijiji.ca listing URLs are supported");
  }

  const result = await httpsGet(parsed.toString());
  assertUsefulResponse(result, "Kijiji listing import failed");

  const extracted = extractListingsFromHtml(result.body, result.url);
  if (extracted.length > 0) {
    // On a detail page, prefer the object whose URL/id most closely matches the requested listing.
    const requestedId = parsed.pathname.match(/\/([0-9]{6,})(?:\/|$)/)?.[1];
    const exact = requestedId
      ? extracted.find((item) => item.id === requestedId || item.url.includes(`/${requestedId}`))
      : undefined;
    const listing = exact ?? extracted[0];
    return { ...listing, url: listingUrl };
  }

  // Final detail-page fallback from OpenGraph/meta tags.
  const title = result.body.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? result.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) return null;

  const description = result.body.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const image = result.body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const priceText = result.body.match(/\$\s?([0-9][0-9,]*(?:\.\d{2})?)/)?.[1];
  const requestedId = parsed.pathname.match(/\/([0-9]{6,})(?:\/|$)/)?.[1] ?? listingUrl;

  return {
    id: requestedId,
    title: stripHtml(title),
    description: stripHtml(description),
    price: priceText ? parseMoneyToCents(priceText) : null,
    location: { city: "", province: "Ontario" },
    imageUrls: image ? [decodeHtml(image)] : [],
    url: listingUrl,
    postedAt: null,
    attributes: {},
  };
}
