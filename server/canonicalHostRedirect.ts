import type { RequestHandler } from "express";

// Published aliases only. Development preview hosts must keep their own page,
// image and API requests rather than redirecting into the live APY environment.
const PUBLISHED_APY_HOSTS = new Set([
  "afropuppyyoga.manus.space",
  "afropuppy-tnrbecmt.manus.space",
]);

export const canonicalPublishedHostRedirect: RequestHandler = (req, res, next) => {
  const host = (req.headers.host ?? "")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");

  if (!PUBLISHED_APY_HOSTS.has(host)) return next();
  return res.redirect(301, `https://afropuppyyoga.ca${req.originalUrl}`);
};
