import { useEffect } from "react";

interface SeoMetaOptions {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

/**
 * Injects per-page SEO meta tags into the document <head>:
 * - <title>
 * - <meta name="description">
 * - <link rel="canonical">
 * - Open Graph title, description, url
 *
 * All tags are cleaned up on unmount so they don't bleed between routes.
 */
export function useSeoMeta({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
}: SeoMetaOptions) {
  useEffect(() => {
    // --- Title ---
    const prevTitle = document.title;
    document.title = title;

    // --- Helper: upsert a <meta> tag ---
    function upsertMeta(selector: string, attr: string, value: string): HTMLMetaElement {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
      return el;
    }

    // --- Helper: upsert a <link> tag ---
    function upsertLink(rel: string, href: string): HTMLLinkElement {
      let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
      return el;
    }

    const descEl = upsertMeta('meta[name="description"]', "content", description);
    const canonEl = upsertLink("canonical", canonical);
    const ogTitleEl = upsertMeta('meta[property="og:title"]', "content", ogTitle ?? title);
    const ogDescEl = upsertMeta('meta[property="og:description"]', "content", ogDescription ?? description);
    const ogUrlEl = upsertMeta('meta[property="og:url"]', "content", canonical);
    const ogImgEl = ogImage
      ? upsertMeta('meta[property="og:image"]', "content", ogImage)
      : null;

    return () => {
      // Restore previous title on unmount — keep other tags as-is
      // (don't reset canonical to "/" — that was the critical SEO bug)
      document.title = prevTitle;
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogImage]);
}
