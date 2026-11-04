import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CalendarDays, MapPin, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BOOK_URL } from "@/const";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { appendAttributionToLumaUrl } from "@/lib/lumaAttribution";
import { FIVE_STAR_REVIEW_COUNT } from "@shared/reviewMetrics";
import { publicPortraitUrl } from "@shared/publicPortraits";
import { recoverPublicPortrait } from "@/lib/publicPortraitRecovery";

const CANONICAL_URL = "https://afropuppyyoga.ca/puppy-yoga-guelph";
const PAGE_TITLE = "Puppy Yoga Guelph | AfroPuppyYoga";
const HERO_PHOTO = "/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg";
const CALENDAR_URL =
  "https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events?theme=light&lt=light";
const VENUE_NAME = "Emotion Dance Company";
const VENUE_ADDRESS = "375 Southgate Drive, Unit 2, Guelph, Ontario";
const VENUE_GUIDANCE =
  "Find the venue, date and arrival details on your selected event listing before booking.";

// These approved portraits show APY experiences, not a verified Guelph venue.
const EXPERIENCE_PHOTOS = [
  {
    src: "/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg",
    alt: "Smiling guest cuddling a Golden Retriever puppy at AfroPuppyYoga",
  },
  {
    src: "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg",
    alt: "Smiling AfroPuppyYoga guest holding two Golden Retriever puppies",
  },
];

const EXPERIENCE_DETAILS = [
  {
    title: "Movement at your pace",
    description:
      "Beginner-friendly guided movement makes it easy to join in, whether this is your first yoga class or part of your routine.",
  },
  {
    title: "An Afrobeats soundtrack",
    description:
      "Music is part of the experience. Afrobeats brings a warm, playful rhythm to your time on the mat.",
  },
  {
    title: "Time for puppy cuddles",
    description:
      "Enjoy puppy cuddles and a shared experience with friends, or come on your own and meet fellow puppy lovers.",
  },
];

const BOOKING_STEPS = [
  {
    title: "Choose a listing",
    description: "Choose a Guelph event and check its venue before booking.",
  },
  {
    title: "Check the details",
    description: VENUE_GUIDANCE,
  },
  {
    title: "Book through Luma",
    description:
      "Follow the booking steps on the event listing and keep your confirmation handy.",
  },
];

