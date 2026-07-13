/**
 * useMetaPixel — Meta Pixel (fbq) integration hook
 *
 * Injects the fbevents.js script once on first call, initialises the pixel
 * with VITE_META_PIXEL_ID, and fires PageView. Exposes a `track` helper for
 * standard events (InitiateCheckout, Purchase, etc.).
 *
 * Usage:
 *   const { track } = useMetaPixel();
 *   track("InitiateCheckout", { content_name: "Kitchener Class" });
 *
 * The pixel is a no-op when VITE_META_PIXEL_ID is not set (dev/staging).
 */

import { useEffect, useCallback } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

let initialised = false;

function initPixel(pixelId: string): void {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  // Inject fbevents.js
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  // Bootstrap fbq queue before the script loads
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if ((fbq as unknown as { callMethod?: (...a: unknown[]) => void }).callMethod) {
        (fbq as unknown as { callMethod: (...a: unknown[]) => void }).callMethod(...args);
      } else {
        (fbq as unknown as { queue: unknown[][] }).queue.push(args);
      }
    } as unknown as ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[][];
      push: (...args: unknown[]) => void;
      loaded: boolean;
      version: string;
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
  }

  window.fbq!("init", pixelId);
  window.fbq!("track", "PageView");
}

export function useMetaPixel() {
  useEffect(() => {
    if (PIXEL_ID) {
      initPixel(PIXEL_ID);
    }
  }, []);

  const track = useCallback(
    (eventName: string, params?: Record<string, unknown>) => {
      if (!PIXEL_ID || !window.fbq) return;
      window.fbq("track", eventName, params ?? {});
    },
    []
  );

  return { track };
}
