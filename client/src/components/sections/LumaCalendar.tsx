/**
 * LumaCalendar Section
 * Design: Warm Afro-Wellness Editorial — Pink Blossom palette
 * Embeds the AfroPuppyYoga Luma calendar using Luma's official iframe embed.
 * The embed URL format is: https://lu.ma/embed/calendar/{calendar-api-id}/events
 */

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";

export default function LumaCalendar() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Luma's embed script — initializes checkout widgets if any are present
    const script = document.createElement("script");
    script.id = "luma-checkout";
    script.src = "https://embed.lu.ma/checkout-button.js";
    script.async = true;
    if (!document.getElementById("luma-checkout")) {
      document.body.appendChild(script);
    }
  }, []);

  return (
    <section id="classes" className="py-10 md:py-28" style={{ background: "oklch(0.98 0.01 350)" }}>
      <div className="container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8" style={{ background: "#c2185b" }} />
              <span
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: "#c2185b" }}
              >
                Book a Class
              </span>
            </div>
            <h2
              className="text-4xl md:text-5xl font-bold leading-tight"
              style={{ fontFamily: "'Fraunces', serif", color: "#1a0a0f" }}
            >
              Upcoming{" "}
              <em className="not-italic" style={{ color: "#e91e8c" }}>
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
            onClick={() => trackCTAClick("Open Full Calendar — Classes")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105 shrink-0"
            style={{
              background: "#e91e8c",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(233,30,140,0.3)",
            }}
          >
            <CalendarDays size={16} />
            Open Full Calendar
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Summer Sale Pricing Callout */}
        <div
          className="mb-8 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: "linear-gradient(135deg, #fce7f3 0%, #fff7ed 100%)", border: "1.5px solid #f9a8d4" }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">☀️</span>
            <span className="text-sm font-black uppercase tracking-widest" style={{ color: "#be185d" }}>Summer Sale</span>
          </div>
          <div className="flex flex-wrap gap-3 flex-1">
            {[
              { label: "Early Bird", was: "$56", now: "$50" },
              { label: "Regular", was: "$58", now: "$52" },
              { label: "Bring a Friend", was: "$108", now: "$96" },
              { label: "Group of 3", was: "$156", now: "$138" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #f9a8d4" }}>
                <span className="text-xs font-semibold" style={{ color: "#7c3f5e" }}>{t.label}</span>
                <span className="text-xs line-through" style={{ color: "#9d6b7a" }}>{t.was}</span>
                <span className="text-sm font-black" style={{ color: "#be185d" }}>{t.now}</span>
              </div>
            ))}
          </div>
          <span className="text-xs" style={{ color: "#9d6b7a" }}>Limited time · Prices in CAD</span>
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
          {!loaded && (
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
              <p className="text-center text-xs mt-4" style={{ color: "#c2185b" }}>Loading upcoming classes…</p>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src="https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events?theme=light&lt=light"
            width="100%"
            height="500"
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
        </div>

        {/* Footer note */}
        <p className="text-center text-sm mt-5" style={{ color: "#9e6070" }}>
          Powered by{" "}
          <a
            href="https://lu.ma"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: "#c2185b" }}
          >
            Luma
          </a>{" "}
          · Secure checkout · Instant confirmation
        </p>
      </div>
    </section>
  );
}