export default function Guelph() {
  const { track } = useMetaPixel();
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const attributedBookUrl = useMemo(
    () => appendAttributionToLumaUrl(BOOK_URL),
    []
  );
  const attributedCalendarUrl = useMemo(
    () => appendAttributionToLumaUrl(CALENDAR_URL),
    []
  );
  const description = `Puppy yoga in Guelph with beginner-friendly guided movement, Afrobeats and puppy cuddles. AfroPuppyYoga has ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Browse live classes.`;

  useSeoMeta({
    title: PAGE_TITLE,
    description,
    canonical: CANONICAL_URL,
    ogTitle: PAGE_TITLE,
    ogDescription: description,
    ogImage: publicPortraitUrl(HERO_PHOTO),
  });

  useEffect(() => {
    // Describe the service area without implying a permanent APY studio.
    const script = document.createElement("script");
    script.id = "schema-service-guelph";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://afropuppyyoga.ca/#organization",
          name: "AfroPuppyYoga",
          url: "https://afropuppyyoga.ca/",
        },
        {
          "@type": "Service",
          "@id": `${CANONICAL_URL}#service`,
          name: "Puppy Yoga in Guelph",
          serviceType: "Puppy yoga",
          url: CANONICAL_URL,
          description:
            "Beginner-friendly guided movement, Afrobeats and puppy cuddles in Guelph, Ontario.",
          areaServed: {
            "@type": "City",
            name: "Guelph",
            containedInPlace: {
              "@type": "AdministrativeArea",
              name: "Ontario",
            },
          },
          provider: { "@id": "https://afropuppyyoga.ca/#organization" },
        },
      ],
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  function trackBooking(source: string) {
    track("InitiateCheckout", { content_name: `Guelph Classes: ${source}` });
  }

  return (
    <div className="apy-page">
      <Navbar />
      <main id="guelph-main">
        <section
          aria-labelledby="guelph-title"
          className="bg-ivory pt-24 pb-10 md:pt-28 md:pb-14"
        >
          <div className="container max-w-6xl">
            <div className="grid items-center gap-9 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <div className="min-w-0 lg:py-8">
                <nav aria-label="Breadcrumb" className="mb-7 font-body text-sm">
                  <ol className="flex flex-wrap items-center gap-2">
                    <li>
                      <Link href="/" className="apy-link rounded-sm">
                        Home
                      </Link>
                    </li>
                    <li aria-hidden="true" className="text-muted-foreground">
                      /
                    </li>
                    <li aria-current="page" className="text-muted-foreground">
                      Guelph
                    </li>
                  </ol>
                </nav>
                <p className="mb-4 flex items-center gap-2 font-body text-sm uppercase tracking-[0.14em] text-brand-link">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Guelph, Ontario
                </p>
                <h1
                  id="guelph-title"
                  className="mb-6 font-display text-[clamp(2.75rem,5.4vw,4.75rem)] font-normal leading-[1.08] tracking-[-0.04em] text-espresso [text-wrap:pretty]"
                >
                  Puppy Yoga
                  <br />
                  in <span className="italic text-brand-link">Guelph</span>
                </h1>
                <p className="mb-7 max-w-xl font-body text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Guided movement, an Afrobeats soundtrack and puppy cuddles.
                  Join AfroPuppyYoga for a playful break from your routine, with
                  beginners welcome.
                </p>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <a
                    href={attributedBookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackBooking("Hero")}
                    className="apy-primary-action min-h-12 px-7 active:scale-[0.97] motion-reduce:transform-none"
                  >
                    View upcoming classes
                    <ArrowRight
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                  <a
                    href="#guelph-classes"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 py-3 font-body text-sm font-medium text-espresso transition-colors hover:bg-blush motion-reduce:transition-none"
                  >
                    Find Guelph events
                  </a>
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div
                    className="flex gap-1 text-brand-link"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} className="h-4 w-4 fill-primary" />
                    ))}
                  </div>
                  <p className="font-body text-sm text-espresso">
                    {FIVE_STAR_REVIEW_COUNT} five-star reviews across
                    AfroPuppyYoga
                  </p>
                </div>
              </div>
              <figure className="mx-auto w-full max-w-[420px] lg:mr-0 lg:ml-auto">
                <div className="overflow-hidden rounded-[50%_50%_1rem_1rem/22%_22%_1rem_1rem] bg-blush">
                  <img
                    src={publicPortraitUrl(HERO_PHOTO)}
                    onError={recoverPublicPortrait}
                    alt="Smiling guest holding a fluffy Chow Chow puppy at AfroPuppyYoga"
                    width={1500}
                    height={2000}
                    fetchPriority="high"
                    decoding="async"
                    className="block h-auto w-full"
                  />
                </div>
                <figcaption className="mt-3 font-body text-xs text-muted-foreground">
                  Moments from AfroPuppyYoga
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section
          className="border-y border-border bg-blush py-6"
          aria-label="Guelph event location details"
        >
          <div className="container max-w-6xl">
            <div className="grid gap-5 md:grid-cols-2 md:items-center md:gap-10">
              <div className="flex items-start gap-3">
                <MapPin
                  className="mt-1 h-5 w-5 shrink-0 text-brand-link"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="apy-eyebrow mb-1">Current Guelph event venue</p>
                  <p className="font-body font-semibold text-espresso">
                    {VENUE_NAME}
                  </p>
                  <p className="font-body text-sm leading-relaxed text-muted-foreground">
                    {VENUE_ADDRESS}
                  </p>
                </div>
              </div>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                {VENUE_GUIDANCE}
              </p>
            </div>
          </div>
        </section>

        <section
          className="apy-section bg-ivory"
          aria-labelledby="guelph-experience-title"
        >
          <div className="container max-w-6xl">
            <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
              <div className="min-w-0">
                <h2 id="guelph-experience-title" className="apy-heading mb-7">
                  A little movement.
                  <br />
                  <span className="italic text-brand-link">
                    A lot of puppy love.
                  </span>
                </h2>
                <div className="divide-y divide-border">
                  {EXPERIENCE_DETAILS.map(detail => (
                    <div
                      key={detail.title}
                      className="py-5 first:pt-0 last:pb-0"
                    >
                      <h3 className="mb-2 font-display text-xl font-medium text-espresso">
                        {detail.title}
                      </h3>
                      <p className="font-body text-base leading-relaxed text-muted-foreground">
                        {detail.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <div className="grid grid-cols-2 items-start gap-3 sm:gap-5">
                  {EXPERIENCE_PHOTOS.map((photo, index) => (
                    <div
                      key={photo.src}
                      className={`overflow-hidden rounded-2xl bg-blush ${index === 1 ? "mt-10 sm:mt-16" : ""}`}
                    >
                      <img
                        src={publicPortraitUrl(photo.src)}
                        onError={recoverPublicPortrait}
                        alt={photo.alt}
                        width={1500}
                        height={2000}
                        loading="lazy"
                        decoding="async"
                        className="block h-auto w-full"
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-4 font-body text-xs text-muted-foreground">
                  Moments from AfroPuppyYoga
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="guelph-classes"
          aria-labelledby="guelph-calendar-title"
          className="apy-section scroll-mt-24 border-y border-border bg-blush"
        >
          <div className="container max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <p className="apy-eyebrow mb-3">Live class calendar</p>
              <h2 id="guelph-calendar-title" className="apy-heading mb-4">
                Find your next puppy cuddle.
              </h2>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Browse events across all our locations below. Choose a Guelph
                class and check its date and venue before booking.
              </p>
            </div>
            <ol className="mb-8 grid gap-6 md:grid-cols-3 md:gap-8">
              {BOOKING_STEPS.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-ivory font-body text-sm font-semibold text-brand-link"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="mb-2 font-display text-xl font-medium text-espresso">
                      {step.title}
                    </h3>
                    <p className="font-body text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-6">
                <p className="flex items-center gap-2 font-body text-sm font-semibold">
                  <CalendarDays
                    className="h-4 w-4 text-brand-link"
                    aria-hidden="true"
                  />
                  All AfroPuppyYoga events on Luma
                </p>
                <span
                  role="status"
                  className="font-body text-xs text-muted-foreground"
                >
                  {calendarLoaded ? "Live calendar" : "Loading calendar..."}
                </span>
              </div>
              <iframe
                src={attributedCalendarUrl}
                title="AfroPuppyYoga live class calendar, including Guelph events"
                width="100%"
                height="500"
                loading="lazy"
                allowFullScreen
                onLoad={() => setCalendarLoaded(true)}
                className="relative block w-full max-w-full border-0 bg-card"
              />
            </div>
            <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
                Calendar not displaying, or no Guelph event listed? Open our
                booking calendar on Luma to check current listings.
              </p>
              <a
                href={attributedBookUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackBooking("Calendar")}
                className="apy-primary-action min-h-12 w-full active:scale-[0.97] motion-reduce:transform-none sm:w-auto"
              >
                View upcoming classes
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section
          className="apy-section bg-ivory"
          aria-labelledby="guelph-private-title"
        >
          <div className="container max-w-5xl">
            <div className="grid items-start gap-8 md:grid-cols-[1.2fr_0.8fr] md:gap-12">
              <div>
                <h2 id="guelph-private-title" className="apy-heading mb-5">
                  Make it a<br />
                  <span className="italic text-brand-link">
                    shared occasion.
                  </span>
                </h2>
                <p className="max-w-xl font-body text-base leading-relaxed text-muted-foreground">
                  Planning a birthday, a team gathering or time together with
                  friends in Guelph? Tell us what you have in mind through our
                  existing private-event quote form.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-blush p-6 sm:p-8">
                <h3 className="mb-3 font-display text-2xl font-medium text-espresso">
                  Your group, your enquiry
                </h3>
                <p className="mb-6 font-body text-sm leading-relaxed text-muted-foreground">
                  Share your preferred date and location so the team can discuss
                  the options with you. A request does not confirm availability.
                </p>
                <Link
                  href="/private-events/quote"
                  className="apy-primary-action min-h-12 w-full active:scale-[0.97] motion-reduce:transform-none"
                >
                  Request a private event quote
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          className="apy-section border-t border-border bg-ivory"
          aria-labelledby="guelph-faq-title"
        >
          <div className="container max-w-3xl">
            <h2 id="guelph-faq-title" className="apy-heading mb-8">
              Before you join us
            </h2>
            <Accordion
              type="single"
              collapsible
              className="rounded-2xl border border-border bg-card px-5 text-card-foreground sm:px-8"
            >
              <AccordionItem value="venue">
                <AccordionTrigger className="min-h-14 py-5 font-display text-lg font-medium text-espresso hover:text-brand-link">
                  Where is puppy yoga in Guelph held?
                </AccordionTrigger>
                <AccordionContent className="font-body text-base leading-relaxed text-muted-foreground">
                  Current Guelph event listings use {VENUE_NAME} at{" "}
                  {VENUE_ADDRESS}. {VENUE_GUIDANCE} Use the venue information on
                  that listing when planning your visit.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="beginners">
                <AccordionTrigger className="min-h-14 py-5 font-display text-lg font-medium text-espresso hover:text-brand-link">
                  Can I join if I am new to yoga?
                </AccordionTrigger>
                <AccordionContent className="font-body text-base leading-relaxed text-muted-foreground">
                  Yes. Our guided movement is beginner-friendly, so you do not
                  need previous yoga experience. Move at a pace that feels
                  comfortable for you.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="private">
                <AccordionTrigger className="min-h-14 py-5 font-display text-lg font-medium text-espresso hover:text-brand-link">
                  Can I request a private event in Guelph?
                </AccordionTrigger>
                <AccordionContent className="font-body text-base leading-relaxed text-muted-foreground">
                  Yes. Use our{" "}
                  <Link
                    href="/private-events/quote"
                    className="apy-link rounded-sm underline"
                  >
                    private-event quote form
                  </Link>{" "}
                  to share your plans, preferred date and location. The team can
                  discuss the options and confirm availability with you.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
