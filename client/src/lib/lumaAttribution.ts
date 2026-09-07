const META_ID_PATTERN = /^fb\.\d+\.\d+\.[A-Za-z0-9._-]+$/;
const FBC_STORAGE_KEY = "apy_meta_fbc";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function validMetaId(value: string | null): string | null {
  return value && value.length <= 255 && META_ID_PATTERN.test(value) ? value : null;
}

function buildFbc(fbclid: string | null): string | null {
  if (!fbclid || !/^[A-Za-z0-9._-]+$/.test(fbclid) || fbclid.length > 200) return null;
  try {
    const stored = validMetaId(window.sessionStorage?.getItem(FBC_STORAGE_KEY) ?? null);
    if (stored) return stored;
  } catch {
    // Storage may be blocked; attribution still works for this page view.
  }
  const fbc = `fb.1.${Date.now()}.${fbclid}`;
  try {
    window.sessionStorage?.setItem(FBC_STORAGE_KEY, fbc);
  } catch {
    // Storage may be blocked; do not interrupt booking.
  }
  return fbc;
}

/**
 * Carry the landing-page campaign and Meta browser identifiers into Luma.
 * Luma returns UTM fields with the paid guest, allowing the server-side
 * Purchase event to include fbc/fbp even though checkout happens off-domain.
 */
export function appendAttributionToLumaUrl(rawUrl: string): string {
  if (typeof window === "undefined") return rawUrl;

  const destination = new URL(rawUrl);
  const landing = new URLSearchParams(window.location.search);
  const fbclid = landing.get("fbclid");
  const fbc = validMetaId(readCookie("_fbc")) ?? buildFbc(fbclid);
  const fbp = validMetaId(readCookie("_fbp"));

  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term"] as const) {
    const value = landing.get(key);
    if (value) destination.searchParams.set(key, value.slice(0, 255));
  }
  if (fbclid && !destination.searchParams.has("utm_source")) {
    destination.searchParams.set("utm_source", "facebook");
    destination.searchParams.set("utm_medium", "paid_social");
  }

  const contentParts = [landing.get("utm_content")?.slice(0, 80) ?? ""];
  if (fbc) contentParts.push(`apy_fbc=${fbc}`);
  if (fbp) contentParts.push(`apy_fbp=${fbp}`);
  const utmContent = contentParts.filter(Boolean).join("|");
  if (utmContent) destination.searchParams.set("utm_content", utmContent.slice(0, 255));

  return destination.toString();
}
