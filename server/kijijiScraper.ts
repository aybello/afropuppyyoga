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

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-CA,en;q=0.9",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
      },
    };
    https.get(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function extractNextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function parseListingFromApollo(apolloState: Record<string, any>): KijijiListing[] {
  const listings: KijijiListing[] = [];
  for (const [key, val] of Object.entries(apolloState)) {
    if (!key.startsWith("StandardListing:") && !key.startsWith("TopAdListing:")) continue;
    const v = val as any;
    if (!v.title) continue;
    const priceRef = v.price;
    let price: number | null = null;
    if (priceRef && priceRef.__ref) {
      const priceObj = apolloState[priceRef.__ref] as any;
      if (priceObj?.amount) price = Math.round(parseFloat(priceObj.amount) * 100);
    }
    const locRef = v.location;
    let location = { city: "", province: "" };
    if (locRef && locRef.__ref) {
      const locObj = apolloState[locRef.__ref] as any;
      location = { city: locObj?.name ?? "", province: locObj?.province ?? "" };
    }
    const imageUrls: string[] = [];
    if (Array.isArray(v.images)) {
      for (const imgRef of v.images.slice(0, 3)) {
        const imgObj = apolloState[imgRef.__ref] as any;
        if (imgObj?.url) imageUrls.push(imgObj.url);
      }
    }
    const attrs: Record<string, string> = {};
    if (Array.isArray(v.attributes)) {
      for (const attrRef of v.attributes) {
        const attrObj = apolloState[attrRef.__ref] as any;
        if (attrObj?.machineKey && attrObj?.value) attrs[attrObj.machineKey] = attrObj.value;
      }
    }
    const id = key.split(":")[1] ?? key;
    const slug = v.seoUrl ?? v.slug ?? "";
    listings.push({
      id,
      title: v.title ?? "",
      description: v.description ?? "",
      price,
      location,
      imageUrls,
      url: slug ? `https://www.kijiji.ca${slug}` : `https://www.kijiji.ca/v-pets/${id}`,
      postedAt: v.sortingDate ?? v.activationDate ?? null,
      attributes: attrs,
    });
  }
  return listings;
}

// Location coords for APY studio areas
const LOCATION_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  kitchener: { lat: 43.4516, lng: -80.4925, label: "Kitchener" },
  hamilton: { lat: 43.2557, lng: -79.8711, label: "Hamilton" },
  oakville: { lat: 43.4675, lng: -79.6877, label: "Oakville" },
  gta: { lat: 43.6532, lng: -79.3832, label: "GTA" },
};

export async function searchKijiji(keyword: string, maxResults = 20, location = "gta"): Promise<KijijiListing[]> {
  const loc = LOCATION_COORDS[location] ?? LOCATION_COORDS.gta;
  const encoded = encodeURIComponent(keyword);
  const url = `https://www.kijiji.ca/b-pets/ontario/${encoded}/k0c112l9004?radius=100.0&address=${loc.label}&ll=${loc.lat},${loc.lng}`;
  const html = await httpsGet(url);
  const nextData = extractNextData(html);
  if (!nextData) return [];
  const apolloState = nextData?.props?.pageProps?.apolloState ?? {};
  return parseListingFromApollo(apolloState).slice(0, maxResults);
}

export async function scrapeKijijiListing(listingUrl: string): Promise<KijijiListing | null> {
  const html = await httpsGet(listingUrl);
  const nextData = extractNextData(html);
  if (!nextData) return null;
  const apolloState = nextData?.props?.pageProps?.apolloState ?? {};
  const listings = parseListingFromApollo(apolloState);
  if (listings.length > 0) return listings[0];
  const pageProps = nextData?.props?.pageProps ?? {};
  if (pageProps.listing) {
    const l = pageProps.listing;
    return {
      id: String(l.id ?? l.adId ?? ""),
      title: l.title ?? "",
      description: l.description ?? "",
      price: l.price?.amount ? Math.round(parseFloat(l.price.amount) * 100) : null,
      location: { city: l.location?.name ?? l.location?.city ?? "", province: l.location?.province ?? "" },
      imageUrls: (l.images ?? []).slice(0, 3).map((i: any) => i.url ?? i.href ?? "").filter(Boolean),
      url: listingUrl,
      postedAt: l.sortingDate ?? l.activationDate ?? null,
      attributes: {},
    };
  }
  return null;
}
