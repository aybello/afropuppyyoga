import { useEffect, useState } from "react";
import { BOOK_URL, LOGO_URL } from "@/const";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatbotWidget from "@/components/ChatbotWidget";
import ScrollToTop from "@/components/ScrollToTop";
import { MapPin, Clock, Users, Star, ChevronDown, Quote, Check } from "lucide-react";
import { motion } from "framer-motion";

/* ============================================================
   LocationPage — Shared template for all city SEO pages.
   Plan-required sections (Sprint 2):
   1. SEO title + meta
   2. Hero
   3. "Why try puppy yoga in [city]?"
   4. Upcoming classes CTA (Luma embed)
   5. Private events CTA
   6. Reviews / testimonials
   7. FAQ
   8. Luma booking CTA
   9. Internal links to other city pages
   ============================================================ */

export interface LocationFAQ {
  question: string;
  answer: string;
}

export interface LocationWhyReason {
  icon: string;
  title: string;
  desc: string;
}

export interface LocationReview {
  name: string;
  avatar: string;
  text: string;
  date: string;
}

export interface LocationConfig {
  /** URL slug, e.g. "puppy-yoga-kitchener" */
  slug: string;
  /** Display name, e.g. "Kitchener" */
  city: string;
  /** Full page title for <title> tag */
  pageTitle: string;
  /** Meta description (150–160 chars) */
  metaDescription: string;
  /** Hero headline */
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
  /** Typical schedule description */
  scheduleDescription: string;
  /** "Why try puppy yoga in [city]?" reasons — 3–4 items */
  whyReasons: LocationWhyReason[];
  /** City-specific reviews — 3 items */
  reviews: LocationReview[];
  /** Luma calendar filter tag */
  lumaTag?: string;
  /** Whether this location is "coming soon" */
  comingSoon?: boolean;
  /** City-specific real photos — up to 4 items. Each has src and alt. */
  photos?: { src: string; alt: string }[];
  /** FAQ items specific to this location */
  faqs: LocationFAQ[];
  /** Schema.org address for LocalBusiness */
  schemaAddress: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
  };
  lat: number;
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

