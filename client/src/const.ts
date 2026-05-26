export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// ─── Brand Constants ─────────────────────────────────────────────────────────
/** CDN URL for the AfroPuppyYoga logo — used across Navbar, Footer, AdminNav, etc. */
export const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

/** Luma booking page URL */
export const BOOK_URL = "https://lu.ma/afropuppyyoga";

/** Instagram profile URL */
export const INSTAGRAM_URL = "https://www.instagram.com/afropuppyyoga";

/** TikTok profile URL */
export const TIKTOK_URL = "https://www.tiktok.com/@afropuppyyoga";

/** Contact email */
export const CONTACT_EMAIL = "afropuppyyogaofficial@gmail.com";

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const statePayload = returnPath
    ? btoa(JSON.stringify({ redirectUri, returnPath }))
    : btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", statePayload);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
