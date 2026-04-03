/**
 * useAnalytics — Scroll depth & time-on-page tracking via Umami custom events
 *
 * Tracks:
 *  - Scroll depth milestones: 25%, 50%, 75%, 90%, 100%
 *  - Time on page milestones: 30s, 60s, 120s, 300s
 *  - CTA clicks: Book a Class, Private Events, Book Your Spot, etc.
 *
 * All events are sent via window.umami.track() which is injected by the
 * Umami script tag in index.html. Events appear in the Umami dashboard
 * under "Events" for the site.
 */

import { useEffect } from "react";

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, unknown>) => void;
    };
  }
}

function trackEvent(name: string, data?: Record<string, unknown>) {
  try {
    window.umami?.track(name, data);
  } catch {
    // Silently fail if Umami is not loaded (e.g. ad-blocked)
  }
}

export function useScrollDepthTracking() {
  useEffect(() => {
    const milestones = [25, 50, 75, 90, 100];
    const reached = new Set<number>();

    function onScroll() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      if (docHeight <= 0) return;

      const pct = Math.round((scrollTop / docHeight) * 100);

      for (const milestone of milestones) {
        if (pct >= milestone && !reached.has(milestone)) {
          reached.add(milestone);
          trackEvent("scroll_depth", { depth: `${milestone}%` });
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

export function useTimeOnPageTracking() {
  useEffect(() => {
    const milestones = [30, 60, 120, 300]; // seconds
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const seconds of milestones) {
      const t = setTimeout(() => {
        const label =
          seconds < 60
            ? `${seconds}s`
            : `${Math.round(seconds / 60)}min`;
        trackEvent("time_on_page", { duration: label });
      }, seconds * 1000);
      timers.push(t);
    }

    return () => timers.forEach(clearTimeout);
  }, []);
}

/** Call this on any important CTA click */
export function trackCTAClick(label: string) {
  trackEvent("cta_click", { label });
}