const avatarColors = [
  "bg-[#8B2252]",
  "bg-[#D4708A]",
  "bg-[#8B2252]",
];

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

  // Inject LocalBusiness schema
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
        ratingValue: "4.9",
        bestRating: "5",
        worstRating: "1",
        ratingCount: "494",
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

      {/* ── 1. Hero ──────────────────────────────────────────────────── */}
      <section
        className="relative min-h-[75vh] flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: `url(${config.heroBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0A12]/65 via-[#1A0A12]/45 to-[#1A0A12]/75" />
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto pt-28 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-[#F2A0B8]/20 border border-[#F2A0B8]/40 rounded-full px-4 py-1.5 mb-6">
              <MapPin className="w-3.5 h-3.5 text-[#F2A0B8]" />
              <span className="font-body text-xs text-[#F2A0B8] tracking-widest uppercase">
                {config.city}, Ontario
              </span>
            </div>
            <h1
              className="font-display font-black text-white text-5xl md:text-6xl leading-tight mb-4"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
            >
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
                  className="inline-flex items-center justify-center px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#F2A0B8]/90 transition-all duration-200 active:scale-[0.97]"
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
            <p className="font-body text-white/50 text-xs mt-5">
              Trusted by universities, brands, and wellness communities across Ontario.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Facts Strip */}
      <section className="bg-[#8B2252] py-5">
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
              <span className="font-body text-sm">4.9 ★ · 494+ reviews</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. About This Location ───────────────────────────────────── */}
      <section className="py-20 bg-[#FFF5F8]">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-body text-xs text-[#8B2252] tracking-widest uppercase mb-3">About This Location</p>
              <h2 className="font-display font-black text-[#1A0A12] text-4xl leading-tight mb-6">
                Puppy Yoga in {config.city}
              </h2>
              <p className="font-body text-[#3D1A2E]/80 text-base leading-relaxed mb-6">
                {config.aboutParagraph}
              </p>
              <div className="bg-white rounded-2xl p-5 border border-[#F2A0B8]/30 shadow-sm">
                <div className="font-body text-xs text-[#D4708A] uppercase tracking-widest mb-2">Venue</div>
                <div className="font-display font-bold text-[#1A0A12] text-base mb-1">{config.venueName}</div>
                <div className="font-body text-sm text-[#3D1A2E]/70">{config.venueAddress}</div>
                <div className="font-body text-xs text-[#3D1A2E]/50 mt-1">{config.venueArea}</div>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { icon: "🧘", title: "40-Min Guided Yoga", desc: "Beginner-friendly flow led by a certified instructor to a live Afrobeats soundtrack." },
                { icon: "🐶", title: "20-Min Puppy Play", desc: "Free-roam puppy playtime — cuddle, pet, and take photos with the adorable pups after class." },
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

      {/* ── 3. Why Try Puppy Yoga in [City]? ────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <p className="font-body text-xs text-[#8B2252] tracking-widest uppercase mb-3">Why {config.city}?</p>
            <h2 className="font-display font-black text-[#1A0A12] text-4xl md:text-5xl leading-tight">
              Why Try Puppy Yoga<br />
              <span className="italic text-[#8B2252]">in {config.city}?</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6">
            {config.whyReasons.map((reason, i) => (
              <motion.div
                key={reason.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-white rounded-2xl p-6 border border-[#F0D0DC] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-3xl mb-3">{reason.icon}</div>
                <h3 className="font-display font-bold text-[#1A0A12] text-lg mb-2">{reason.title}</h3>
                <p className="font-body text-[#3D1A2E]/70 text-sm leading-relaxed">{reason.desc}</p>
              </motion.div>
            ))}
          </div>
          {/* What's included checklist */}
          <div className="mt-10 bg-[#FFF5F8] rounded-2xl p-8 border border-[#F2A0B8]/30">
            <h3 className="font-display font-bold text-[#1A0A12] text-xl mb-5">What's Included in Every Session</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "40 minutes of guided yoga with puppies",
                "20 minutes of dedicated puppy playtime",
                "Complimentary refreshments",
                "Afrobeats music & vibrant atmosphere",
                "Group photo at the end",
                "All skill levels welcome (beginners encouraged)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#8B2252] flex-shrink-0" />
                  <span className="font-body text-sm text-[#3D1A2E]/80">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3b. Real Photo Gallery (city-specific) — 3×3 grid ─────── */}
      {config.photos && config.photos.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container max-w-5xl">
            <div className="flex items-center justify-center gap-3 mb-10">
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">From Our Classes</span>
              <div className="w-8 h-0.5 bg-[#8B2252]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {config.photos.map((photo, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.97 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="relative overflow-hidden rounded-2xl shadow-sm aspect-[3/4]"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Upcoming Classes CTA (Luma embed) ────────────────────── */}
      {!config.comingSoon && (
        <section className="py-20 bg-[#FFF5F8]">
          <div className="container max-w-4xl text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">Upcoming Classes</span>
              <div className="w-8 h-0.5 bg-[#8B2252]" />
            </div>
            <h2 className="font-display font-black text-[#1A0A12] text-4xl mb-4">
              Book Your Spot in {config.city}
            </h2>
            <p className="font-body text-[#3D1A2E]/70 text-base mb-10 max-w-xl mx-auto">
              Sessions fill up fast — reserve your mat today. All skill levels welcome.
            </p>
            <div className="rounded-2xl overflow-hidden shadow-lg border border-[#F2A0B8]/30 bg-white relative">
              {/* Fallback shown while iframe loads */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#FFF5F8] pointer-events-none z-0">
                <div className="text-3xl">🐾</div>
                <p className="font-body text-sm text-[#3D1A2E]/60">Loading upcoming classes…</p>
              </div>
              <iframe
                src={`https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events?theme=light&lt=light${config.lumaTag ? `&tag=${encodeURIComponent(config.lumaTag)}` : ""}`}
                width="100%"
                height="500"
                frameBorder="0"
                style={{ border: "none", position: "relative", zIndex: 1 }}
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
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#F2A0B8]/90 transition-all duration-200 active:scale-[0.97]"
              >
                View All {config.city} Classes →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Coming Soon block */}
      {config.comingSoon && (
        <section className="py-20 bg-[#FFF5F8]">
          <div className="container max-w-2xl text-center">
            <div className="text-5xl mb-6">🐾</div>
            <h2 className="font-display font-black text-[#1A0A12] text-4xl mb-4">
              {config.city} Is Coming Soon
            </h2>
            <p className="font-body text-[#3D1A2E]/70 text-base leading-relaxed mb-8">
              We're expanding to {config.city}! Be the first to know when sessions launch — follow us on Instagram or book at our existing locations now.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://www.instagram.com/afropuppyyoga"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-[#8B2252] text-white font-body font-bold text-sm rounded-full hover:bg-[#6B1A3F] transition-all"
              >
                Follow on Instagram
              </a>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-[#8B2252] text-[#8B2252] font-body font-bold text-sm rounded-full hover:bg-[#8B2252] hover:text-white transition-all"
              >
                Book in KW or Hamilton
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── 5. Private Events CTA ────────────────────────────────────── */}
      <section className="py-20 bg-white border-y border-[#F2A0B8]/20">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-0.5 bg-[#8B2252]" />
                <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">Private Events</span>
              </div>
              <h2 className="font-display font-black text-[#1A0A12] text-4xl leading-tight mb-4">
                Host a Private Event<br />
                <span className="italic text-[#8B2252]">in {config.city}</span>
              </h2>
              <p className="font-body text-[#3D1A2E]/70 text-base leading-relaxed mb-6">
                Birthdays, bachelorettes, corporate wellness days, team-building events — AfroPuppyYoga brings the puppies, the yoga, and the Afrobeats to your private event. Groups from 6 to 50+ welcome.
              </p>
              <ul className="space-y-2 mb-8">
                {["Birthday parties & bachelorettes", "Corporate wellness & team-building", "Student group events & brand activations", "Custom packages starting at $1,200"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#F2A0B8] flex-shrink-0" />
                    <span className="font-body text-sm text-[#3D1A2E]/70">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/private-events/quote"
                  className="inline-flex items-center justify-center px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#F2A0B8]/90 transition-all active:scale-[0.97] whitespace-nowrap"
                >
                  Get a Private Event Quote
                </a>
                <a
                  href="/corporate-puppy-yoga"
                  className="inline-flex items-center justify-center px-8 py-3.5 bg-transparent border border-[#8B2252] text-[#8B2252] font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] hover:text-white transition-all whitespace-nowrap"
                >
                  Corporate Events →
                </a>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { icon: "🎂", label: "Birthday Packages", desc: "Make it unforgettable with puppies, yoga, and your crew." },
                { icon: "💼", label: "Corporate Wellness", desc: "Employee appreciation, team-building, and stress relief in one session." },
                { icon: "🥂", label: "Bachelorette & Celebrations", desc: "The most unique bachelorette activity in Ontario." },
                { icon: "🎓", label: "Student Group Events", desc: "Perfect for clubs, orientation events, and stress-relief sessions." },
              ].map((item) => (
                <div key={item.label} className="flex gap-4 p-4 bg-white rounded-xl border border-[#F2A0B8]/30 shadow-sm">
                  <div className="text-2xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <div className="font-display font-bold text-[#1A0A12] text-sm mb-0.5">{item.label}</div>
                    <div className="font-body text-xs text-[#3D1A2E]/60 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Reviews / Testimonials ───────────────────────────────── */}
      <section className="py-20 bg-[#FFF5F8] border-t border-[#F2A0B8]/20">
        <div className="container max-w-4xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#8B2252]" />
                <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">Reviews</span>
              </div>
              <h2 className="font-display text-4xl font-bold text-[#1A0A12]">
                See What Our<br />
                <span className="italic text-[#8B2252]">Clients Say</span>
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="font-display font-bold text-4xl text-[#1A0A12]">4.9</div>
                <div className="flex gap-0.5 justify-center my-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-[#F2A0B8] text-[#F2A0B8]" />
                  ))}
                </div>
                <div className="font-body text-xs text-[#1A0A12]/50">494+ verified reviews</div>
              </div>
              <a
                href="https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsdiY1GsfLo"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 border-2 border-[#8B2252] text-[#8B2252] font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] hover:text-white transition-all duration-200"
              >
                Leave a Review
              </a>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {config.reviews.map((review, i) => (
              <motion.div
                key={review.name}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-[#F0D0DC] hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white font-body font-bold text-sm`}>
                      {review.avatar}
                    </div>
                    <div>
                      <div className="font-display font-bold text-sm text-[#1A0A12]">{review.name}</div>
                      <div className="font-body text-xs text-[#1A0A12]/40">{review.date}</div>
                    </div>
                  </div>
                  <Quote size={20} className="text-[#F2A0B8]/40 shrink-0" />
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={13} className="fill-[#F2A0B8] text-[#F2A0B8]" />
                  ))}
                </div>
                <p className="font-body text-[#1A0A12]/70 text-sm leading-relaxed">{review.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container max-w-2xl">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-0.5 bg-[#8B2252]" />
            <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">Questions</span>
            <div className="w-8 h-0.5 bg-[#8B2252]" />
          </div>
          <h2 className="font-display font-black text-[#1A0A12] text-4xl text-center mb-10">
            FAQs — {config.city}
          </h2>
          <div className="bg-[#FFF5F8] rounded-2xl border border-[#F2A0B8]/30 shadow-sm px-6 py-2">
            {config.faqs.map((faq) => (
              <FAQItem key={faq.question} faq={faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Final Luma Booking CTA ────────────────────────────────── */}
      <section className="py-20 bg-[#1A0A12] text-center">
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
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#F2A0B8]/90 transition-all active:scale-[0.97]"
            >
              Book in KW or Hamilton While You Wait
            </a>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#F2A0B8]/90 transition-all active:scale-[0.97]"
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

          {/* ── 9. Internal links to other city pages ────────────────── */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="font-body text-xs text-white/40 uppercase tracking-widest mb-4">Also Available In</p>
            <div className="flex flex-wrap justify-center gap-6">
              {config.slug !== "puppy-yoga-kitchener" && (
                <a href="/puppy-yoga-kitchener" className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors">
                  Kitchener →
                </a>
              )}
              {config.slug !== "puppy-yoga-hamilton" && (
                <a href="/puppy-yoga-hamilton" className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors">
                  Hamilton →
                </a>
              )}
              {config.slug !== "puppy-yoga-oakville" && (
                <a href="/puppy-yoga-oakville" className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors">
                  Oakville →
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
