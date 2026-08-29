/**
 * LumaCalendar Section
 * Design: Warm Afro-Wellness Editorial — Pink Blossom palette
 * Embeds the AfroPuppyYoga Luma calendar using Luma's official iframe embed.
 * The embed URL format is: https://lu.ma/embed/calendar/{calendar-api-id}/events
 */

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import {
  LUMA_CALENDAR_EMBED_URL,
  LUMA_CALENDAR_LOAD_MARGIN,
  LUMA_CHECKOUT_SCRIPT_URL,
  shouldActivateLumaCalendar,
} from "@shared/lumaCalendarEmbed";

export default function LumaCalendar() {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [nearClasses, setNearClasses] = useState(false);
  const [requestedByVisitor, setRequestedByVisitor] = useState(false);
  const { track } = useMetaPixel();
  const calendarActive = shouldActivateLumaCalendar(nearClasses, requestedByVisitor);

  useEffect(() => {
    const target = sectionRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearClasses(true);
          observer.disconnect();
        }
      },
      { rootMargin: LUMA_CALENDAR_LOAD_MARGIN },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!calendarActive) return;
    // Luma's embed script — initializes checkout widgets if any are present
    const script = document.createElement("script");
    script.id = "luma-checkout";
    script.src = LUMA_CHECKOUT_SCRIPT_URL;
    script.async = true;
    if (!document.getElementById("luma-checkout")) {
      document.body.appendChild(script);
    }
  }, [calendarActive]);

  return (
    <section ref={sectionRef} id="classes" className="py-10 md:py-28" style={{ background: "oklch(0.98 0.01 350)" }}>
      <div className="container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8" style={{ background: "#8B2252" }} />
              <span
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: "#8B2252" }}
              >
                Book a Class
              </span>
            </div>
            <h2
              className="text-4xl md:text-5xl font-bold leading-tight"
              style={{ fontFamily: "'Fraunces', serif", color: "#1A0A12" }}
            >
              Upcoming{" "}
              <em className="not-italic" style={{ color: "#8B2252" }}>
                Classes
              </em>
            </h2>
            <p className="mt-3 text-base md:text-lg max-w-xl" style={{ color: "#5a3040" }}>
              Browse and book upcoming puppy yoga sessions in Kitchener, Hamilton, and beyond — directly below.
            </p>
          </div>

          <a
            href="https://luma.com/AfroPuppyYoga?k=c"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackCTAClick("Open Full Calendar — Classes");
              track("InitiateCheckout", { content_name: "AfroPuppyYoga Calendar" });
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105 shrink-0"
            style={{
              background: "#8B2252",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(233,30,140,0.3)",
            }}
          >
            <CalendarDays size={16} />
            Open Full Calendar
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Luma Calendar Embed */}
        {/* Force light color-scheme at the DOM level so Luma's prefers-color-scheme detection sees light mode regardless of OS setting */}
        <div
          className="relative rounded-2xl overflow-hidden luma-embed-wrapper"
          style={{
            border: "1px solid rgba(194,24,91,0.15)",
            boxShadow: "0 8px 40px rgba(194,24,91,0.08)",
            background: "#ffffff",
            minHeight: "600px",
            colorScheme: "light",
            // Force light mode at the CSS level — overrides OS dark mode for this subtree
          }}
        >
          {/* Scoped CSS to force light mode inside the iframe wrapper */}
          <style>{`
            .luma-embed-wrapper, .luma-embed-wrapper * {
              color-scheme: light only !important;
            }
          `}</style>
          {/* Loading skeleton — shimmer cards */}
          {calendarActive && !loaded && (
            <div className="absolute inset-0 p-6" style={{ background: "#fff" }}>
              <style>{`
                @keyframes shimmer {
                  0% { background-position: -600px 0; }
                  100% { background-position: 600px 0; }
                }
                .skeleton-shimmer {
                  background: linear-gradient(90deg, #f5e8ef 25%, #fce4ef 50%, #f5e8ef 75%);
                  background-size: 600px 100%;
                  animation: shimmer 1.4s infinite linear;
                  border-radius: 10px;
                }
              `}</style>
              {/* Skeleton event cards */}
              {[1, 2, 3].map(i => (
                <div key={i} className="mb-4 p-4 border border-[#F0D0DC] rounded-xl flex gap-4 items-start">
                  <div className="skeleton-shimmer w-14 h-14 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton-shimmer h-4 w-3/4" />
                    <div className="skeleton-shimmer h-3 w-1/2" />
                    <div className="skeleton-shimmer h-3 w-1/3" />
                  </div>
                  <div className="skeleton-shimmer w-20 h-8 rounded-full shrink-0" />
                </div>
              ))}
              <p className="text-center text-xs mt-4" style={{ color: "#8B2252" }}>Loading upcoming classes…</p>
            </div>
          )}
          {!calendarActive ? (
            <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center md:min-h-[600px]">
              <CalendarDays size={34} style={{ color: "#8B2252" }} />
              <p className="mt-4 font-semibold" style={{ color: "#3D1A2E" }}>Live upcoming classes</p>
              <p className="mt-2 max-w-sm text-sm" style={{ color: "#956A7C" }}>The calendar loads when you reach this section, so the rest of the site opens faster.</p>
              <button
                type="button"
                onClick={() => setRequestedByVisitor(true)}
                className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "#8B2252" }}
              >
                Show upcoming classes
              </button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={LUMA_CALENDAR_EMBED_URL}
              width="100%"
              height="500"
              loading="lazy"
              className="md:!h-[600px]"
              frameBorder="0"
              style={{
                border: "none",
                borderRadius: "16px",
                display: "block",
                opacity: loaded ? 1 : 0,
                transition: "opacity 0.4s ease",
                colorScheme: "light",
                filter: "none",
              }}
              allowFullScreen
              aria-hidden="false"
              tabIndex={0}
              onLoad={() => setLoaded(true)}
              title="AfroPuppyYoga Upcoming Classes"
            />
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm mt-5" style={{ color: "#9e6070" }}>
          Powered by{" "}
          <a
            href="https://lu.ma"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: "#8B2252" }}
          >
            Luma
          </a>{" "}
          · Secure checkout · Instant confirmation
        </p>
      </div>
    </section>
  );
}
