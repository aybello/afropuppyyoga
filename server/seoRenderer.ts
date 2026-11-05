/**
 * SEO Dynamic Renderer
 *
 * When a search engine crawler visits the site, we return a fully-rendered
 * HTML page with all key content baked in — no JavaScript required.
 * Real users always get the normal React SPA.
 *
 * Dynamic rendering is a legacy workaround, not a substitute for unified SSR:
 * https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
 */

import { type Request, type Response, type NextFunction } from "express";
import { PUPPY_MONITOR_SHIFT_DESCRIPTION } from "../shared/newCareersListings";
import { PUPPY_MONITOR_PAY_LABEL, PUPPY_MONITOR_POSITION_TYPE } from "../shared/puppyMonitorTerms";
import { MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD } from "../shared/movementInstructorTerms";
import { SOCIAL_MEDIA_INTERN_PAY_LABEL } from "../shared/socialMediaTerms";
import {
  FIVE_STAR_REVIEW_COUNT,
  REVIEW_METRICS,
} from "../shared/reviewMetrics";
import { HOME_SEO_TITLE, HOME_SEO_DESCRIPTION, LOYALTY_SEO_DESCRIPTION, MEMBERSHIP_LOCATION_COPY, PUBLIC_LOCATION_NAMES, PUBLIC_LOCATION_LIST, PUBLIC_LOCATION_FAQ, PUBLIC_SERVICE_DESCRIPTION } from "../shared/publicLocations";
import { PRIVATE_EVENT_PACKAGE_BANDS, privateEventBandLabel, PRIVATE_EVENT_PRICE_NOTE, PRIVATE_EVENT_TRAVEL_NOTE, PRIVATE_EVENT_CUSTOM_NOTE } from "../shared/privateEventPricing";
import { PRIVATE_EVENT_EXPERIENCES, PRIVATE_EVENT_SCHEDULES, PRIVATE_EVENT_VENUES, PRIVATE_EVENT_FORMAT_PRICE_NOTE, PRIVATE_EVENT_CUSTOM_SCOPE_NOTE } from "../shared/privateEventExperience";

// ─── Crawler Detection ────────────────────────────────────────────────────────

const CRAWLER_UA_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebot/i,
  /ia_archiver/i,
  /msnbot/i,
  /teoma/i,
  /rogerbot/i,
  /linkedinbot/i,
  /embedly/i,
  /quora link preview/i,
  /showyoubot/i,
  /outbrain/i,
  /pinterest\/0\./i,
  /developers\.google\.com\/\+\/web\/snippet/i,
  /slackbot/i,
  /vkshare/i,
  /w3c_validator/i,
  /redditbot/i,
  /applebot/i,
  /whatsapp/i,
  /flipboard/i,
  /tumblr/i,
  /bitlybot/i,
  /skypeuripreview/i,
  /nuzzel/i,
  /discordbot/i,
  /google page speed/i,
  /qwantify/i,
  /pinterestbot/i,
  /bitrix link preview/i,
  /xing-contenttabreceiver/i,
  /chrome-lighthouse/i,
  /telegrambot/i,
  /manus-seo/i, // Manus SEO analyzer
  /ahrefsbot/i, // Ahrefs crawler
  /semrushbot/i, // SEMrush crawler
  /dotbot/i,
  /mj12bot/i,
];

export function isCrawler(req: Request): boolean {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  // Also detect Manus SEO tool by checking for special header or query param
  if (req.query["_seo_check"] === "1") return true;
  return CRAWLER_UA_PATTERNS.some((p) => p.test(ua));
}

// ─── Shared HTML wrapper ──────────────────────────────────────────────────────

function buildHtml(opts: {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  body: string;
  schema?: object | object[];
}): string {
  const ogImage =
    opts.ogImage ||
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og-image_139020fe.png";
  const schemas = Array.isArray(opts.schema)
    ? opts.schema
    : opts.schema
      ? [opts.schema]
      : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
  <meta name="description" content="${opts.description}" />
  <link rel="canonical" href="${opts.canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${opts.title}" />
  <meta property="og:description" content="${opts.description}" />
  <meta property="og:url" content="${opts.canonical}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:site_name" content="AfroPuppyYoga" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${opts.title}" />
  <meta name="twitter:description" content="${opts.description}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta name="robots" content="index, follow" />
  <meta name="google-site-verification" content="Il1RHsCr4Dyu4h1bm7e73-pfTD9dRJv6fURg67559-s" />
  <meta name="google-site-verification" content="bs3ebpDdVQTewQN_rZtfFYWmaok2xG04LrEQUtZexYc" />
  ${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n  ")}
</head>
<body>
${opts.body}
<nav aria-label="Explore AfroPuppyYoga">
  <a href="/puppy-yoga-kitchener">Kitchener</a>
  <a href="/puppy-yoga-hamilton">Hamilton</a>
  <a href="/puppy-yoga-oakville">Oakville</a>
  <a href="/puppy-yoga-guelph">Guelph</a>
  <a href="/private-puppy-yoga-events">Private events</a>
  <a href="/corporate-puppy-yoga">Corporate events</a>
  <a href="/private-events/quote">Request a quote</a>
</nav>
</body>
</html>`;
}

// ─── Shared Schema Fragments ──────────────────────────────────────────────────

const BASE = "https://afropuppyyoga.ca";

const OG_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og-image_139020fe.png";

const PRIVATE_EVENT_START_PRICE = `$${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST`;
const PRIVATE_EVENT_EXPERIENCE_COPY = `${PRIVATE_EVENT_EXPERIENCES.puppy_yoga.name}: ${PRIVATE_EVENT_EXPERIENCES.puppy_yoga.description} ${PRIVATE_EVENT_EXPERIENCES.puppy_lounge.name}: ${PRIVATE_EVENT_EXPERIENCES.puppy_lounge.description} The lounge has no guided yoga class.`;
const PRIVATE_EVENT_SCHEDULE_COPY = `Schedule is separate from the experience: ${Object.values(PRIVATE_EVENT_SCHEDULES).join("; ")}. Venue choices: ${PRIVATE_EVENT_VENUES.studio}, subject to availability, or ${PRIVATE_EVENT_VENUES.client_venue.toLowerCase()}. Timing, capacity, setup, room resets and puppy rest are confirmed in the agreed scope.`;
const PRIVATE_EVENT_SCOPE_COPY = `${PRIVATE_EVENT_PRICE_NOTE} ${PRIVATE_EVENT_FORMAT_PRICE_NOTE} ${PRIVATE_EVENT_CUSTOM_SCOPE_NOTE}`;
const PRIVATE_EVENT_SERVICE_COPY = `${PRIVATE_EVENT_EXPERIENCE_COPY} ${PRIVATE_EVENT_SCHEDULE_COPY} ${PRIVATE_EVENT_SCOPE_COPY} Other custom scopes include nonstandard durations and help choosing an experience or package; these receive a full custom quote, never a multiplied package price.`;
const PRIVATE_EVENT_PRICING_COPY = `Standard 60-minute studio puppy yoga for up to 20 guests starts at ${PRIVATE_EVENT_START_PRICE}. Classic: ${privateEventBandLabel("classic")} for the core studio experience; Signature: ${privateEventBandLabel("signature")} with professional photography and an enhanced setup; Luxury: ${privateEventBandLabel("luxury")} for a customized experience. Groups from 6 to 50+ can be discussed, subject to venue and availability; groups of 21 or more require a custom quote. ${PRIVATE_EVENT_SCOPE_COPY} Nonstandard durations and help choosing an experience or package also receive a full custom quote, never a multiplied package price. Use the quote tool to view an indicative standard package range or request a custom quote.`;
const PRIVATE_EVENT_INCLUSIONS_COPY = "Standard studio puppy yoga includes guided yoga and puppy play, a certified instructor and event host, ethically sourced puppies and handlers, mats and props, setup and cleanup, and a curated playlist. Signature adds professional photography and an enhanced setup. Luxury is customized to the agreed scope. Puppy Play & Wellness Lounge provides supervised puppy interaction without a guided yoga class; its inclusions are confirmed in a custom quote. Refreshment, merchandise, and other option inclusions depend on the selected package or confirmed quote.";
const PRIVATE_EVENT_EXPERIENCES_HTML = `
  <section id="private-event-experiences">
    <h2>Choose Your Experience</h2>
    <h3>${PRIVATE_EVENT_EXPERIENCES.puppy_yoga.name}</h3>
    <p>${PRIVATE_EVENT_EXPERIENCES.puppy_yoga.description}</p>
    <h3>Puppy Play &amp; Wellness Lounge</h3>
    <p>${PRIVATE_EVENT_EXPERIENCES.puppy_lounge.description} No guided yoga class.</p>
    <h3>Then Choose Your Schedule and Venue</h3>
    <p>${PRIVATE_EVENT_SCHEDULE_COPY}</p>
    <p>${PRIVATE_EVENT_FORMAT_PRICE_NOTE} Nonstandard durations and help choosing also receive a full custom quote, never a multiplied package price.</p>
    <p>${PRIVATE_EVENT_CUSTOM_SCOPE_NOTE}</p>
    <p><a href="/private-events/quote#private-event-experiences">Choose Your Experience</a></p>
  </section>`;
const PRIVATE_EVENT_PACKAGES_HTML = `
  <ul>
    <li><strong>Classic (${privateEventBandLabel("classic")}):</strong> Core 60-minute studio puppy yoga for up to 20 guests</li>
    <li><strong>Signature (${privateEventBandLabel("signature")}):</strong> 60-minute studio puppy yoga for up to 20 guests with professional photography and an enhanced setup</li>
    <li><strong>Luxury (${privateEventBandLabel("luxury")}):</strong> Customized 60-minute studio puppy yoga for up to 20 guests with the final scope confirmed in your quote</li>
  </ul>
  <p>${PRIVATE_EVENT_SCOPE_COPY} Groups of 21 or more, nonstandard durations and help choosing require a full custom quote, never a multiplied package price.</p>`;

function privateEventStartingOffer() {
  return {
    "@type": "Offer",
    name: PRIVATE_EVENT_PACKAGE_BANDS.classic.name,
    url: `${BASE}/private-events/quote`,
    priceCurrency: "CAD",
    price: String(PRIVATE_EVENT_PACKAGE_BANDS.classic.min),
    description: PRIVATE_EVENT_SCOPE_COPY,
    priceSpecification: {
      "@type": "PriceSpecification",
      minPrice: PRIVATE_EVENT_PACKAGE_BANDS.classic.min,
      maxPrice: PRIVATE_EVENT_PACKAGE_BANDS.classic.max,
      priceCurrency: "CAD",
      valueAddedTaxIncluded: false,
    },
  };
}

/** Canonical LocalBusiness schema — synced with client/index.html */
const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${BASE}/#business`,
  name: "AfroPuppyYoga",
  description: PUBLIC_SERVICE_DESCRIPTION,
  url: BASE,
  logo: {
    "@type": "ImageObject",
    url: OG_IMAGE,
    width: 1200,
    height: 630,
  },
  image: OG_IMAGE,
  telephone: "+12897881885",
  email: "afropuppyyoga@gmail.com",
  currenciesAccepted: "CAD",
  paymentAccepted: "Credit Card",
  address: {
    "@type": "PostalAddress",
    streetAddress: "329 King St E",
    addressLocality: "Kitchener",
    addressRegion: "ON",
    postalCode: "N2G 2L3",
    addressCountry: "CA",
  },
  areaServed: PUBLIC_LOCATION_NAMES.map(name => ({
    "@type": "City",
    name,
    containedInPlace: { "@type": "State", name: "Ontario" },
  })),
  sameAs: [
    "https://www.instagram.com/afropuppyyoga",
    "https://www.tiktok.com/@afropuppyyoga",
  ],
};

/** Build a BreadcrumbList schema for any page */
function breadcrumb(
  ...items: Array<{ name: string; url: string }>
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
      ...items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: item.name,
        item: item.url,
      })),
    ],
  };
}

