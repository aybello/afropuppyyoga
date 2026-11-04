import { useEffect, useMemo, useState } from "react";
import { BOOK_URL, LOGO_URL } from "@/const";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatbotWidget from "@/components/ChatbotWidget";
import ScrollToTop from "@/components/ScrollToTop";
import { MapPin, Clock, Users, Star, ChevronDown, Quote, Check, ArrowRight } from "lucide-react";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { appendAttributionToLumaUrl } from "@/lib/lumaAttribution";
import { FIVE_STAR_REVIEW_COUNT, REVIEW_METRICS } from "../../../shared/reviewMetrics";

/* Shared city template: presentation changes only. Location configuration,
   schema, booking attribution, calendar filters and checkout events stay intact. */

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
  /** Some cities use more than one event venue. */
  venues?: { name: string; address: string }[];
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
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center justify-between min-h-14 py-5 text-left gap-4 group rounded-md"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-display font-medium text-espresso text-lg group-hover:text-brand-link transition-colors motion-reduce:transition-none">
          {faq.question}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`w-5 h-5 text-brand-link flex-shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="font-body text-muted-foreground text-base leading-relaxed pb-5">
          {faq.answer}
        </p>
      )}
    </div>
  );
}

export default function LocationPage({ config }: Props) {
  const canonicalUrl = `https://afropuppyyoga.ca/${config.slug}`;
  const seoDescription = `AfroPuppyYoga: ${FIVE_STAR_REVIEW_COUNT} five-star reviews. ${config.metaDescription}`;
  const { track } = useMetaPixel();
  const attributedBookUrl = useMemo(() => appendAttributionToLumaUrl(BOOK_URL), []);
  const attributedEmbedUrl = useMemo(
    () => appendAttributionToLumaUrl(`https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events?theme=light&lt=light${config.lumaTag ? `&tag=${encodeURIComponent(config.lumaTag)}` : ""}`),
    [config.lumaTag],
  );
  // The third existing city photo is a people-and-puppies portrait for the
  // current city configs. Waterloo naturally falls back to its real heroBg.
  const heroPhoto = config.photos?.[2] ?? config.photos?.[0];
  const heroSrc = heroPhoto?.src || config.heroBg;
  const headlineCityIndex = config.heroHeadline.lastIndexOf(config.city);

  useSeoMeta({
    title: config.pageTitle,
    description: seoDescription,
    canonical: canonicalUrl,
    ogTitle: config.pageTitle,
    ogDescription: seoDescription,
    ogImage: "https://afropuppyyoga.ca/manus-storage/apy_corporate_hero_202ea280.jpg",
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
      email: "afropuppyyoga@gmail.com",
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
    <div className="apy-page">
      <Navbar />

      {/* 1. Editorial hero — real source image, not a dark overlay. */}
      <section className="bg-ivory pt-24 md:pt-28 pb-10 md:pb-12">
        <div className="container max-w-6xl">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-16 items-center">
            <div className="min-w-0 py-2 lg:py-8">
              <nav aria-label="Breadcrumb" className="font-body text-sm mb-7">
                <ol className="flex flex-wrap items-center gap-2">
                  <li><a href="/" className="apy-link rounded-sm">Home</a></li>
                  <li aria-hidden="true" className="text-muted-foreground">/</li>
                  <li aria-current="page" className="text-muted-foreground">{config.city}</li>
                </ol>
              </nav>
              <p className="flex items-center gap-2 font-body text-brand-link text-sm tracking-[0.14em] uppercase mb-4">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                {config.city}, Ontario
              </p>
              <h1 className="font-display font-normal text-espresso text-[clamp(2.75rem,5.4vw,4.75rem)] tracking-[-0.04em] leading-[1.08] mb-6 [text-wrap:pretty]">
                {headlineCityIndex >= 0 ? (
                  <>
                    {config.heroHeadline.slice(0, headlineCityIndex)}
                    <span className="block italic text-brand-link">{config.city}</span>
                    {config.heroHeadline.slice(headlineCityIndex + config.city.length)}
                  </>
                ) : config.heroHeadline}
              </h1>
              <p className="font-body text-muted-foreground text-base sm:text-lg leading-relaxed mb-7 max-w-xl">
                {config.heroSubline}
              </p>
              {config.comingSoon ? (
                <div className="inline-flex items-center gap-2 bg-blush border border-border rounded-full px-6 py-3">
                  <span className="font-body font-semibold text-espresso text-sm">🐾 Coming Soon to {config.city}</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                  <a
                    href={attributedBookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track("InitiateCheckout", { content_name: `Book Class — ${config.city}` })}
                    aria-label={`Book a Class in ${config.city} — view upcoming classes`}
                    className="apy-primary-action min-h-12 px-7"
                  >
                    View Upcoming Classes
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </a>
                  <a href="/private-events/quote" className="inline-flex items-center justify-center min-h-12 px-6 py-3 border border-border text-espresso font-body font-medium text-sm rounded-full hover:bg-blush transition-colors motion-reduce:transition-none">
                    Private Events
                  </a>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-6">
                <div className="flex gap-1 text-brand-link" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} className="w-4 h-4 fill-primary" />)}
                </div>
                <p className="font-body text-sm text-espresso">{FIVE_STAR_REVIEW_COUNT} five-star reviews</p>
              </div>
              <p className="font-body text-muted-foreground text-sm leading-relaxed mt-4 max-w-lg">
                Trusted by universities, brands, and wellness communities across Ontario.
              </p>
            </div>
            <figure className="w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-0 bg-blush rounded-[50%_50%_1rem_1rem/22%_22%_1rem_1rem] overflow-hidden">
              <img
                src={heroSrc}
                alt={heroPhoto?.alt ?? "Guests and puppies at an AfroPuppyYoga class"}
                className="block w-full h-auto"
                fetchPriority="high"
                decoding="async"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* Quick facts: venue and real schedule, without invented availability. */}
      <section className="bg-blush border-y border-primary/20 py-6">
        <div className="container max-w-6xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-[1.2fr_1.1fr_0.8fr] gap-6 lg:gap-8">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-brand-link shrink-0 mt-1" aria-hidden="true" />
              <div className="font-body text-sm leading-relaxed">
                <p className="font-semibold text-espresso">{config.venueName}</p>
                <p className="text-muted-foreground">{config.venueAddress}</p>
                {config.venues && <p className="mt-2 font-medium text-brand-link">Check your selected event's venue before booking.</p>}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-brand-link shrink-0 mt-1" aria-hidden="true" />
              <span className="font-body text-sm text-espresso leading-relaxed">{config.scheduleDescription}</span>
            </div>
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-brand-link shrink-0 mt-1" aria-hidden="true" />
              <span className="font-body text-sm text-espresso leading-relaxed">Small groups · Max 20 guests</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. About this location */}
      <section className="apy-section bg-ivory">
        <div className="container max-w-5xl">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div>
              <p className="apy-eyebrow mb-3">About This Location</p>
              <h2 className="apy-heading mb-6">Puppy Yoga in {config.city}</h2>
              <p className="font-body text-muted-foreground text-base leading-relaxed mb-6">{config.aboutParagraph}</p>
              <div className="bg-blush rounded-2xl p-5 border border-border">
                <div className="font-body text-xs text-brand-link uppercase tracking-widest mb-2">{config.venues ? "Event Venues" : "Venue"}</div>
                {config.venues ? (
                  <div className="divide-y divide-primary/20">
                    {config.venues.map((venue) => (
                      <div key={venue.name} className="py-3 first:pt-0 last:pb-0">
                        <div className="font-display font-medium text-espresso text-xl mb-1">{venue.name}</div>
                        <address className="font-body text-sm text-muted-foreground not-italic">{venue.address}</address>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="font-display font-medium text-espresso text-xl mb-1">{config.venueName}</div>
                    <div className="font-body text-sm text-muted-foreground">{config.venueAddress}</div>
                  </>
                )}
                <div className="font-body text-sm text-muted-foreground mt-1">{config.venueArea}</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {[
                { icon: "🧘", title: "40-Min Guided Yoga", desc: "Beginner-friendly flow led by a certified instructor to a live Afrobeats soundtrack." },
                { icon: "🐶", title: "20-Min Puppy Play", desc: "Free-roam puppy playtime — cuddle, pet, and take photos with the adorable pups after class." },
                { icon: "📸", title: "Photo Moments", desc: "Group photo at the end — the perfect content for your feed." },
                { icon: "🎶", title: "Afrobeats Soundtrack", desc: "Every session is set to an Afrobeats playlist that makes the energy unlike any other yoga class." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                  <div className="text-2xl flex-shrink-0" aria-hidden="true">{item.icon}</div>
                  <div>
                    <div className="font-display font-medium text-espresso text-xl mb-2">{item.title}</div>
                    <div className="font-body text-base text-muted-foreground leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Why try puppy yoga? */}
      <section className="apy-section bg-white border-y border-border">
        <div className="container max-w-5xl">
          <div className="mb-10 max-w-2xl">
            <p className="apy-eyebrow mb-3">Why {config.city}?</p>
            <h2 className="apy-heading">Why Try Puppy Yoga<br /><span className="italic text-brand-link">in {config.city}?</span></h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {config.whyReasons.map((reason) => (
              <div key={reason.title} className="border-t border-border pt-6">
                <div className="text-2xl mb-3" aria-hidden="true">{reason.icon}</div>
                <h3 className="font-display font-medium text-espresso text-2xl mb-3">{reason.title}</h3>
                <p className="font-body text-muted-foreground text-base leading-relaxed">{reason.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 bg-blush rounded-2xl p-6 sm:p-8 border border-border">
            <h3 className="font-display font-medium text-espresso text-2xl mb-5">What's Included in Every Session</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "40 minutes of guided yoga with puppies",
                "20 minutes of dedicated puppy playtime",
                "Complimentary refreshments",
                "Afrobeats music & vibrant atmosphere",
                "Group photo at the end",
                "All skill levels welcome (beginners encouraged)",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-brand-link flex-shrink-0 mt-1" aria-hidden="true" />
                  <span className="font-body text-sm text-espresso leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3b. All existing city gallery photos, at natural proportions. */}
      {config.photos && config.photos.length > 0 && (
        <section className="apy-section bg-ivory">
          <div className="container max-w-6xl">
            <h2 className="font-display text-3xl sm:text-4xl font-normal text-espresso mb-8">From Our Classes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
              {config.photos.map((photo, i) => (
                <figure key={i} className="rounded-2xl overflow-hidden bg-blush border border-border">
                  <img src={photo.src} alt={photo.alt} className="block w-full h-auto" loading="lazy" decoding="async" />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. The original live Luma embed, including city tag and attribution. */}
      {!config.comingSoon && (
        <section className="apy-section bg-blush border-y border-border">
          <div className="container max-w-5xl">
            <div className="max-w-2xl mb-8">
              <p className="apy-eyebrow mb-3">Upcoming Classes</p>
              <h2 className="apy-heading mb-4">Book Your Spot in {config.city}</h2>
              <p className="font-body text-muted-foreground text-base leading-relaxed">Sessions fill up fast — reserve your mat today. All skill levels welcome.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-border bg-white">
              <div className="font-body text-sm font-semibold text-espresso px-5 py-4 border-b border-border">Live Luma calendar</div>
              <div className="relative">
                {/* Keep the existing loading fallback and Luma-owned empty/error states. */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ivory pointer-events-none z-0">
                  <p className="font-body text-sm text-muted-foreground">Loading upcoming classes…</p>
                </div>
                <iframe
                  src={attributedEmbedUrl}
                  width="100%"
                  height="500"
                  frameBorder="0"
                  style={{ border: "none", position: "relative", zIndex: 1, display: "block" }}
                  allowFullScreen
                  aria-hidden="false"
                  title={`AfroPuppyYoga ${config.city} class schedule`}
                />
              </div>
            </div>
            <div className="mt-6">
              <a
                href={attributedBookUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("InitiateCheckout", { content_name: `View Classes — ${config.city}` })}
                className="apy-primary-action min-h-12 w-full sm:w-auto"
              >View All {config.city} Classes →</a>
            </div>
          </div>
        </section>
      )}

      {config.comingSoon && (
        <section className="apy-section bg-blush">
          <div className="container max-w-2xl text-center">
            <div className="text-5xl mb-6" aria-hidden="true">🐾</div>
            <h2 className="apy-heading mb-4">{config.city} Is Coming Soon</h2>
            <p className="font-body text-muted-foreground text-base leading-relaxed mb-8">We're expanding to {config.city}! Be the first to know when sessions launch — follow us on Instagram or book at our existing locations now.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="https://www.instagram.com/afropuppyyoga" target="_blank" rel="noopener noreferrer" className="apy-primary-action min-h-12">Follow on Instagram</a>
              <a href={attributedBookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-12 px-6 py-3 border border-border text-espresso font-body font-medium text-sm rounded-full hover:bg-ivory transition-colors motion-reduce:transition-none">Book in KW or Hamilton</a>
            </div>
          </div>
        </section>
      )}

      {/* 5. Private events — original packages, prices and enquiry links. */}
      <section className="apy-section bg-ivory border-b border-border">
        <div className="container max-w-5xl">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div>
              <p className="apy-eyebrow mb-3">Private Events</p>
              <h2 className="apy-heading mb-5">Host a Private Event<br /><span className="italic text-brand-link">in {config.city}</span></h2>
              <p className="font-body text-muted-foreground text-base leading-relaxed mb-6">Birthdays, bachelorettes, corporate wellness days, team-building events — AfroPuppyYoga brings the puppies, the yoga, and the Afrobeats to your private event. Groups from 6 to 50+ welcome.</p>
              <ul className="space-y-3 mb-8">
                {["Birthday parties & bachelorettes", "Corporate wellness & team-building", "Student group events & brand activations", "Custom packages starting at $1,200"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-brand-link flex-shrink-0 mt-1" aria-hidden="true" />
                    <span className="font-body text-sm text-espresso leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-3">
                <a href="/private-events/quote" className="apy-primary-action min-h-12">Get a Private Event Quote</a>
                <a href="/corporate-puppy-yoga" className="inline-flex items-center justify-center min-h-12 px-6 py-3 border border-border text-espresso font-body font-medium text-sm rounded-full hover:bg-blush transition-colors motion-reduce:transition-none">Corporate Events →</a>
              </div>
            </div>
            <div className="divide-y divide-border">
              {[
                { icon: "🎂", label: "Birthday Packages", desc: "Make it unforgettable with puppies, yoga, and your crew." },
                { icon: "💼", label: "Corporate Wellness", desc: "Employee appreciation, team-building, and stress relief in one session." },
                { icon: "🥂", label: "Bachelorette & Celebrations", desc: "The most unique bachelorette activity in Ontario." },
                { icon: "🎓", label: "Student Group Events", desc: "Perfect for clubs, orientation events, and stress-relief sessions." },
              ].map((item) => (
                <div key={item.label} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                  <div className="text-2xl flex-shrink-0" aria-hidden="true">{item.icon}</div>
                  <div>
                    <div className="font-display font-medium text-espresso text-xl mb-2">{item.label}</div>
                    <div className="font-body text-base text-muted-foreground leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Reviews — the original config content and shared reputation count. */}
      <section className="apy-section bg-blush">
        <div className="container max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-6">
            <div>
              <p className="apy-eyebrow mb-3">Reviews</p>
              <h2 className="apy-heading">See What Our<br /><span className="italic text-brand-link">Clients Say</span></h2>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="flex gap-1 mb-2 text-brand-link" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} size={16} className="fill-primary" />)}
                </div>
                <p className="font-body text-sm text-espresso">{FIVE_STAR_REVIEW_COUNT} five-star reviews</p>
              </div>
              <a href={REVIEW_METRICS.google.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-11 px-5 py-3 border border-border text-espresso font-body font-medium text-sm rounded-full hover:bg-ivory transition-colors motion-reduce:transition-none">Leave a Review</a>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {config.reviews.map((review) => (
              <div key={review.name} className="bg-white rounded-2xl p-6 border border-border">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-espresso font-body font-semibold text-sm">{review.avatar}</div>
                    <div className="min-w-0">
                      <div className="font-display font-medium text-base text-espresso">{review.name}</div>
                      <div className="font-body text-xs text-muted-foreground mt-1">{review.date}</div>
                    </div>
                  </div>
                  <Quote size={20} className="text-brand-link shrink-0" aria-hidden="true" />
                </div>
                <div className="flex gap-1 mb-3 text-brand-link" aria-label="5 stars">
                  {Array.from({ length: 5 }, (_, j) => <Star key={j} size={14} className="fill-primary" aria-hidden="true" />)}
                </div>
                <p className="font-body text-muted-foreground text-base leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="apy-section bg-ivory">
        <div className="container max-w-3xl">
          <h2 className="apy-heading mb-8">FAQs — {config.city}</h2>
          <div className="bg-white rounded-2xl border border-border px-5 sm:px-8 py-2">
            {config.faqs.map((faq) => <FAQItem key={faq.question} faq={faq} />)}
          </div>
        </div>
      </section>

      {/* 8. Final booking action */}
      <section className="apy-section bg-blush border-t border-border text-center">
        <div className="container max-w-3xl">
          <h2 className="apy-heading mb-5">Ready to Join Us in {config.city}?</h2>
          <p className="font-body text-muted-foreground text-base leading-relaxed mb-8 max-w-2xl mx-auto">Spots are limited and sessions sell out. Book your mat now and experience Ontario's #1 puppy yoga studio.</p>
          {config.comingSoon ? (
            <a
              href={attributedBookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("InitiateCheckout", { content_name: `Book Class — ${config.city} (Coming Soon)` })}
              className="apy-primary-action min-h-12 w-full sm:w-auto"
            >Book in KW or Hamilton While You Wait</a>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={attributedBookUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("InitiateCheckout", { content_name: `Book Class CTA — ${config.city}` })}
                className="apy-primary-action min-h-12"
              >Book a Class in {config.city}</a>
              <a href="/private-events/quote" className="inline-flex items-center justify-center min-h-12 px-6 py-3 border border-border text-espresso font-body font-medium text-sm rounded-full hover:bg-ivory transition-colors motion-reduce:transition-none">Plan a Private Event</a>
            </div>
          )}
          {/* 9. Existing internal city links and conditions stay unchanged. */}
          <div className="mt-10 pt-8 border-t border-border">
            <p className="font-body text-xs text-muted-foreground uppercase tracking-widest mb-3">Also Available In</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {config.slug !== "puppy-yoga-kitchener" && <a href="/puppy-yoga-kitchener" className="apy-link inline-flex items-center min-h-11 font-body text-sm rounded-sm">Kitchener →</a>}
              {config.slug !== "puppy-yoga-hamilton" && <a href="/puppy-yoga-hamilton" className="apy-link inline-flex items-center min-h-11 font-body text-sm rounded-sm">Hamilton →</a>}
              {config.slug !== "puppy-yoga-oakville" && <a href="/puppy-yoga-oakville" className="apy-link inline-flex items-center min-h-11 font-body text-sm rounded-sm">Oakville →</a>}
              {config.slug !== "puppy-yoga-guelph" && <a href="/puppy-yoga-guelph" className="apy-link inline-flex items-center min-h-11 font-body text-sm rounded-sm">Guelph →</a>}
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
