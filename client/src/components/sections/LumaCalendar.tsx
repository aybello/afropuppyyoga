/**
 * Public class calendar
 * Shows APY admission pricing from live Luma ticket types while keeping the
 * Luma booking page as the source of truth for checkout and optional rentals.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { trackCTAClick } from "@/hooks/useAnalytics";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { LUMA_CALENDAR_LOAD_MARGIN, shouldActivateLumaCalendar } from "@shared/lumaCalendarEmbed";
import { appendAttributionToLumaUrl } from "@/lib/lumaAttribution";
import { isStillUpcomingPublicClass } from "@shared/publicClassTiming";

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string) {
  const [hourString, minute = "00"] = time.split(":");
  const hour = Number(hourString);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function formatAdmissionPrice(cents: number) {
  return `CA$${(cents / 100).toFixed(2)} + HST`;
}

export default function LumaCalendar() {
  const sectionRef = useRef<HTMLElement>(null);
  const [nearClasses, setNearClasses] = useState(false);
  const [requestedByVisitor, setRequestedByVisitor] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { track } = useMetaPixel();
  const calendarActive = shouldActivateLumaCalendar(nearClasses, requestedByVisitor);
  const calendarUrl = useMemo(
    () => appendAttributionToLumaUrl("https://luma.com/AfroPuppyYoga?k=c"),
    [],
  );
  const { data, isLoading, isError } = trpc.publicCalendar.listUpcoming.useQuery(undefined, {
    enabled: calendarActive,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const visibleClasses = useMemo(
    () => data?.classes.filter(event => isStillUpcomingPublicClass(event.classDate, event.endTime, currentTime)) ?? [],
    [currentTime, data?.classes],
  );

  useEffect(() => {
    const target = sectionRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
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
    const untilNextMinute = 60_000 - (Date.now() % 60_000);
    let interval: number | undefined;
    const firstTick = window.setTimeout(() => {
      setCurrentTime(new Date());
      interval = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    }, untilNextMinute);
    return () => {
      window.clearTimeout(firstTick);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  const book = (eventName: string) => {
    trackCTAClick(`Book Class — ${eventName}`);
    track("InitiateCheckout", { content_name: eventName });
  };

  return (
    <section ref={sectionRef} id="classes" className="py-10 md:py-28" style={{ background: "oklch(0.98 0.01 350)" }}>
      <div className="container">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-8" style={{ background: "#8B2252" }} />
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#8B2252" }}>Book a Class</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight" style={{ fontFamily: "'Fraunces', serif", color: "#1A0A12" }}>
              Upcoming <em className="not-italic" style={{ color: "#8B2252" }}>Classes</em>
            </h2>
            <p className="mt-3 max-w-2xl text-base md:text-lg" style={{ color: "#5a3040" }}>
              Browse and book upcoming puppy yoga sessions in Kitchener, Hamilton, and beyond. Admission prices are shown before HST. Optional mat rentals are separate from admission.
            </p>
          </div>
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => book("AfroPuppyYoga Full Calendar")}
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-105"
            style={{ background: "#8B2252", color: "#fff", boxShadow: "0 4px 20px rgba(233,30,140,0.3)" }}
          >
            <CalendarDays size={16} /> Open Full Calendar <ExternalLink size={14} />
          </a>
        </div>

        {!calendarActive ? (
          <div className="flex min-h-[330px] flex-col items-center justify-center rounded-2xl border px-6 text-center" style={{ borderColor: "rgba(194,24,91,0.15)", background: "#fff" }}>
            <CalendarDays size={34} style={{ color: "#8B2252" }} />
            <p className="mt-4 font-semibold" style={{ color: "#3D1A2E" }}>Live upcoming classes</p>
            <p className="mt-2 max-w-sm text-sm" style={{ color: "#956A7C" }}>The class list loads when you reach this section, so the rest of the site opens faster.</p>
            <button
              type="button"
              onClick={() => setRequestedByVisitor(true)}
              className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "#8B2252" }}
            >
              Show upcoming classes
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading upcoming classes">
            {[1, 2, 3].map(item => <div key={item} className="min-h-48 animate-pulse rounded-2xl bg-white" />)}
          </div>
        ) : visibleClasses.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleClasses.map(event => {
              const eventName = `${event.breed} puppy yoga in ${event.location}`;
              return (
                <article key={event.id} className="flex min-h-56 flex-col rounded-2xl border p-5 shadow-sm" style={{ borderColor: "rgba(194,24,91,0.15)", background: "#fff" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8B2252" }}>{formatDate(event.classDate)}</p>
                      <h3 className="mt-2 text-xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: "#1A0A12" }}>{event.breed} Puppy Yoga</h3>
                    </div>
                    <CalendarDays size={22} aria-hidden="true" style={{ color: "#D14D81" }} />
                  </div>
                  <div className="mt-4 space-y-1 text-sm" style={{ color: "#5a3040" }}>
                    <p className="flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" /> {event.location}</p>
                    <p>{formatTime(event.startTime)}–{formatTime(event.endTime)}</p>
                  </div>
                  <div className="mt-auto pt-5">
                    {event.admissionMinCents === null ? (
                      <p className="text-sm font-semibold" style={{ color: "#8B2252" }}>Current admission pricing is available on the booking page.</p>
                    ) : (
                      <p className="text-sm font-semibold" style={{ color: "#8B2252" }}>Admission from {formatAdmissionPrice(event.admissionMinCents)}</p>
                    )}
                    <p className="mt-1 text-xs" style={{ color: "#956A7C" }}>Mat rental is optional and priced separately at checkout.</p>
                    <a
                      href={appendAttributionToLumaUrl(event.lumaEventUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => book(eventName)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: "#8B2252" }}
                    >
                      Book this class <ExternalLink size={14} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "rgba(194,24,91,0.15)", background: "#fff" }}>
            <p className="font-semibold" style={{ color: "#3D1A2E" }}>{isError ? "The live class list is temporarily unavailable." : "New classes are being added soon."}</p>
            <a href={calendarUrl} target="_blank" rel="noopener noreferrer" onClick={() => book("AfroPuppyYoga Full Calendar")} className="mt-4 inline-flex text-sm font-semibold underline underline-offset-4" style={{ color: "#8B2252" }}>Open the full calendar</a>
          </div>
        )}

        <p className="mt-5 text-center text-sm" style={{ color: "#9e6070" }}>Secure checkout by Luma · HST is calculated at checkout</p>
      </div>
    </section>
  );
}