// ─── Page Definitions ─────────────────────────────────────────────────────────


const PAGES: Record<string, () => string> = {
  "/puppy-yoga-guelph": () =>
    buildHtml({
      title: "Puppy Yoga Guelph | AfroPuppyYoga",
      description: `Puppy yoga in Guelph with AfroPuppyYoga. ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Guided movement, Afrobeats and puppy cuddles. See upcoming classes and venue details.`,
      canonical: `${BASE}/puppy-yoga-guelph`,
      ogImage: `${BASE}/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg`,
      schema: [
        breadcrumb({ name: "Puppy Yoga Guelph", url: `${BASE}/puppy-yoga-guelph` }),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": `${BASE}/puppy-yoga-guelph#service`,
          name: "AfroPuppyYoga in Guelph",
          serviceType: "Puppy yoga",
          url: `${BASE}/puppy-yoga-guelph`,
          areaServed: { "@type": "City", name: "Guelph", containedInPlace: { "@type": "State", name: "Ontario" } },
          provider: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE },
        },
      ],
      body: `
<header>
  <nav><a href="/">Home</a> &rsaquo; Guelph</nav>
  <h1>Puppy Yoga in Guelph</h1>
</header>
<main>
  <p>Guided movement, Afrobeats and puppy cuddles. Enjoy a beginner-friendly AfroPuppyYoga experience in Guelph, Ontario.</p>
  <p>${FIVE_STAR_REVIEW_COUNT} five-star reviews for AfroPuppyYoga.</p>
  <p><a href="https://lu.ma/afropuppyyoga">View Upcoming Classes</a> | <a href="/private-events/quote">Request a Private Event Quote</a></p>
  <h2>Plan Your Visit</h2>
  <address>Emotion Dance Company, 375 Southgate Drive, Unit 2, Guelph, ON</address>
  <p>Our current Guelph event listings use Emotion Dance Company. Check the venue, date and arrival details on your selected event before booking. Ticket options and prices are shown on Luma.</p>
  <h2>What to Expect</h2>
  <ul><li>Beginner-friendly guided movement</li><li>Puppy cuddles and photo moments</li><li>An Afrobeats soundtrack and a welcoming atmosphere</li></ul>
  <h2>Moments from AfroPuppyYoga</h2>
  <img src="/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg" alt="Smiling guest cuddling a Chow puppy at AfroPuppyYoga" width="450" height="600" />
  <h2>Private Events in Guelph</h2>
  <p>Planning a celebration, team event or group experience? <a href="/private-events/quote">Request a private event quote</a> to discuss your plans.</p>
  <h2>Frequently Asked Questions</h2>
  <dl>
    <dt>Where is the Guelph class held?</dt><dd>Current Guelph classes are listed at Emotion Dance Company, 375 Southgate Drive, Unit 2, Guelph, ON. Check your selected Luma event for its venue and arrival details before booking.</dd>
    <dt>Do I need yoga experience?</dt><dd>No. Our guided movement is beginner-friendly.</dd>
    <dt>Can I enquire about a private event?</dt><dd>Yes. Use our private event quote form to discuss a group experience in Guelph.</dd>
  </dl>
</main>
<footer><a href="/">Home</a> | <a href="/puppy-yoga-kitchener">Kitchener</a> | <a href="/puppy-yoga-hamilton">Hamilton</a> | <a href="/puppy-yoga-oakville">Oakville</a> | <a href="/staff-access">Staff Portal</a></footer>`,
    }),
  "/": () =>
    buildHtml({
      title: HOME_SEO_TITLE,
      description: HOME_SEO_DESCRIPTION,
      canonical: `${BASE}/`,
      schema: [
        LOCAL_BUSINESS_SCHEMA,
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is puppy yoga?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Puppy yoga is a guided yoga class where adorable, well-socialized puppies roam freely among participants. Classes are led by a certified instructor and include Afro-beat inspired music for a unique wellness experience.",
              },
            },
            {
              "@type": "Question",
              name: "Where are your classes held?",
              acceptedAnswer: {
                "@type": "Answer",
                text: PUBLIC_LOCATION_FAQ,
              },
            },
            {
              "@type": "Question",
              name: "How do I book a class?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "All classes are booked through our Luma page. Visit afropuppyyoga.ca and click 'Book a Class' to see all upcoming sessions and reserve your spot.",
              },
            },
            {
              "@type": "Question",
              name: "What happens if my class is cancelled?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We never want to cancel a class. If we do, it is always due to circumstances outside our control. We do not issue cash refunds — instead, you will receive a non-expiring class credit as a coupon code that can be transferred to another person.",
              },
            },
            {
              "@type": "Question",
              name: "Are the puppies safe and ethical?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. We partner only with vetted, ethical breeders and registered rescues. All puppies are at least 6 weeks old, veterinarian-cleared, and supervised by dedicated Puppy Monitors throughout every class. Puppies have Calm Zones and are never forced to interact.",
              },
            },
            {
              "@type": "Question",
              name: "Can I book a private event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes! We offer private puppy yoga events for corporate wellness days, birthdays, bachelorette parties, and more. Get an instant quote at afropuppyyoga.ca/private-events/quote.",
              },
            },
          ],
        },
        breadcrumb(),
      ],
      body: `
<header>
  <h1>AfroPuppyYoga — Ontario's #1 Puppy Yoga Studio</h1>
  <p>Where Wellness Meets Puppy Love</p>
  <nav>
    <a href="/">Home</a>
    <a href="/careers">Careers</a>
    <a href="/partnerships">Partnerships</a>
    <a href="/loyalty">Loyalty Program</a>
    <a href="/ethics">Ethical Standards</a>
    <a href="/private-events/quote">Private Event Quote</a>
  </nav>
</header>

<main>
  <section id="hero">
    <h2>Guided yoga, Afro-beat rhythms, and adorable puppies — all in one unforgettable session.</h2>
    <p>Serving ${PUBLIC_LOCATION_LIST}, Ontario. Ontario's #1 puppy yoga studio.</p>
    <p><a href="https://lu.ma/afropuppyyoga">Book a Class</a></p>
  </section>

  <section id="experience">
    <h2>The AfroPuppyYoga Experience</h2>
    <p>Every AfroPuppyYoga session is a 60-minute guided yoga class set to Afro-beat music, with a litter of adorable puppies roaming freely around you. Whether you're a seasoned yogi or a complete beginner, our classes are designed to be accessible, joyful, and deeply relaxing.</p>
    <ul>
      <li>60-minute guided yoga session</li>
      <li>Live Afro-beat music soundtrack</li>
      <li>Ethically sourced puppies from registered breeders</li>
      <li>All levels welcome — no yoga experience required</li>
      <li>Available in ${PUBLIC_LOCATION_LIST}</li>
    </ul>
  </section>

  <section id="memberships">
    <h2>Memberships &amp; Pricing</h2>
    <p>Join our community with a monthly membership or book individual classes.</p>
    <ul>
      <li><strong>Early Bird Ticket:</strong> discounted rate for early bookings</li>
      <li><strong>Regular Ticket:</strong> standard single admission</li>
      <li><strong>Bring a Friend Package:</strong> two tickets at a reduced per-person rate</li>
      <li><strong>Group of 3 Package:</strong> three tickets at a reduced per-person rate</li>
      <li><strong>Puppy Pass:</strong> $40/month, 1 class credit per month</li>
      <li><strong>Wellness Pack:</strong> $60/month, 2 class credits per month</li>
    </ul>
    <p>${MEMBERSHIP_LOCATION_COPY}</p>
    <p>Both passes include 20% off additional classes and a free class during your birthday month. Credits do not roll over. A 3-month minimum commitment applies; cancel anytime after that.</p>
    <p><a href="https://lu.ma/afropuppyyoga">Book your class on Luma</a></p>
  </section>

  <section id="locations">
    <h2>Our Locations</h2>
    <article>
      <h3>Hamilton — Colibri Studio</h3>
      <address>2751 Barton St E, Hamilton, ON</address>
    </article>
    <article>
      <h3>Kitchener — TenC Dance Studio</h3>
      <address>329 King St E, Kitchener, ON</address>
    </article>
    <article>
      <h3>Oakville</h3>
      <p>Classes held at rotating venues in Oakville, ON.</p>
    </article>
    <article>
      <h3>Guelph</h3>
      <address>Emotion Dance Company, 375 Southgate Drive, Unit 2, Guelph, ON</address>
      <p>Confirm the venue and arrival details on your selected event listing before booking.</p>
      <p><a href="/puppy-yoga-guelph">Explore Guelph classes</a></p>
    </article>
  </section>

  <section id="about">
    <h2>About AfroPuppyYoga</h2>
    <p>AfroPuppyYoga was founded to create a unique wellness space that celebrates Black culture, community, and joy. We blend the ancient practice of yoga with the infectious energy of Afro-beat music and the undeniable happiness that puppies bring. Our studio is a safe, inclusive, and uplifting space for everyone.</p>
    <p>Our ${REVIEW_METRICS.google.location} studio has a ${REVIEW_METRICS.google.rating} rating from all ${REVIEW_METRICS.google.total} Google reviews.</p>
    <p>${FIVE_STAR_REVIEW_COUNT} Five-Star Reviews</p>
  </section>

  <section id="private-events">
    <h2>Private Puppy Yoga Events</h2>
    <p>Make your next celebration unforgettable with a private AfroPuppyYoga event. Perfect for:</p>
    <ul>
      <li>Birthday parties</li>
      <li>Bachelorette &amp; bridal showers</li>
      <li>Corporate team-building</li>
      <li>Baby showers</li>
      <li>Girls' nights out</li>
    </ul>
    <p><a href="/private-events/quote">Request a Private Event Quote</a></p>
  </section>

  <section id="ethics">
    <h2>Our Ethical Standards</h2>
    <p>The welfare of our puppies is our highest priority. All puppies at AfroPuppyYoga come from registered, ethical breeders who meet our strict welfare standards. Sessions are kept short to prevent stress, puppies are never forced to interact, and their health is monitored at every event.</p>
    <p><a href="/ethics">Read our full Ethical Standards</a></p>
  </section>

  <section id="faq">
    <h2>Frequently Asked Questions</h2>
    <dl>
      <dt>What is puppy yoga?</dt>
      <dd>Puppy yoga is a guided yoga class where adorable puppies roam freely around the studio while you practice. At AfroPuppyYoga, we combine Afro-beat rhythms with yoga and playful puppies for a unique wellness experience.</dd>

      <dt>Where are classes held?</dt>
      <dd>${PUBLIC_LOCATION_FAQ}</dd>

      <dt>How much does a class cost?</dt>
      <dd>Ticket prices vary by date and tier. Early bird, regular, bring-a-friend and group-of-three options are available, and current prices for each class are shown at checkout on our Luma booking page.</dd>

      <dt>Are the puppies ethically sourced?</dt>
      <dd>Yes. All puppies come from ethical, registered breeders. We have strict welfare standards — puppies are never stressed, sessions are kept short, and their wellbeing is our top priority.</dd>

      <dt>Can I book a private event?</dt>
      <dd>Yes! We offer private puppy yoga events for birthdays, bachelorette parties, corporate team-building, and more. <a href="/private-events/quote">Get an instant quote here.</a></dd>

      <dt>Do I need yoga experience?</dt>
      <dd>No experience needed! Our classes are designed for all levels, from complete beginners to experienced yogis.</dd>

      <dt>What should I wear?</dt>
      <dd>Comfortable workout clothes that you don't mind getting puppy paws on. We recommend layers as studios can vary in temperature.</dd>
    </dl>
  </section>

  <section id="contact">
    <h2>Contact Us</h2>
    <p>Email: <a href="mailto:afropuppyyoga@gmail.com">afropuppyyoga@gmail.com</a></p>
    <p>Phone: <a href="tel:+12897881885">289-788-1885</a></p>
    <p>Instagram: <a href="https://www.instagram.com/afropuppyyoga">@afropuppyyoga</a></p>
    <p>TikTok: <a href="https://www.tiktok.com/@afropuppyyoga">@afropuppyyoga</a></p>
  </section>
</main>

<footer>
  <p>&copy; 2025 AfroPuppyYoga. All rights reserved.</p>
  <p>Ontario's #1 Puppy Yoga Studio | ${PUBLIC_LOCATION_NAMES.join(" | ")} | Ontario</p>
  <nav>
    <a href="/partnerships">Partnerships</a> |
    <a href="/loyalty">Loyalty Program</a> |
    <a href="/ethics">Ethical Standards</a> |
    <a href="/careers">Careers</a> |
    <a href="/private-events/quote">Private Event Quote</a>
  </nav>
</footer>
`,
    }),

  "/careers": () =>
    buildHtml({
      title: "Careers at AfroPuppyYoga | Join Our Team",
      description:
        "Join AfroPuppyYoga. Movement Instructor jobs in Kitchener and Guelph, plus Puppy Monitor and Operations Specialist jobs in Guelph. Part-time wellness event roles.",
      canonical: `${BASE}/careers`,
      schema: [
        breadcrumb({ name: "Careers", url: `${BASE}/careers` }),
      ],
      body: `
<header>
  <h1>Careers at AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/careers">Careers</a></nav>
</header>
<main>
  <h2>Join Our Team</h2>
  <p>AfroPuppyYoga is always looking for passionate, energetic people to join our growing team. We value inclusivity, creativity, and a genuine love for wellness and animals.</p>
  <h3>Open Roles</h3>
  <p>We hire Movement Instructors, Yoga Instructors, Puppy Monitors, Puppy Specialists and Operations Specialists. Dance teaching backgrounds are welcome for our gentle guided movement roles, not dance classes. Apply with a resume and video introduction.</p>
  <ul>
    <li>Yoga Instructor — Kitchener-Waterloo</li>
    <li>Yoga Instructor — Oakville</li>
    <li>Movement Instructor - Kitchener - CA$${MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD}/hour</li>
    <li>Movement Instructor - Guelph - CA$${MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD}/hour</li>
    <li>Puppy Monitor - Guelph - ${PUPPY_MONITOR_POSITION_TYPE} - ${PUPPY_MONITOR_PAY_LABEL}</li>
    <li>Operations Specialist - Guelph - CA$20/hour</li>
    <li>Puppy Monitor - Kitchener-Waterloo - ${PUPPY_MONITOR_POSITION_TYPE} - ${PUPPY_MONITOR_PAY_LABEL}</li>
    <li>Puppy Monitor - Hamilton - ${PUPPY_MONITOR_POSITION_TYPE} - ${PUPPY_MONITOR_PAY_LABEL}</li>
    <li>Puppy Monitor - Oakville - ${PUPPY_MONITOR_POSITION_TYPE} - ${PUPPY_MONITOR_PAY_LABEL}</li>
    <li>Social Media Intern - Remote - ${SOCIAL_MEDIA_INTERN_PAY_LABEL}</li>
  </ul>
  <p><strong>Puppy Monitor shift:</strong> ${PUPPY_MONITOR_SHIFT_DESCRIPTION}</p>
  <p>To apply, visit our <a href="/careers">Careers page</a> and submit your application.</p>
  <p>Learn more about <a href="/partnerships">Breeder Partnerships</a> or explore our <a href="/ethics">Ethical Standards</a>.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/partnerships">Partnerships</a> | <a href="/ethics">Ethical Standards</a>
</footer>
`,
    }),

  "/partnerships": () =>
    buildHtml({
      title: "Partner with AfroPuppyYoga | Corporate & Brand Partnerships",
      description:
        "Partner with AfroPuppyYoga for corporate events, brand collaborations, and community wellness initiatives in Ontario. Contact us to explore partnership opportunities.",
      canonical: `${BASE}/partnerships`,
      schema: [
        breadcrumb({ name: "Partnerships", url: `${BASE}/partnerships` }),
      ],
      body: `
<header>
  <h1>Partnerships — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/partnerships">Partnerships</a></nav>
</header>
<main>
  <h2>Partner With Us</h2>
  <p>AfroPuppyYoga partners with brands, studios, and organizations that share our values of wellness, inclusivity, and community. We offer co-branded events, corporate wellness packages, and community collaboration opportunities.</p>
  <h3>Partnership Categories</h3>
  <ul>
    <li><strong>Breeder Partners:</strong> Ethical breeders who supply puppies for our classes</li>
    <li><strong>Corporate Wellness:</strong> Companies booking team wellness events</li>
    <li><strong>Studio Partners:</strong> Yoga and fitness studios hosting our events</li>
    <li><strong>Brand Collaborations:</strong> Wellness, lifestyle, and pet brands</li>
    <li><strong>Community Organizations:</strong> Non-profits and community groups</li>
  </ul>
  <p><a href="/partnerships">Apply for a Partnership</a></p>
  <p>Interested in hosting a private event? <a href="/private-events/quote">Get an instant quote.</a></p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/ethics">Ethical Standards</a> | <a href="/careers">Careers</a>
</footer>
`,
    }),

  "/loyalty": () =>
    buildHtml({
      title: "AfroPuppyYoga Loyalty Program | Earn Rewards",
      description: LOYALTY_SEO_DESCRIPTION,
      canonical: `${BASE}/loyalty`,
      schema: [
        breadcrumb({ name: "Loyalty Program", url: `${BASE}/loyalty` }),
      ],
      body: `
<header>
  <h1>AfroPuppyYoga Loyalty Program</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/loyalty">Loyalty Program</a></nav>
</header>
<main>
  <h2>Earn Rewards for Every Class</h2>
  <p>Attend 3 qualifying APY classes and earn a free standard class. Your attendance is tracked by email across ${PUBLIC_LOCATION_LIST}.</p>
  <h3>How It Works</h3>
  <ul>
    <li>Book and attend standard APY classes through Luma using the same email address</li>
    <li>After your third class, receive a free standard-class ticket code</li>
    <li>Your free ticket code is valid for 60 days from issue</li>
    <li>After redeeming your free class, the cycle resets</li>
  </ul>
  <p><a href="/loyalty">Join the Loyalty Program</a></p>
  <p>Book your next class: <a href="https://lu.ma/afropuppyyoga">View upcoming sessions</a></p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/partnerships">Partnerships</a> | <a href="/ethics">Ethical Standards</a>
</footer>
`,
    }),

  "/ethics": () =>
    buildHtml({
      title: "Ethical Standards | AfroPuppyYoga Puppy Welfare",
      description:
        "AfroPuppyYoga is committed to the highest standards of puppy welfare. All our puppies come from ethical, registered breeders and are treated with the utmost care.",
      canonical: `${BASE}/ethics`,
      schema: [
        breadcrumb({ name: "Ethical Standards", url: `${BASE}/ethics` }),
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How old are the puppies at your classes?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "All puppies must be at least six weeks old and have received veterinary clearance and age-appropriate vaccinations before attending any AfroPuppyYoga event.",
              },
            },
            {
              "@type": "Question",
              name: "Do you work with puppy mills or commercial breeders?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Absolutely not. We partner exclusively with responsible, ethical breeders and registered local rescue organizations. We will never work with puppy mills or high-volume commercial breeding facilities.",
              },
            },
            {
              "@type": "Question",
              name: "Are the puppies tired or stressed after a class?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Puppy welfare is our top priority. Classes are structured with built-in rest periods. Designated Calm Zones are always available. Our Puppy Monitors watch for signs of fatigue and remove any puppy that needs a break.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Our Ethical Standards — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/ethics">Ethical Standards</a></nav>
</header>
<main>
  <h2>Puppy Welfare is Our Top Priority</h2>
  <p>At AfroPuppyYoga, we take the welfare of our puppies extremely seriously. Every puppy that participates in our sessions comes from a registered, ethical breeder who meets our strict welfare criteria. We never work with puppy mills or high-volume commercial breeders.</p>
  <h3>Our Four Core Commitments</h3>
  <ul>
    <li><strong>Ethical Sourcing:</strong> We partner only with responsible breeders and registered rescues — never puppy mills.</li>
    <li><strong>Puppy-Centered Classes:</strong> Calm Zones, rest breaks, and pet-safe sanitization ensure every pup is comfortable.</li>
    <li><strong>Supervised Interactions:</strong> Dedicated Puppy Monitors observe every class. Gentle handling rules are strictly enforced.</li>
    <li><strong>Responsible Socialization:</strong> Our controlled environment supports healthy development during the critical socialization window.</li>
  </ul>
  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>How old are the puppies at your classes?</dt>
    <dd>All puppies must be at least six weeks old and have received veterinary clearance and age-appropriate vaccinations before attending any AfroPuppyYoga event.</dd>
    <dt>Do you work with puppy mills?</dt>
    <dd>Absolutely not. We partner exclusively with responsible, ethical breeders and registered local rescue organizations.</dd>
    <dt>Are the puppies tired or stressed after a class?</dt>
    <dd>Puppy welfare is our top priority. Classes are structured with built-in rest periods. Designated Calm Zones are always available. Our Puppy Monitors watch for signs of fatigue and remove any puppy that needs a break.</dd>
  </dl>
  <p>Questions about our practices? <a href="/#contact">Contact us</a>.</p>
  <p>Want to become a breeder partner? <a href="/partnerships">Learn about our Breeder Partnership program.</a></p>
  <p><a href="/">Back to Home</a> | <a href="/careers">Join Our Team</a></p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/private-events/quote">Birthday Packages</a> | <a href="/partnerships">Partnerships</a> | <a href="/loyalty">Loyalty Program</a> | <a href="/careers">Careers</a>
</footer>
`,
    }),

  "/corporate-puppy-yoga": () =>
    buildHtml({
      title: "Corporate Puppy Yoga in Ontario | Team Wellness Events | AfroPuppyYoga",
      description:
        `AfroPuppyYoga: ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Standard 60-minute studio corporate puppy yoga for up to 20 guests from ${PRIVATE_EVENT_START_PRICE}. Puppy lounge and other formats: custom quotes across Ontario.`,
      canonical: `${BASE}/corporate-puppy-yoga`,
      schema: [
        breadcrumb({ name: "Corporate Puppy Yoga", url: `${BASE}/corporate-puppy-yoga` }),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": `${BASE}/corporate-puppy-yoga#service`,
          name: "Corporate Puppy Yoga",
          description: PRIVATE_EVENT_SERVICE_COPY,
          provider: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE },
          areaServed: { "@type": "State", name: "Ontario" },
          url: `${BASE}/corporate-puppy-yoga`,
          offers: privateEventStartingOffer(),
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Can our team choose puppy play without yoga?", acceptedAnswer: { "@type": "Answer", text: PRIVATE_EVENT_EXPERIENCE_COPY } },
            { "@type": "Question", name: "Can we arrange multiple sessions or drop-in rotations?", acceptedAnswer: { "@type": "Answer", text: `${PRIVATE_EVENT_SCHEDULE_COPY} ${PRIVATE_EVENT_FORMAT_PRICE_NOTE} ${PRIVATE_EVENT_CUSTOM_SCOPE_NOTE}` } },
            {
              "@type": "Question",
              name: "What is corporate puppy yoga?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Corporate puppy yoga is a guided yoga session with ethically sourced puppies, designed for workplace teams. It combines stress relief, light movement, and the proven mood-boosting effects of interacting with puppies — making it one of the most memorable and effective team wellness activities available.",
              },
            },
            {
              "@type": "Question",
              name: "How many people can attend a corporate puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `AfroPuppyYoga accommodates corporate groups from 6 to 50+ guests, subject to venue and availability. Standard events are up to 20 guests; groups of 21 or more require a custom quote. ${PRIVATE_EVENT_CUSTOM_NOTE}`,
              },
            },
            {
              "@type": "Question",
              name: "Can you come to our office for a corporate puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `Yes. We offer offsite corporate events at your office, boardroom, or suitable space across the Greater Toronto Area and ${PUBLIC_LOCATION_LIST}, subject to availability. ${PRIVATE_EVENT_TRAVEL_NOTE}`,
              },
            },
            {
              "@type": "Question",
              name: "How much does a corporate puppy yoga event cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: PRIVATE_EVENT_PRICING_COPY,
              },
            },
            {
              "@type": "Question",
              name: "What is included in a corporate puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: PRIVATE_EVENT_INCLUSIONS_COPY,
              },
            },
            {
              "@type": "Question",
              name: "Is yoga experience required for a corporate puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No experience is needed. Our certified instructors design every session to be accessible for all fitness levels, including complete beginners. The focus is on fun, connection, and stress relief — not athletic performance.",
              },
            },
            {
              "@type": "Question",
              name: "What companies have done corporate puppy yoga with AfroPuppyYoga?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AfroPuppyYoga has hosted corporate wellness events for teams from Manulife, Wilfrid Laurier University, University of Waterloo, McMaster University, University of Guelph, Brock University, F45 Training, and Scribenote, among others.",
              },
            },
            {
              "@type": "Question",
              name: "Does the music have to be Afrobeats for a corporate event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. While AfroPuppyYoga's public classes feature Afro-beat inspired music, corporate events can use a custom curated playlist suited to your team's preferences. We work with you to create the right atmosphere.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Corporate Puppy Yoga — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/corporate-puppy-yoga">Corporate Puppy Yoga</a></nav>
</header>
<main>
  <h2>Ontario's Most Unique Corporate Wellness Activity</h2>
  <p>AfroPuppyYoga brings guided yoga, adorable ethically-sourced puppies, and a feel-good curated soundtrack directly to your team. Whether you're planning an employee appreciation day, a mental health initiative, a team-building retreat, or a company milestone celebration — a corporate puppy yoga session is an experience your team will talk about for years.</p>
  <p>We have hosted corporate wellness events for teams from Manulife, Wilfrid Laurier University, University of Waterloo, McMaster University, University of Guelph, Brock University, F45 Training, and Scribenote. Groups from 6 to 50+ welcome.</p>

  ${PRIVATE_EVENT_EXPERIENCES_HTML}

  <h3>Why Corporate Puppy Yoga Works</h3>
  <ul>
    <li><strong>Proven stress relief:</strong> Interacting with puppies measurably reduces cortisol and increases oxytocin — backed by peer-reviewed research.</li>
    <li><strong>No experience required:</strong> Sessions are designed for all fitness levels, from complete beginners to active yogis.</li>
    <li><strong>Inclusive and memorable:</strong> Unlike typical team activities, puppy yoga creates genuine shared joy across diverse teams.</li>
    <li><strong>Flexible format:</strong> Partner venues in ${PUBLIC_LOCATION_LIST}, subject to availability, or we come to your office or venue.</li>
    <li><strong>Fully managed puppy yoga:</strong> Certified instructors, trained Puppy Monitors, mats and props, and a dedicated event host included in standard studio yoga. Lounge delivery is confirmed in its custom quote.</li>
  </ul>

  <h3>Standard Studio Puppy Yoga Package Options</h3>
  ${PRIVATE_EVENT_PACKAGES_HTML}

  <h3>What's Included in Standard Studio Puppy Yoga</h3>
  <p>${PRIVATE_EVENT_INCLUSIONS_COPY}</p>
  <ul>
    <li>Certified yoga instructor</li>
    <li>Ethically sourced puppies from registered breeders</li>
    <li>Trained Puppy Monitors throughout the session</li>
    <li>Custom curated playlist</li>
    <li>All yoga mats and props</li>
    <li>Dedicated event host</li>
    <li>Flexible scheduling including weekdays</li>
  </ul>

  <h3>Trusted by Ontario's Leading Organizations</h3>
  <p>Manulife · Wilfrid Laurier University · University of Waterloo · McMaster University · University of Guelph · Brock University · F45 Training · Scribenote</p>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>What is corporate puppy yoga?</dt>
    <dd>A guided yoga session with ethically sourced puppies, designed for workplace teams. It combines stress relief, light movement, and the proven mood-boosting effects of puppy interaction.</dd>
    <dt>How many people can attend?</dt>
    <dd>Groups from 6 to 50+, subject to venue and availability. Standard events are up to 20 guests; groups of 21 or more require a custom quote. ${PRIVATE_EVENT_CUSTOM_NOTE}</dd>
    <dt>Can you come to our office?</dt>
    <dd>Yes. We offer offsite events across the GTA and ${PUBLIC_LOCATION_LIST}, subject to availability. ${PRIVATE_EVENT_TRAVEL_NOTE}</dd>
    <dt>How much does it cost?</dt>
    <dd>${PRIVATE_EVENT_PRICING_COPY}</dd>
    <dt>What is included?</dt>
    <dd>${PRIVATE_EVENT_INCLUSIONS_COPY}</dd>
    <dt>Is yoga experience required?</dt>
    <dd>No. Sessions are designed for all fitness levels. The focus is on fun and stress relief, not athletic performance.</dd>
    <dt>Does the music have to be Afrobeats?</dt>
    <dd>No. Corporate events use a custom curated playlist suited to your team's preferences.</dd>
  </dl>

  <p><a href="/private-events/quote">Get an Instant Corporate Quote</a> | <a href="/partnerships">Explore Partnership Options</a></p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/private-events/quote">Private Event Quote</a> | <a href="/partnerships">Partnerships</a> | <a href="/puppy-yoga-kitchener">Kitchener</a> | <a href="/puppy-yoga-hamilton">Hamilton</a> | <a href="/puppy-yoga-oakville">Oakville</a>
</footer>
`,
    }),

  "/private-puppy-yoga-events": () =>
    buildHtml({
      title: "Private Puppy Yoga Events in Ontario | AfroPuppyYoga",
      description:
        `AfroPuppyYoga: ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Standard 60-minute studio puppy yoga for up to 20 guests from ${PRIVATE_EVENT_START_PRICE}. Puppy lounge and other formats: custom quotes across Ontario.`,
      canonical: `${BASE}/private-puppy-yoga-events`,
      schema: [
        breadcrumb({ name: "Private Puppy Yoga Events", url: `${BASE}/private-puppy-yoga-events` }),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Private Puppy Yoga Events",
          description: PRIVATE_EVENT_SERVICE_COPY,
          provider: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE },
          areaServed: { "@type": "State", name: "Ontario" },
          url: `${BASE}/private-puppy-yoga-events`,
          offers: privateEventStartingOffer(),
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Can we choose puppy yoga or puppy play without yoga?", acceptedAnswer: { "@type": "Answer", text: PRIVATE_EVENT_EXPERIENCE_COPY } },
            { "@type": "Question", name: "Can we arrange multiple sessions or drop-in rotations?", acceptedAnswer: { "@type": "Answer", text: `${PRIVATE_EVENT_SCHEDULE_COPY} ${PRIVATE_EVENT_FORMAT_PRICE_NOTE} ${PRIVATE_EVENT_CUSTOM_SCOPE_NOTE}` } },
            {
              "@type": "Question",
              name: "What types of private puppy yoga events does AfroPuppyYoga offer?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `AfroPuppyYoga offers private events for birthdays, bachelorette parties, bridal showers, corporate wellness days, team-building events, baby showers, student group events and brand activations. ${PRIVATE_EVENT_EXPERIENCE_COPY}`,
              },
            },
            {
              "@type": "Question",
              name: "How much does a private puppy yoga event cost in Ontario?",
              acceptedAnswer: {
                "@type": "Answer",
                text: PRIVATE_EVENT_PRICING_COPY,
              },
            },
            {
              "@type": "Question",
              name: "What is included in a private puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: PRIVATE_EVENT_INCLUSIONS_COPY,
              },
            },
            {
              "@type": "Question",
              name: "How far in advance do I need to book a private puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We recommend booking at least 3–4 weeks in advance for studio events, and 4–6 weeks for offsite or large corporate events. Popular weekend dates fill quickly.",
              },
            },
            {
              "@type": "Question",
              name: "Can AfroPuppyYoga host a private event at my venue?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `Yes. We offer offsite private events at your chosen venue across the Greater Toronto Area and ${PUBLIC_LOCATION_LIST}, subject to availability. ${PRIVATE_EVENT_TRAVEL_NOTE}`,
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Private Puppy Yoga Events — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/private-puppy-yoga-events">Private Events</a></nav>
</header>
<main>
  <h2>Make Any Occasion Unforgettable with a Private Puppy Yoga Event</h2>
  <p>AfroPuppyYoga brings the puppies, the yoga, and the good vibes directly to your private event. Whether you're celebrating a birthday, planning a bachelorette, organizing a corporate wellness day, or hosting a student group — a private puppy yoga session is an experience your guests will never forget.</p>
  <p>We serve groups from 6 to 50+ across ${PUBLIC_LOCATION_LIST}, Ontario, subject to venue, capacity and availability. Offsite events across the Greater Toronto Area are custom quoted.</p>

  ${PRIVATE_EVENT_EXPERIENCES_HTML}

  <h3>Private Event Types</h3>
  <ul>
    <li><strong>Birthday Parties:</strong> Celebrate with puppies, yoga, and your closest friends. All ages welcome.</li>
    <li><strong>Bachelorette &amp; Bridal Showers:</strong> The most unique bachelorette activity in Ontario.</li>
    <li><strong>Corporate Wellness Days:</strong> Employee appreciation, team-building, and stress relief in one session.</li>
    <li><strong>Student Group Events:</strong> Perfect for clubs, orientation events, and stress-relief sessions.</li>
    <li><strong>Baby Showers &amp; Gender Reveals:</strong> A warm, joyful celebration with puppies.</li>
    <li><strong>Brand Activations:</strong> Co-branded wellness events for lifestyle and pet brands.</li>
  </ul>

  <h3>Standard Studio Puppy Yoga Package Tiers</h3>
  ${PRIVATE_EVENT_PACKAGES_HTML}

  <h3>What's Included in Standard Studio Puppy Yoga</h3>
  <p>${PRIVATE_EVENT_INCLUSIONS_COPY}</p>
  <ul>
    <li>Certified yoga instructor</li>
    <li>Ethically sourced puppies from registered breeders</li>
    <li>Trained Puppy Monitors throughout the session</li>
    <li>Afro-beat inspired music soundtrack</li>
    <li>All yoga mats and props</li>
    <li>Dedicated event host</li>
  </ul>

  <h3>Locations</h3>
  <p>APY studio or partner space is arranged subject to venue and date availability; locations below are not guarantees for a private booking.</p>
  <ul>
    <li>Kitchener-Waterloo — TenC Dance Studio, 329 King St E, Kitchener</li>
    <li>Hamilton — Colibri Studio, 2751 Barton St E, Hamilton</li>
    <li>Oakville — 1670 North Service Rd E, Oakville</li>
    <li>Guelph — partner venue subject to availability; request a quote to confirm details</li>
    <li>Offsite — your venue across the GTA and surrounding regions; travel quoted separately</li>
  </ul>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>What types of private events do you offer?</dt>
    <dd>Birthdays, bachelorettes, corporate wellness days, team-building, baby showers, student group events, and brand activations.</dd>
    <dt>How much does a private event cost?</dt>
    <dd>${PRIVATE_EVENT_PRICING_COPY}</dd>
    <dt>What is included?</dt>
    <dd>${PRIVATE_EVENT_INCLUSIONS_COPY}</dd>
    <dt>How far in advance should I book?</dt>
    <dd>3–4 weeks for studio events, 4–6 weeks for offsite or large corporate events.</dd>
    <dt>Can you come to my venue?</dt>
    <dd>Yes. We offer offsite events across the GTA and ${PUBLIC_LOCATION_LIST}, subject to availability. ${PRIVATE_EVENT_TRAVEL_NOTE}</dd>
  </dl>

  <p><a href="/private-events/quote">Get an Instant Quote</a> | <a href="/corporate-puppy-yoga">Corporate Events</a></p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/private-events/quote">Get a Quote</a> | <a href="/corporate-puppy-yoga">Corporate</a> | <a href="/puppy-yoga-kitchener">Kitchener</a> | <a href="/puppy-yoga-hamilton">Hamilton</a> | <a href="/puppy-yoga-oakville">Oakville</a>
</footer>
`,
    }),

  "/puppy-yoga-kitchener": () =>
    buildHtml({
      title: "Puppy Yoga Kitchener-Waterloo | AfroPuppyYoga",
      description:
        `Puppy yoga in Kitchener-Waterloo at TenC Dance Studio. AfroPuppyYoga has ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Enjoy puppy cuddles and Afro-beat music. Book now.`,
      canonical: `${BASE}/puppy-yoga-kitchener`,
      schema: [
        breadcrumb({ name: "Puppy Yoga Kitchener", url: `${BASE}/puppy-yoga-kitchener` }),
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": `${BASE}/puppy-yoga-kitchener#business`,
          name: "AfroPuppyYoga — Kitchener-Waterloo",
          description: "Puppy yoga classes in Kitchener-Waterloo at TenC Dance Studio. Guided yoga with adorable puppies and Afro-beat music.",
          url: `${BASE}/puppy-yoga-kitchener`,
          telephone: "+12897881885",
          address: {
            "@type": "PostalAddress",
            streetAddress: "329 King St E",
            addressLocality: "Kitchener",
            addressRegion: "ON",
            postalCode: "N2G 2L3",
            addressCountry: "CA",
          },
          image: OG_IMAGE,
          sameAs: ["https://www.instagram.com/afropuppyyoga", "https://www.tiktok.com/@afropuppyyoga"],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Where is AfroPuppyYoga in Kitchener?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AfroPuppyYoga Kitchener classes are held at TenC Dance Studio, 329 King St E, Kitchener, ON N2G 2L3. The studio is located in downtown Kitchener with parking available nearby.",
              },
            },
            {
              "@type": "Question",
              name: "How much does puppy yoga in Kitchener cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Puppy yoga classes in Kitchener are booked through Luma. Ticket prices vary by date and tier, and the current price for each class is shown at checkout.",
              },
            },
            {
              "@type": "Question",
              name: "When are puppy yoga classes in Kitchener?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AfroPuppyYoga runs regular weekend classes in Kitchener-Waterloo. Check our Luma calendar at lu.ma/afropuppyyoga for the latest schedule and to book your spot.",
              },
            },
            {
              "@type": "Question",
              name: "Is AfroPuppyYoga Kitchener good for beginners?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes! All AfroPuppyYoga classes are designed for all levels, from complete beginners to experienced yogis. No yoga experience is required — just bring comfortable clothes and an open mind.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Puppy Yoga Kitchener-Waterloo — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/puppy-yoga-kitchener">Puppy Yoga Kitchener</a></nav>
</header>
<main>
  <h2>Ontario's #1 Puppy Yoga Experience — Now in Kitchener-Waterloo</h2>
  <p>AfroPuppyYoga brings guided yoga, Afro-beat rhythms, and a litter of adorable puppies to downtown Kitchener. Whether you're a seasoned yogi or a complete beginner, our classes are designed to be joyful, accessible, and deeply relaxing.</p>
  <p>Classes are held at <strong>TenC Dance Studio, 329 King St E, Kitchener, ON N2G 2L3</strong>.</p>

  <h3>What to Expect</h3>
  <ul>
    <li>60-minute guided yoga session with a certified instructor</li>
    <li>Afro-beat inspired music soundtrack</li>
    <li>A litter of ethically sourced puppies roaming freely</li>
    <li>Dedicated Puppy Monitors ensuring puppy welfare throughout</li>
    <li>All yoga mats and props provided</li>
    <li>All levels welcome — no experience required</li>
  </ul>

  <h3>Pricing</h3>
  <ul>
    <li><strong>Early Bird Ticket:</strong> discounted rate for early bookings</li>
    <li><strong>Regular Ticket:</strong> standard single admission</li>
    <li><strong>Bring a Friend (2 tickets):</strong> reduced per-person rate</li>
    <li><strong>Group of 3:</strong> reduced per-person rate</li>
  </ul>

  <h3>Location</h3>
  <address>
    TenC Dance Studio<br />
    329 King St E<br />
    Kitchener, ON N2G 2L3
  </address>
  <p>Located in downtown Kitchener, easily accessible from Waterloo, Cambridge, and Guelph.</p>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>Where is AfroPuppyYoga in Kitchener?</dt>
    <dd>TenC Dance Studio, 329 King St E, Kitchener, ON N2G 2L3.</dd>
    <dt>How much does it cost?</dt>
    <dd>Ticket prices vary by date and tier. Current prices for each class are shown at checkout on our Luma booking page.</dd>
    <dt>When are classes?</dt>
    <dd>Regular weekend classes. Check lu.ma/afropuppyyoga for the latest schedule.</dd>
    <dt>Do I need yoga experience?</dt>
    <dd>No. All levels welcome — complete beginners to experienced yogis.</dd>
  </dl>

  <p><a href="https://lu.ma/afropuppyyoga">Book a Class in Kitchener</a> | <a href="/private-events/quote">Book a Private Event</a></p>
  <p>Also available in <a href="/puppy-yoga-hamilton">Hamilton</a> and <a href="/puppy-yoga-oakville">Oakville</a>.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/puppy-yoga-hamilton">Hamilton</a> | <a href="/puppy-yoga-oakville">Oakville</a> | <a href="/private-events/quote">Private Events</a> | <a href="/corporate-puppy-yoga">Corporate</a>
</footer>
`,
    }),

  "/puppy-yoga-hamilton": () =>
    buildHtml({
      title: "Puppy Yoga Hamilton Ontario | AfroPuppyYoga",
      description:
        `Puppy yoga in Hamilton at Colibri Studio, 2751 Barton Street East. AfroPuppyYoga has ${FIVE_STAR_REVIEW_COUNT} five-star reviews. See dates and book your class.`,
      canonical: `${BASE}/puppy-yoga-hamilton`,
      schema: [
        breadcrumb({ name: "Puppy Yoga Hamilton", url: `${BASE}/puppy-yoga-hamilton` }),
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": `${BASE}/puppy-yoga-hamilton#business`,
          name: "AfroPuppyYoga — Hamilton",
          description: "Puppy yoga classes in Hamilton at Colibri Studio. Guided yoga with adorable puppies and Afro-beat music.",
          url: `${BASE}/puppy-yoga-hamilton`,
          telephone: "+12897881885",
          address: {
            "@type": "PostalAddress",
            streetAddress: "2751 Barton Street East",
            addressLocality: "Hamilton",
            addressRegion: "ON",
            postalCode: "L8E 2J8",
            addressCountry: "CA",
          },
          image: OG_IMAGE,
          sameAs: ["https://www.instagram.com/afropuppyyoga", "https://www.tiktok.com/@afropuppyyoga"],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Where is AfroPuppyYoga in Hamilton?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Our main Hamilton studio is Colibri Studio, 2751 Barton Street East, Hamilton, ON L8E 2J8. Something New, 416 Concession Street, Hamilton, ON L9A 1B9, is a collaboration location for selected events only. Check your selected Luma event's venue before booking.",
              },
            },
            {
              "@type": "Question",
              name: "How much does puppy yoga in Hamilton cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Puppy yoga classes in Hamilton are booked through Luma. Ticket prices vary by date and tier, and the current price for each class is shown at checkout.",
              },
            },
            {
              "@type": "Question",
              name: "When are puppy yoga classes in Hamilton?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AfroPuppyYoga runs regular classes in Hamilton. Check our Luma calendar at lu.ma/afropuppyyoga for the latest Hamilton schedule and to book your spot.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Puppy Yoga Hamilton — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/puppy-yoga-hamilton">Puppy Yoga Hamilton</a></nav>
</header>
<main>
  <h2>Puppy Yoga in Hamilton, Ontario</h2>
  <p>AfroPuppyYoga brings guided yoga, Afro-beat rhythms, and a litter of adorable puppies to Hamilton. Our main Hamilton studio is <strong>Colibri Studio, 2751 Barton Street East, Hamilton, ON L8E 2J8</strong>.</p>
  <p>Something New, 416 Concession Street, Hamilton, ON L9A 1B9, is a collaboration location for selected events only. Check your chosen Luma event's venue before booking.</p>
  <p>Whether you're a seasoned yogi or a complete beginner, our Hamilton classes are designed to be joyful, accessible, and deeply relaxing. All levels welcome — no yoga experience required.</p>

  <h3>What to Expect</h3>
  <ul>
    <li>60-minute guided yoga session with a certified instructor</li>
    <li>Afro-beat inspired music soundtrack</li>
    <li>A litter of ethically sourced puppies roaming freely</li>
    <li>Dedicated Puppy Monitors ensuring puppy welfare throughout</li>
    <li>All yoga mats and props provided</li>
  </ul>

  <h3>Pricing</h3>
  <ul>
    <li><strong>Early Bird Ticket:</strong> discounted rate for early bookings</li>
    <li><strong>Regular Ticket:</strong> standard single admission</li>
    <li><strong>Bring a Friend (2 tickets):</strong> reduced per-person rate</li>
    <li><strong>Group of 3:</strong> reduced per-person rate</li>
  </ul>

  <h3>Location</h3>
  <address>
    Colibri Studio (Main Studio)<br />
    2751 Barton Street East<br />
    Hamilton, ON L8E 2J8
  </address>
  <p>Collaboration location: Something New, 416 Concession Street, Hamilton, ON L9A 1B9.</p>
  <p>Easily accessible from Burlington, Stoney Creek, and the greater Hamilton area.</p>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>Where is AfroPuppyYoga in Hamilton?</dt>
    <dd>Our main studio is Colibri Studio, 2751 Barton Street East, Hamilton, ON L8E 2J8. Some collaboration events use Something New, 416 Concession Street. Check the venue on your selected event before booking.</dd>
    <dt>How much does it cost?</dt>
    <dd>Ticket prices vary by date and tier. Current prices for each class are shown at checkout on our Luma booking page.</dd>
    <dt>When are classes?</dt>
    <dd>Regular classes in Hamilton. Check lu.ma/afropuppyyoga for the latest schedule.</dd>
    <dt>Do I need yoga experience?</dt>
    <dd>No. All levels welcome.</dd>
  </dl>

  <p><a href="https://lu.ma/afropuppyyoga">Book a Class in Hamilton</a> | <a href="/private-events/quote">Book a Private Event</a></p>
  <p>Also available in <a href="/puppy-yoga-kitchener">Kitchener-Waterloo</a> and <a href="/puppy-yoga-oakville">Oakville</a>.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/puppy-yoga-kitchener">Kitchener</a> | <a href="/puppy-yoga-oakville">Oakville</a> | <a href="/private-events/quote">Private Events</a> | <a href="/corporate-puppy-yoga">Corporate</a>
</footer>
`,
    }),

  "/puppy-yoga-oakville": () =>
    buildHtml({
      title: "Puppy Yoga Oakville Ontario | AfroPuppyYoga",
      description:
        `Puppy yoga in Oakville, Ontario. AfroPuppyYoga has ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Enjoy puppy cuddles and Afro-beat music. Book your class.`,
      canonical: `${BASE}/puppy-yoga-oakville`,
      schema: [
        breadcrumb({ name: "Puppy Yoga Oakville", url: `${BASE}/puppy-yoga-oakville` }),
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": `${BASE}/puppy-yoga-oakville#business`,
          name: "AfroPuppyYoga — Oakville",
          description: "Puppy yoga classes in Oakville, Ontario. Guided yoga with adorable puppies and Afro-beat music.",
          url: `${BASE}/puppy-yoga-oakville`,
          telephone: "+12897881885",
          areaServed: { "@type": "City", name: "Oakville" },
          image: OG_IMAGE,
          sameAs: ["https://www.instagram.com/afropuppyyoga", "https://www.tiktok.com/@afropuppyyoga"],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Where is AfroPuppyYoga in Oakville?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AfroPuppyYoga Oakville classes are held at 1670 North Service Rd E, Oakville, ON. Check our Luma calendar for the exact venue for each upcoming session.",
              },
            },
            {
              "@type": "Question",
              name: "How much does puppy yoga in Oakville cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Puppy yoga classes in Oakville are booked through Luma. Ticket prices vary by date and tier, and the current price for each class is shown at checkout.",
              },
            },
            {
              "@type": "Question",
              name: "When are puppy yoga classes in Oakville?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AfroPuppyYoga runs regular classes in Oakville. Check our Luma calendar at lu.ma/afropuppyyoga for the latest Oakville schedule and to book your spot.",
              },
            },
            {
              "@type": "Question",
              name: "Is Oakville a new AfroPuppyYoga location?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. AfroPuppyYoga launched in Oakville in June 2026, making it our third Ontario location alongside Kitchener-Waterloo and Hamilton. We are excited to bring puppy yoga to the Oakville and Halton Region community.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Puppy Yoga Oakville — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/puppy-yoga-oakville">Puppy Yoga Oakville</a></nav>
</header>
<main>
  <h2>Puppy Yoga in Oakville, Ontario</h2>
  <p>AfroPuppyYoga has launched in Oakville! Join us for guided yoga, Afro-beat rhythms, and a litter of adorable puppies at our newest Ontario location. Classes are held at <strong>1670 North Service Rd E, Oakville, ON</strong>.</p>
  <p>Whether you're a seasoned yogi or a complete beginner, our Oakville classes are designed to be joyful, accessible, and deeply relaxing. All levels welcome — no yoga experience required.</p>

  <h3>What to Expect</h3>
  <ul>
    <li>60-minute guided yoga session with a certified instructor</li>
    <li>Afro-beat inspired music soundtrack</li>
    <li>A litter of ethically sourced puppies roaming freely</li>
    <li>Dedicated Puppy Monitors ensuring puppy welfare throughout</li>
    <li>All yoga mats and props provided</li>
  </ul>

  <h3>Pricing</h3>
  <ul>
    <li><strong>Early Bird Ticket:</strong> discounted rate for early bookings</li>
    <li><strong>Regular Ticket:</strong> standard single admission</li>
    <li><strong>Bring a Friend (2 tickets):</strong> reduced per-person rate</li>
    <li><strong>Group of 3:</strong> reduced per-person rate</li>
  </ul>

  <h3>Location</h3>
  <address>
    1670 North Service Rd E<br />
    Oakville, ON
  </address>
  <p>Conveniently located in Oakville, accessible from Mississauga, Burlington, and the Halton Region.</p>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>Where is AfroPuppyYoga in Oakville?</dt>
    <dd>1670 North Service Rd E, Oakville, ON. Check Luma for the exact venue for each upcoming session.</dd>
    <dt>How much does it cost?</dt>
    <dd>Ticket prices vary by date and tier. Current prices for each class are shown at checkout on our Luma booking page.</dd>
    <dt>When are classes?</dt>
    <dd>Regular classes in Oakville. Check lu.ma/afropuppyyoga for the latest schedule.</dd>
    <dt>Is this a new location?</dt>
    <dd>Yes. AfroPuppyYoga launched in Oakville in June 2026 — our third Ontario location.</dd>
  </dl>

  <p><a href="https://lu.ma/afropuppyyoga">Book a Class in Oakville</a> | <a href="/private-events/quote">Book a Private Event</a></p>
  <p>Also available in <a href="/puppy-yoga-kitchener">Kitchener-Waterloo</a> and <a href="/puppy-yoga-hamilton">Hamilton</a>.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/puppy-yoga-kitchener">Kitchener</a> | <a href="/puppy-yoga-hamilton">Hamilton</a> | <a href="/private-events/quote">Private Events</a> | <a href="/corporate-puppy-yoga">Corporate</a>
</footer>
`,
    }),

  "/private-events/quote": () =>
    buildHtml({
      title: "Private Puppy Yoga Event Quote | AfroPuppyYoga",
      description:
        `AfroPuppyYoga: ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Standard 60-minute studio puppy yoga for up to 20 guests from ${PRIVATE_EVENT_START_PRICE}. Puppy lounge, multiple sessions and other formats: full custom quotes across Ontario.`,
      canonical: `${BASE}/private-events/quote`,
      schema: [
        breadcrumb(
          { name: "Private Events", url: `${BASE}/#private-events` },
          { name: "Get a Quote", url: `${BASE}/private-events/quote` }
        ),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Private Puppy Yoga Events",
          description: PRIVATE_EVENT_SERVICE_COPY,
          url: `${BASE}/private-events/quote`,
          provider: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE },
          areaServed: { "@type": "State", name: "Ontario" },
          offers: privateEventStartingOffer(),
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Which private event experiences can I choose?", acceptedAnswer: { "@type": "Answer", text: PRIVATE_EVENT_EXPERIENCE_COPY } },
            { "@type": "Question", name: "Can we arrange multiple sessions or drop-in rotations?", acceptedAnswer: { "@type": "Answer", text: `${PRIVATE_EVENT_SCHEDULE_COPY} ${PRIVATE_EVENT_FORMAT_PRICE_NOTE} ${PRIVATE_EVENT_CUSTOM_SCOPE_NOTE}` } },
            {
              "@type": "Question",
              name: "How much does a private puppy yoga event cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: PRIVATE_EVENT_PRICING_COPY,
              },
            },
            {
              "@type": "Question",
              name: "Where can you host a private puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `We arrange private events at partner venues in ${PUBLIC_LOCATION_LIST}, subject to availability. We also offer offsite events at your chosen venue across the Greater Toronto Area and surrounding regions. ${PRIVATE_EVENT_TRAVEL_NOTE}`,
              },
            },
            {
              "@type": "Question",
              name: "What is included in a private puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: PRIVATE_EVENT_INCLUSIONS_COPY,
              },
            },
            {
              "@type": "Question",
              name: "How far in advance should I book a private event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We recommend booking at least 3–4 weeks in advance to ensure puppy and venue availability. For large corporate events or events requiring travel, 4–6 weeks is preferred.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Private Puppy Yoga Event Quote — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; Private Events &rsaquo; <a href="/private-events/quote">Get a Quote</a></nav>
</header>
<main>
  <h2>Get an Instant Quote for Your Private Puppy Yoga Event</h2>
  <p>AfroPuppyYoga offers guided puppy yoga and supervised puppy lounges for corporate wellness days, birthday parties, bachelorette parties, baby showers and team-building events across Ontario. Choose your experience, then your schedule and venue. Indicative bands apply only to standard 60-minute studio puppy yoga for up to 20 guests; other scopes receive a full custom quote. Final scope, date, availability and delivery costs are confirmed before booking.</p>

  ${PRIVATE_EVENT_EXPERIENCES_HTML}

  <h3>Why Book a Private Event?</h3>
  <ul>
    <li>Exclusive session — just your group and the puppies</li>
    <li>Flexible scheduling, including weekdays for corporate events</li>
    <li>Partner venues in ${PUBLIC_LOCATION_LIST}, subject to availability, or offsite at your venue</li>
    <li>Certified yoga instructors for puppy yoga; supervised puppy interaction without a guided yoga class in the lounge</li>
    <li>Customizable packages: Classic, Signature, and Luxury tiers</li>
    <li>Professional photography and enhanced setup in Signature; refreshment, branded merchandise, and other option inclusions depend on the selected package or confirmed quote</li>
  </ul>

  <h3>Standard Studio Puppy Yoga Packages</h3>
  ${PRIVATE_EVENT_PACKAGES_HTML}

  <h3>Who Books Private Events?</h3>
  <p>Our private events are popular with:</p>
  <ul>
    <li>Corporate teams and HR departments (mental health days, team appreciation)</li>
    <li>Bachelorette and bridal parties</li>
    <li>Birthday celebrations</li>
    <li>Baby showers and gender reveals</li>
    <li>School and community groups</li>
    <li>Fitness studios and wellness brands looking for co-branded events</li>
  </ul>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>How much does a private event cost?</dt>
    <dd>${PRIVATE_EVENT_PRICING_COPY}</dd>
    <dt>Where can you host a private event?</dt>
    <dd>We arrange partner venues in ${PUBLIC_LOCATION_LIST}, subject to availability, and offsite across the GTA and surrounding regions. ${PRIVATE_EVENT_TRAVEL_NOTE}</dd>
    <dt>What is included?</dt>
    <dd>${PRIVATE_EVENT_INCLUSIONS_COPY}</dd>
    <dt>How far in advance should I book?</dt>
    <dd>We recommend 3–4 weeks for studio events and 4–6 weeks for offsite or large corporate events.</dd>
  </dl>

  <p><a href="/private-events/quote">Get Your Instant Quote</a></p>
  <p>Also explore our <a href="/partnerships">Corporate Partnership</a> options.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/partnerships">Partnerships</a> | <a href="/loyalty">Loyalty Program</a> | <a href="/ethics">Ethical Standards</a> | <a href="/careers">Careers</a>
</footer>
`,
    }),
};

/** Return only an explicit public page, using Wouter's decoding and slash rules. */
export function getPublicSeoSnapshot(path: string): string | undefined {
  let decoded: string;
  try { decoded = decodeURI(path); } catch { return undefined; }
  if (!decoded.startsWith("/")) return undefined;
  const normalized = decoded.toLowerCase().replace(/\/$/, "") || "/";
  // Wouter permits at most one trailing slash, including at the root.
  if (decoded !== "/" && normalized.endsWith("/")) return undefined;
  return Object.hasOwn(PAGES, normalized) ? PAGES[normalized]() : undefined;
}

/** Apply internal document protections before any crawler snapshot is considered. */
export function protectInternalDocument(req: Request, res: Response): boolean {
  let pathname = (req.originalUrl || req.path).split("?", 1)[0];
  try { pathname = decodeURI(pathname); } catch { /* Match Wouter's fallback. */ }
  pathname = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (pathname === "/admin" || pathname.startsWith("/admin/") ||
      pathname === "/staff" || pathname.startsWith("/staff/") ||
      ["/admin-login", "/staff-login", "/staff-access", "/submit-invoice", "/sign", "/predictor",
        "/breeder-calculator", "/breeder-availability", "/404"].includes(pathname)) {
    res.set({
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cache-Control": "private, no-store",
      "Surrogate-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    return true;
  }
  return false;
}

export function hasNoindex(res: Response): boolean {
  return /\bnoindex\b/i.test(String(typeof res.getHeader === "function" ? res.getHeader("X-Robots-Tag") || "" : ""));
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function seoRenderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const protectedDocument = protectInternalDocument(req, res);
  if (protectedDocument || hasNoindex(res)) return next();
  if (req.path.startsWith("/api/")) return next();
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|json|xml|txt)$/)) return next();

  // Only serve to crawlers
  if (!isCrawler(req)) return next();

  const html = getPublicSeoSnapshot((req.originalUrl || req.path).split("?", 1)[0]);

  // A snapshot list is not an exhaustive SPA/server route registry. Unknown
  // paths (including staff, signing, and future routes) must reach the app.
  if (!html) return next();

  // Preserve upstream cache variation (for example, Accept-Encoding).
  const existingVary = typeof res.getHeader === "function" ? res.getHeader("Vary") : undefined;
  const vary = Array.isArray(existingVary) ? existingVary.join(", ") : String(existingVary || "");
  const varyFields = vary.split(",").map(value => value.trim()).filter(Boolean);
  if (!varyFields.some(value => value === "*" || value.toLowerCase() === "user-agent")) varyFields.push("User-Agent");
  res.status(200).set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Surrogate-Control": "no-store",
    "Vary": varyFields.join(", "),
  }).end(html);
}
