import { useEffect } from "react";
import { BOOK_URL, LOGO_URL } from "@/const";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatbotWidget from "@/components/ChatbotWidget";
import ScrollToTop from "@/components/ScrollToTop";
import { MapPin, Clock, Users, Star, ChevronDown } from "lucide-react";
import { useState } from "react";

/* ============================================================
   LocationPage — Shared template for Kitchener, Hamilton, Oakville
   Each location passes a LocationConfig object to customise all copy.
   ============================================================ */

export interface LocationFAQ {
  question: string;
  answer: string;
}

export interface LocationConfig {
  /** URL slug, e.g. "kitchener" */
  slug: string;
  /** Display name, e.g. "Kitchener" */
  city: string;
  /** Full page title for <title> tag */
  pageTitle: string;
  /** Meta description (150–160 chars) */
  metaDescription: string;
  /** Hero headline — can include <br /> via JSX */
  heroHeadline: string;
  /** Hero sub-headline */
  heroSubline: string;
  /** Hero background image URL */
  heroBg: string;
  /** Studio / venue name */
  venueName: string;
  /** Venue address string */
  venueAddress: string;
  /** Venue neighbourhood / area descriptor */
  venueArea: string;
  /** Short paragraph about this location (2–3 sentences) */
  aboutParagraph: string;
  /** Typical schedule description, e.g. "Every Saturday at 10 AM & 12 PM" */
  scheduleDescription: string;
  /** Luma calendar filter tag — used in the iframe embed URL */
  lumaTag?: string;
  /** Whether this location is "coming soon" (disables booking CTA) */
  comingSoon?: boolean;
  /** FAQ items specific to this location */
  faqs: LocationFAQ[];
  /** Schema.org address for LocalBusiness */
  schemaAddress: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
  };
  /** Latitude for schema geo */
  lat: number;
  /** Longitude for schema geo */
  lng: number;
}

interface Props {
  config: LocationConfig;
}

function FAQItem({ faq }: { faq: LocationFAQ }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#3D1A2E]/20 last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-display font-semibold text-[#1A0A12] text-base group-hover:text-[#D4708A] transition-colors">
          {faq.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-[#D4708A] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="font-body text-[#3D1A2E]/80 text-sm leading-relaxed pb-5">
          {faq.answer}
        </p>
      )}
    </div>
  );
}

export default function LocationPage({ config }: Props) {
  const canonicalUrl = `https://afropuppyyoga.ca/${config.slug}`;

  useSeoMeta({
    title: config.pageTitle,
    description: config.metaDescription,
    canonical: canonicalUrl,
    ogTitle: config.pageTitle,
    ogDescription: config.metaDescription,
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og_image_apy.jpg",
  });

  // Inject LocalBusiness schema for this location
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": canonicalUrl,
      name: `AfroPuppyYoga — ${config.city}`,
      description: config.metaDescription,
      url: canonicalUrl,
      telephone: "",
      email: "afropuppyyogaofficial@gmail.com",
      image: LOGO_URL,
      logo: { "@type": "ImageObject", url: LOGO_URL },
      address: {
        "@type": "PostalAddress",
        streetAddress: config.schemaAddress.streetAddress,
        addressLocality: config.schemaAddress.addressLocality,
        addressRegion: config.schemaAddress.addressRegion,
        postalCode: config.schemaAddress.postalCode,
        addressCountry: "CA",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: config.lat,
        longitude: config.lng,
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Saturday", "Sunday"],
          opens: "10:00",
          closes: "18:00",
        },
      ],
      priceRange: "$35–$45",
      currenciesAccepted: "CAD",
      paymentAccepted: "Credit Card, Debit Card",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5",
        bestRating: "5",
        worstRating: "1",
        ratingCount: "50",
      },
      sameAs: [
        "https://www.instagram.com/afropuppyyoga",
        "https://lu.ma/afropuppyyoga",
      ],
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = `schema-location-${config.slug}`;
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById(`schema-location-${config.slug}`);
      if (el) el.remove();
    };
  }, [config.slug, canonicalUrl, config.metaDescription, config.city, config.schemaAddress, config.lat, config.lng]);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-[70vh] flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: `url(${config.heroBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0A12]/60 via-[#1A0A12]/40 to-[#1A0A12]/70" />
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto pt-24 pb-16">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-[#F2A0B8]/20 border border-[#F2A0B8]/40 rounded-full px-4 py-1.5 mb-6">
            <MapPin className="w-3.5 h-3.5 text-[#F2A0B8]" />
            <span className="font-body text-xs text-[#F2A0B8] tracking-widest uppercase">
              {config.city}, Ontario
            </span>
          </div>
          <h1 className="font-display font-black text-white text-5xl md:text-6xl leading-tight mb-4"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
            {config.heroHeadline}
          </h1>
          <p className="font-body text-white/80 text-lg md:text-xl leading-relaxed mb-8 max-w-xl mx-auto">
            {config.heroSubline}
          </p>
          {config.comingSoon ? (
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/30 rounded-full px-6 py-3">
              <span className="font-body font-semibold text-white text-sm">🐾 Coming Soon to {config.city}</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#D4708A] transition-all duration-200 active:scale-[0.97]"
              >
                Book a Class in {config.city}
              </a>
              <a
                href="/private-events/quote"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-white/10 border border-white/40 text-white font-body font-semibold text-sm rounded-full hover:bg-white/20 transition-all duration-200"
              >
                Private Events
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Quick Facts Strip ─────────────────────────────────────────── */}
      <section className="bg-[#3D1A2E] py-6">
        <div className="container">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            <div className="flex items-center gap-2.5 text-white/80">
              <MapPin className="w-4 h-4 text-[#F2A0B8]" />
              <span className="font-body text-sm">{config.venueName}</span>
            </div>
            <div className="flex items-center gap-2.5 text-white/80">
              <Clock className="w-4 h-4 text-[#F2A0B8]" />
              <span className="font-body text-sm">{config.scheduleDescription}</span>
            </div>
            <div className="flex items-center gap-2.5 text-white/80">
              <Users className="w-4 h-4 text-[#F2A0B8]" />
              <span className="font-body text-sm">Small groups · Max 20 guests</span>
            </div>
            <div className="flex items-center gap-2.5 text-white/80">
              <Star className="w-4 h-4 text-[#F2A0B8]" />
              <span className="font-body text-sm">5.0 ★ · Ontario's #1 Puppy Yoga</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── About This Location ───────────────────────────────────────── */}
      <section className="py-20 bg-[#FEFAF4]">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-body text-xs text-[#D4708A] tracking-widest uppercase mb-3">About This Location</p>
              <h2 className="font-display font-black text-[#1A0A12] text-4xl leading-tight mb-6">
                Puppy Yoga in {config.city}
              </h2>
              <p className="font-body text-[#3D1A2E]/80 text-base leading-relaxed mb-6">
                {config.aboutParagraph}
              </p>
              <div className="bg-[#F9F0F4] rounded-2xl p-5 border border-[#F2A0B8]/30">
                <div className="font-body text-xs text-[#D4708A] uppercase tracking-widest mb-2">Venue</div>
                <div className="font-display font-bold text-[#1A0A12] text-base mb-1">{config.venueName}</div>
                <div className="font-body text-sm text-[#3D1A2E]/70">{config.venueAddress}</div>
                <div className="font-body text-xs text-[#3D1A2E]/50 mt-1">{config.venueArea}</div>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { icon: "🧘", title: "Guided Yoga Session", desc: "60-minute beginner-friendly flow led by a certified instructor to Afrobeats music." },
                { icon: "🐶", title: "Puppy Playtime", desc: "Ethically sourced puppies from local breeders join you on the mat for cuddles and play." },
                { icon: "📸", title: "Photo Moments", desc: "Group photo at the end — the perfect content for your feed." },
                { icon: "🎶", title: "Afrobeats Soundtrack", desc: "Every session is set to an Afrobeats playlist that makes the energy unlike any other yoga class." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 p-4 bg-white rounded-xl border border-[#F2A0B8]/20 shadow-sm">
                  <div className="text-2xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <div className="font-display font-bold text-[#1A0A12] text-sm mb-0.5">{item.title}</div>
                    <div className="font-body text-xs text-[#3D1A2E]/70 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Schedule / Luma Embed ─────────────────────────────────────── */}
      {!config.comingSoon && (
        <section className="py-20 bg-[#F9F0F4]">
          <div className="container max-w-4xl text-center">
            <p className="font-body text-xs text-[#D4708A] tracking-widest uppercase mb-3">Upcoming Classes</p>
            <h2 className="font-display font-black text-[#1A0A12] text-4xl mb-4">
              Book Your Spot in {config.city}
            </h2>
            <p className="font-body text-[#3D1A2E]/70 text-base mb-10 max-w-xl mx-auto">
              Sessions fill up fast — reserve your mat today. All skill levels welcome.
            </p>
            <div className="rounded-2xl overflow-hidden shadow-lg border border-[#F2A0B8]/20 bg-white">
              <iframe
                src={`https://lu.ma/embed/calendar/evt-afropuppyyoga?lt=light${config.lumaTag ? `&tag=${encodeURIComponent(config.lumaTag)}` : ""}`}
                width="100%"
                height="500"
                frameBorder="0"
                style={{ border: "none" }}
                allowFullScreen
                aria-hidden="false"
                title={`AfroPuppyYoga ${config.city} class schedule`}
              />
            </div>
            <div className="mt-8">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#D4708A] text-white font-body font-bold text-sm rounded-full hover:bg-[#B85A72] transition-all duration-200 active:scale-[0.97]"
              >
                View All {config.city} Classes →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Coming Soon section for Oakville */}
      {config.comingSoon && (
        <section className="py-20 bg-[#F9F0F4]">
          <div className="container max-w-2xl text-center">
            <div className="text-5xl mb-6">🐾</div>
            <h2 className="font-display font-black text-[#1A0A12] text-4xl mb-4">
              {config.city} Is Coming Soon
            </h2>
            <p className="font-body text-[#3D1A2E]/70 text-base leading-relaxed mb-8">
              We're expanding to {config.city}! Be the first to know when sessions launch — follow us on Instagram or check back soon.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://www.instagram.com/afropuppyyoga"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-[#D4708A] text-white font-body font-bold text-sm rounded-full hover:bg-[#B85A72] transition-all"
              >
                Follow on Instagram
              </a>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-[#D4708A] text-[#D4708A] font-body font-bold text-sm rounded-full hover:bg-[#D4708A] hover:text-white transition-all"
              >
                Book in KW or Hamilton
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#FEFAF4]">
        <div className="container max-w-2xl">
          <p className="font-body text-xs text-[#D4708A] tracking-widest uppercase mb-3 text-center">Questions</p>
          <h2 className="font-display font-black text-[#1A0A12] text-4xl text-center mb-10">
            FAQs — {config.city}
          </h2>
          <div className="bg-white rounded-2xl border border-[#F2A0B8]/20 shadow-sm px-6 py-2">
            {config.faqs.map((faq) => (
              <FAQItem key={faq.question} faq={faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#3D1A2E] text-center">
        <div className="container max-w-2xl">
          <div className="text-4xl mb-4">🐶</div>
          <h2 className="font-display font-black text-white text-4xl mb-4">
            Ready to Join Us in {config.city}?
          </h2>
          <p className="font-body text-white/70 text-base leading-relaxed mb-8">
            Spots are limited and sessions sell out. Book your mat now and experience Ontario's #1 puppy yoga studio.
          </p>
          {config.comingSoon ? (
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#D4708A] transition-all active:scale-[0.97]"
            >
              Book in KW or Hamilton While You Wait
            </a>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#D4708A] transition-all active:scale-[0.97]"
              >
                Book a Class in {config.city}
              </a>
              <a
                href="/private-events/quote"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/10 border border-white/30 text-white font-body font-semibold text-sm rounded-full hover:bg-white/20 transition-all"
              >
                Plan a Private Event
              </a>
            </div>
          )}
          {/* Internal links to other locations */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="font-body text-xs text-white/40 uppercase tracking-widest mb-4">Also Available In</p>
            <div className="flex justify-center gap-6">
              {config.slug !== "kitchener" && (
                <a href="/kitchener" className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors">
                  Kitchener →
                </a>
              )}
              {config.slug !== "hamilton" && (
                <a href="/hamilton" className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors">
                  Hamilton →
                </a>
              )}
              {config.slug !== "oakville" && (
                <a href="/oakville" className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors">
                  Oakville →
                </a>
              )}
              {config.slug !== "puppy-yoga-waterloo" && (
                <a href="/puppy-yoga-waterloo" className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors">
                  Waterloo →
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <ScrollToTop />
      <ChatbotWidget />
    </div>
  );
}
