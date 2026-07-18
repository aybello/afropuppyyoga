/**
 * SEO Dynamic Renderer
 *
 * When a search engine crawler visits the site, we return a fully-rendered
 * HTML page with all key content baked in — no JavaScript required.
 * Real users always get the normal React SPA.
 *
 * This follows Google's recommended "dynamic rendering" pattern for SPAs:
 * https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
 */

import { type Request, type Response, type NextFunction } from "express";

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
</body>
</html>`;
}

// ─── Shared Schema Fragments ──────────────────────────────────────────────────

const BASE = "https://afropuppyyoga.ca";

const OG_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og-image_139020fe.png";

/** Canonical LocalBusiness schema — synced with client/index.html */
const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${BASE}/#business`,
  name: "AfroPuppyYoga",
  description:
    "Ontario's #1 puppy yoga studio. Guided yoga, Afro-beat rhythms and adorable puppies in Hamilton, Kitchener-Waterloo and Oakville, Ontario.",
  url: BASE,
  logo: {
    "@type": "ImageObject",
    url: OG_IMAGE,
    width: 1200,
    height: 630,
  },
  image: OG_IMAGE,
  telephone: "+12897881885",
  email: "afropuppyyogaofficial@gmail.com",
  priceRange: "$$",
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
  areaServed: [
    {
      "@type": "City",
      name: "Kitchener",
      containedInPlace: { "@type": "State", name: "Ontario" },
    },
    {
      "@type": "City",
      name: "Hamilton",
      containedInPlace: { "@type": "State", name: "Ontario" },
    },
    {
      "@type": "City",
      name: "Oakville",
      containedInPlace: { "@type": "State", name: "Ontario" },
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    // Phase 9 (security hardening): updated to match client-side values (LocationPage.tsx, Reviews.tsx)
    ratingValue: "4.9",
    reviewCount: "494",
    bestRating: "5",
    worstRating: "1",
  },
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
  "/": () =>
    buildHtml({
      title: "AfroPuppyYoga | Ontario's #1 Puppy Yoga Experience",
      description:
        "Ontario's #1 puppy yoga studio. Guided yoga, Afro-beat rhythms & adorable puppies in Hamilton, Kitchener-Waterloo & Oakville, Ontario. Book your class today!",
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
                text: "AfroPuppyYoga currently runs classes in Kitchener-Waterloo (TenC Dance Studio, 329 King St E), Hamilton (Colibri Studio, 2751 Barton St E), and Oakville. Check our booking page for upcoming dates at each location.",
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
        // Event schema — 3 top-level Event objects (Google rich results compatible)
        { "@context": "https://schema.org", "@type": "Event", name: "AfroPuppyYoga \u2014 Kitchener-Waterloo", description: "Guided yoga with adorable puppies and Afro-beat music. Every Saturday and Sunday at TenC Dance Studio, Kitchener.", startDate: "2026-07-19T10:00:00-04:00", endDate: "2026-07-19T11:30:00-04:00", eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: { "@type": "Place", name: "TenC Dance Studio", address: { "@type": "PostalAddress", streetAddress: "329 King St E", addressLocality: "Kitchener", addressRegion: "ON", postalCode: "N2G 2L3", addressCountry: "CA" } }, organizer: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE }, url: "https://lu.ma/afropuppyyoga", image: OG_IMAGE, offers: { "@type": "Offer", url: "https://lu.ma/afropuppyyoga", priceCurrency: "CAD", price: "55", availability: "https://schema.org/InStock", validFrom: "2026-01-01" } },
        { "@context": "https://schema.org", "@type": "Event", name: "AfroPuppyYoga \u2014 Hamilton", description: "Guided yoga with adorable puppies and Afro-beat music. Regular sessions at Colibri Studio, Hamilton.", startDate: "2026-07-19T10:00:00-04:00", endDate: "2026-07-19T11:30:00-04:00", eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: { "@type": "Place", name: "Colibri Studio", address: { "@type": "PostalAddress", streetAddress: "2751 Barton St E", addressLocality: "Hamilton", addressRegion: "ON", addressCountry: "CA" } }, organizer: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE }, url: "https://lu.ma/afropuppyyoga", image: OG_IMAGE, offers: { "@type": "Offer", url: "https://lu.ma/afropuppyyoga", priceCurrency: "CAD", price: "55", availability: "https://schema.org/InStock", validFrom: "2026-01-01" } },
        { "@context": "https://schema.org", "@type": "Event", name: "AfroPuppyYoga \u2014 Oakville", description: "Guided yoga with adorable puppies and Afro-beat music. Regular sessions in Oakville, Ontario.", startDate: "2026-07-20T10:00:00-04:00", endDate: "2026-07-20T11:30:00-04:00", eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: { "@type": "Place", name: "Oakville", address: { "@type": "PostalAddress", addressLocality: "Oakville", addressRegion: "ON", addressCountry: "CA" } }, organizer: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE }, url: "https://lu.ma/afropuppyyoga", image: OG_IMAGE, offers: { "@type": "Offer", url: "https://lu.ma/afropuppyyoga", priceCurrency: "CAD", price: "55", availability: "https://schema.org/InStock", validFrom: "2026-01-01" } },
        // Review schema — 6 verified guest reviews
        { "@context": "https://schema.org", "@type": "Review", itemReviewed: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE }, author: { "@type": "Person", name: "Sheila Soares" }, reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" }, reviewBody: "So fun and well run! Highly recommend this experience. The puppies were adorable and the yoga instructor was amazing. Will definitely be back!", datePublished: "2025-06-01" },
        { "@context": "https://schema.org", "@type": "Review", itemReviewed: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE }, author: { "@type": "Person", name: "Cameron T." }, reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" }, reviewBody: "Absolutely incredible experience! The Afro-beat music, the puppies, the yoga \u2014 everything was perfectly curated. I've never felt so relaxed and happy at the same time.", datePublished: "2025-05-01" },
        { "@context": "https://schema.org", "@type": "Review", itemReviewed: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE }, author: { "@type": "Person", name: "Priya M." }, reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" }, reviewBody: "Brought my whole friend group for a birthday celebration and everyone LOVED it. The staff were so welcoming and the puppies were pure joy. 10/10 would recommend!", datePublished: "2025-04-01" },
        { "@context": "https://schema.org", "@type": "Review", itemReviewed: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE }, author: { "@type": "Person", name: "Jessica L." }, reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" }, reviewBody: "I was nervous as a yoga beginner but the instructor made it so accessible and fun. The puppies kept interrupting my poses in the best way possible. Laughed the whole time!", datePublished: "2025-04-01" },
        { "@context": "https://schema.org", "@type": "Review", itemReviewed: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE }, author: { "@type": "Person", name: "Marcus R." }, reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" }, reviewBody: "Took my partner here for our anniversary. The vibe was immaculate \u2014 Afro beats, cute puppies, good energy. We're already planning our next visit.", datePublished: "2025-03-01" },
        { "@context": "https://schema.org", "@type": "Review", itemReviewed: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE }, author: { "@type": "Person", name: "Aisha B." }, reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" }, reviewBody: "As someone who does yoga regularly, this was such a refreshing twist. The cultural element with the music and the warmth of the instructors made it feel truly special.", datePublished: "2025-02-01" },
        // VideoObject schema — 3 Instagram reels with valid contentUrl and duration
        { "@context": "https://schema.org", "@type": "VideoObject", name: "AfroPuppyYoga Guest Review \u2014 What Our Guests Are Saying", description: "A guest shares their experience at AfroPuppyYoga puppy yoga class in Ontario.", thumbnailUrl: OG_IMAGE, contentUrl: "https://www.instagram.com/reel/DV99b-vDPCy/", embedUrl: "https://www.instagram.com/reel/DV99b-vDPCy/embed", uploadDate: "2025-05-01", duration: "PT0M45S", publisher: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE } },
        { "@context": "https://schema.org", "@type": "VideoObject", name: "AfroPuppyYoga Guest Review \u2014 Another Happy Guest", description: "Another happy guest shares their AfroPuppyYoga experience.", thumbnailUrl: OG_IMAGE, contentUrl: "https://www.instagram.com/reel/DVKKYGIEa4-/", embedUrl: "https://www.instagram.com/reel/DVKKYGIEa4-/embed", uploadDate: "2025-04-01", duration: "PT0M38S", publisher: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE } },
        { "@context": "https://schema.org", "@type": "VideoObject", name: "AfroPuppyYoga \u2014 Fun Times at Puppy Yoga", description: "Fun and joyful moments from AfroPuppyYoga classes.", thumbnailUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/YsmvRsuruPouMOgB.jpg", contentUrl: "https://www.instagram.com/reel/DZ7SyjbRYPb/", embedUrl: "https://www.instagram.com/reel/DZ7SyjbRYPb/embed", uploadDate: "2025-06-15", duration: "PT0M30S", publisher: { "@type": "Organization", name: "AfroPuppyYoga", url: BASE } },
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
    <p>Serving Hamilton, Kitchener-Waterloo &amp; Oakville, Ontario. Ontario's #1 puppy yoga studio.</p>
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
      <li>Available in Hamilton, Kitchener, and Oakville</li>
    </ul>
  </section>

  <section id="memberships">
    <h2>Memberships &amp; Pricing</h2>
    <p>Join our community with a monthly membership or book individual classes.</p>
    <ul>
      <li><strong>Early Bird Ticket:</strong> $55</li>
      <li><strong>Regular Ticket:</strong> $55</li>
      <li><strong>Bring a Friend Package:</strong> $55 per person</li>
      <li><strong>Group of 3 Package:</strong> $55 per person</li>
      <li><strong>Monthly Membership:</strong> Unlimited classes at a discounted rate</li>
    </ul>
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
  </section>

  <section id="about">
    <h2>About AfroPuppyYoga</h2>
    <p>AfroPuppyYoga was founded to create a unique wellness space that celebrates Black culture, community, and joy. We blend the ancient practice of yoga with the infectious energy of Afro-beat music and the undeniable happiness that puppies bring. Our studio is a safe, inclusive, and uplifting space for everyone.</p>
    <p>We are proud to be Ontario's #1 puppy yoga studio, with over 494 five-star reviews and thousands of happy participants across Ontario.</p>
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
      <dd>We hold classes in Hamilton (Colibri Studio, 2751 Barton St E), Kitchener (TenC Dance Studio, 329 King St E), and Oakville, Ontario.</dd>

      <dt>How much does a class cost?</dt>
      <dd>Classes start at $55. Bring-a-friend and group packages are also available.</dd>

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
    <p>Email: <a href="mailto:afropuppyyogaofficial@gmail.com">afropuppyyogaofficial@gmail.com</a></p>
    <p>Phone: <a href="tel:+12897881885">289-788-1885</a></p>
    <p>Instagram: <a href="https://www.instagram.com/afropuppyyoga">@afropuppyyoga</a></p>
    <p>TikTok: <a href="https://www.tiktok.com/@afropuppyyoga">@afropuppyyoga</a></p>
  </section>
</main>

<footer>
  <p>&copy; 2025 AfroPuppyYoga. All rights reserved.</p>
  <p>Ontario's #1 Puppy Yoga Studio | Hamilton | Kitchener | Oakville | Ontario</p>
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
        "Join the AfroPuppyYoga team! We're looking for passionate yoga instructors, event coordinators, and puppy handlers in Hamilton, Kitchener, and Oakville, Ontario.",
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
  <p>We hire yoga instructors, Puppy Monitors, Puppy Specialists, and event coordinators across our Hamilton, Kitchener, and Oakville locations. Submit your application and video introduction to be considered for upcoming openings.</p>
  <ul>
    <li>Yoga Instructor — Kitchener-Waterloo</li>
    <li>Yoga Instructor — Hamilton / Brantford</li>
    <li>Puppy Monitor — Kitchener-Waterloo</li>
    <li>Puppy Monitor — Hamilton</li>
  </ul>
  <p>To apply, visit our <a href="/careers">Careers page</a> and submit your application.</p>
  <p>Learn more about <a href="/partnerships">Breeder Partnerships</a> or explore our <a href="/ethics">Ethical Standards</a>.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/partnerships">Partnerships</a> | <a href="/ethics">Ethical Standards</a>
</footer>
`,
    }),

  "/birthday": () =>
    buildHtml({
      title: "Birthday Puppy Yoga Parties | AfroPuppyYoga",
      description:
        "Celebrate your birthday with a private puppy yoga party! AfroPuppyYoga offers unforgettable birthday experiences in Hamilton, Kitchener, and Oakville, Ontario.",
      canonical: `${BASE}/private-events/quote`,
      schema: [
        breadcrumb({ name: "Birthday Packages", url: `${BASE}/birthday` }),
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How far in advance should I book a birthday puppy yoga party?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We recommend booking at least 2–3 weeks in advance to secure your preferred date and location. Popular dates fill up quickly, especially on weekends.",
              },
            },
            {
              "@type": "Question",
              name: "How many people can attend a birthday puppy yoga party?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Our birthday packages accommodate groups of up to 20 guests for the Classic package. Larger groups can be accommodated with our Premium or Deluxe packages.",
              },
            },
            {
              "@type": "Question",
              name: "Can I bring a birthday cake?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes! You are welcome to bring a birthday cake or other treats for your group. Please let us know in advance so we can plan accordingly.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>Birthday Puppy Yoga Parties — AfroPuppyYoga</h1>
  <nav><a href="/">Home</a> &rsaquo; <a href="/birthday">Birthday Packages</a></nav>
</header>
<main>
  <h2>Make Your Birthday Unforgettable</h2>
  <p>Celebrate your special day with a private puppy yoga party from AfroPuppyYoga! Our birthday packages include a guided yoga session, Afro-beat music, and a litter of adorable puppies — plus a dedicated host to make your event seamless.</p>
  <h3>Birthday Package Tiers</h3>
  <ul>
    <li><strong>Basic Package ($600):</strong> Up to 10 guests, 45-minute session, studio venue</li>
    <li><strong>Premium Package ($900):</strong> Up to 15 guests, 60-minute session, studio venue, photography add-on</li>
    <li><strong>Deluxe Package ($1,200+):</strong> Up to 20 guests, 75-minute session, custom experience, merchandise</li>
  </ul>
  <h3>What's Included</h3>
  <ul>
    <li>Private guided puppy yoga session</li>
    <li>Dedicated event host</li>
    <li>Afro-beat music soundtrack</li>
    <li>Ethically sourced puppies from registered breeders</li>
    <li>Available in Hamilton, Kitchener, and Oakville</li>
  </ul>
  <p><a href="/birthday">Request a Birthday Package</a> | <a href="/private-events/quote">Get an Instant Quote</a></p>
  <p>Also explore our <a href="/loyalty">Loyalty Program</a> for returning guests.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/partnerships">Partnerships</a> | <a href="/ethics">Ethical Standards</a> | <a href="/private-events/quote">Private Event Quote</a>
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
  <a href="/">Home</a> | <a href="/birthday">Birthday Packages</a> | <a href="/ethics">Ethical Standards</a> | <a href="/careers">Careers</a>
</footer>
`,
    }),

  "/loyalty": () =>
    buildHtml({
      title: "AfroPuppyYoga Loyalty Program | Earn Rewards",
      description:
        "Earn points with every AfroPuppyYoga class and redeem them for free sessions, merchandise, and exclusive perks. Join our loyalty program today.",
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
  <p>The AfroPuppyYoga loyalty program rewards our most dedicated community members. Earn points with every class you attend and redeem them for free sessions, exclusive merchandise, and special perks.</p>
  <h3>How It Works</h3>
  <ul>
    <li>Earn points for every class you attend</li>
    <li>Earn bonus points for referring friends</li>
    <li>Redeem points for free classes, merchandise, and exclusive experiences</li>
    <li>Points never expire as long as your account is active</li>
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
  <a href="/">Home</a> | <a href="/birthday">Birthday Packages</a> | <a href="/partnerships">Partnerships</a> | <a href="/loyalty">Loyalty Program</a> | <a href="/careers">Careers</a>
</footer>
`,
    }),

  "/corporate-puppy-yoga": () =>
    buildHtml({
      title: "Corporate Puppy Yoga in Ontario | Team Wellness Events | AfroPuppyYoga",
      description:
        "Book a corporate puppy yoga event with AfroPuppyYoga. Team-building, employee appreciation, and wellness days with guided yoga and adorable puppies across Ontario. Groups from 6 to 50+.",
      canonical: `${BASE}/corporate-puppy-yoga`,
      schema: [
        breadcrumb({ name: "Corporate Puppy Yoga", url: `${BASE}/corporate-puppy-yoga` }),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": `${BASE}/corporate-puppy-yoga#service`,
          name: "Corporate Puppy Yoga",
          description: "Guided puppy yoga sessions for corporate teams. Employee appreciation, team-building, and stress relief in one session. Groups from 6 to 50+ across Ontario.",
          provider: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE },
          areaServed: { "@type": "State", name: "Ontario" },
          url: `${BASE}/corporate-puppy-yoga`,
          offers: {
            "@type": "Offer",
            url: `${BASE}/private-events/quote`,
            priceCurrency: "CAD",
            price: "1200",
            priceSpecification: { "@type": "PriceSpecification", minPrice: 1200, priceCurrency: "CAD" },
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
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
                text: "AfroPuppyYoga accommodates corporate groups from 6 to 50+ guests. We scale the number of puppies, instructors, and Puppy Monitors to match your group size.",
              },
            },
            {
              "@type": "Question",
              name: "Can you come to our office for a corporate puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. We offer offsite corporate events at your office, boardroom, or any suitable space across the Greater Toronto Area, Hamilton, Kitchener-Waterloo, and Oakville. A travel fee applies for offsite events.",
              },
            },
            {
              "@type": "Question",
              name: "How much does a corporate puppy yoga event cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Corporate puppy yoga events start at $1,200 for groups of up to 20 at a studio location. Pricing scales with group size, location, and package tier. Use our instant quote tool at afropuppyyoga.ca/private-events/quote for an accurate estimate.",
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

  <h3>Why Corporate Puppy Yoga Works</h3>
  <ul>
    <li><strong>Proven stress relief:</strong> Interacting with puppies measurably reduces cortisol and increases oxytocin — backed by peer-reviewed research.</li>
    <li><strong>No experience required:</strong> Sessions are designed for all fitness levels, from complete beginners to active yogis.</li>
    <li><strong>Inclusive and memorable:</strong> Unlike typical team activities, puppy yoga creates genuine shared joy across diverse teams.</li>
    <li><strong>Flexible format:</strong> Studio sessions in Kitchener, Hamilton, or Oakville, or we come to your office or venue.</li>
    <li><strong>Fully managed:</strong> Certified instructors, trained Puppy Monitors, all equipment, and a dedicated event host included.</li>
  </ul>

  <h3>Corporate Package Options</h3>
  <ul>
    <li><strong>Team Wellness Session ($1,200–$1,800):</strong> Up to 20 guests, 60-minute guided session, studio venue, dedicated host</li>
    <li><strong>Company Event Package ($2,000–$3,500):</strong> Up to 40 guests, extended session, custom playlist, photography add-on available</li>
    <li><strong>Premium Brand Collaboration:</strong> Custom experience for 40+ guests, offsite or studio, fully bespoke — contact us for pricing</li>
  </ul>

  <h3>What's Included</h3>
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
    <dd>Groups from 6 to 50+. We scale puppies, instructors, and monitors to match your group size.</dd>
    <dt>Can you come to our office?</dt>
    <dd>Yes. We offer offsite events across the GTA, Hamilton, Kitchener-Waterloo, and Oakville. A travel fee applies.</dd>
    <dt>How much does it cost?</dt>
    <dd>Events start at $1,200 for up to 20 guests at a studio location. Use our instant quote tool for an accurate estimate.</dd>
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
        "Book a private puppy yoga event with AfroPuppyYoga. Birthdays, bachelorettes, corporate wellness days, and team-building events with guided yoga and adorable puppies across Ontario.",
      canonical: `${BASE}/private-puppy-yoga-events`,
      schema: [
        breadcrumb({ name: "Private Puppy Yoga Events", url: `${BASE}/private-puppy-yoga-events` }),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Private Puppy Yoga Events",
          description: "Private puppy yoga events for birthdays, bachelorettes, corporate wellness, and team-building. Available across Ontario with groups from 6 to 50+.",
          provider: { "@type": "LocalBusiness", name: "AfroPuppyYoga", url: BASE },
          areaServed: { "@type": "State", name: "Ontario" },
          url: `${BASE}/private-puppy-yoga-events`,
          offers: {
            "@type": "Offer",
            url: `${BASE}/private-events/quote`,
            priceCurrency: "CAD",
            price: "1200",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What types of private puppy yoga events does AfroPuppyYoga offer?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "AfroPuppyYoga offers private puppy yoga events for birthdays, bachelorette parties, bridal showers, corporate wellness days, team-building events, baby showers, student group events, and brand activations. All events include a certified yoga instructor, ethically sourced puppies, and a dedicated event host.",
              },
            },
            {
              "@type": "Question",
              name: "How much does a private puppy yoga event cost in Ontario?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Private puppy yoga events start at $1,200 for up to 20 guests at a studio location in Kitchener-Waterloo, Hamilton, or Oakville. Pricing varies based on group size, location, and package tier. Use the instant quote tool at afropuppyyoga.ca/private-events/quote for an accurate estimate.",
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
                text: "Yes. We offer offsite private events at your chosen venue across the Greater Toronto Area, Hamilton, Kitchener-Waterloo, and Oakville. A travel fee applies for offsite locations.",
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
  <p>We serve groups from 6 to 50+ across Hamilton, Kitchener-Waterloo, and Oakville, Ontario. Offsite events available across the Greater Toronto Area.</p>

  <h3>Private Event Types</h3>
  <ul>
    <li><strong>Birthday Parties:</strong> Celebrate with puppies, yoga, and your closest friends. All ages welcome.</li>
    <li><strong>Bachelorette &amp; Bridal Showers:</strong> The most unique bachelorette activity in Ontario.</li>
    <li><strong>Corporate Wellness Days:</strong> Employee appreciation, team-building, and stress relief in one session.</li>
    <li><strong>Student Group Events:</strong> Perfect for clubs, orientation events, and stress-relief sessions.</li>
    <li><strong>Baby Showers &amp; Gender Reveals:</strong> A warm, joyful celebration with puppies.</li>
    <li><strong>Brand Activations:</strong> Co-branded wellness events for lifestyle and pet brands.</li>
  </ul>

  <h3>Package Tiers</h3>
  <ul>
    <li><strong>Classic ($1,200–$1,500):</strong> Up to 20 guests, 60-minute session, studio venue</li>
    <li><strong>Signature:</strong> Extended session, premium add-ons, larger group capacity</li>
    <li><strong>Luxury / Custom:</strong> Fully bespoke experience for 40+ guests or special requirements</li>
  </ul>

  <h3>What's Included in Every Private Event</h3>
  <ul>
    <li>Certified yoga instructor</li>
    <li>Ethically sourced puppies from registered breeders</li>
    <li>Trained Puppy Monitors throughout the session</li>
    <li>Afro-beat inspired music soundtrack</li>
    <li>All yoga mats and props</li>
    <li>Dedicated event host</li>
  </ul>

  <h3>Locations</h3>
  <ul>
    <li>Kitchener-Waterloo — TenC Dance Studio, 329 King St E, Kitchener</li>
    <li>Hamilton — Colibri Studio, 2751 Barton St E, Hamilton</li>
    <li>Oakville — 1670 North Service Rd E, Oakville</li>
    <li>Offsite — your venue across the GTA and surrounding regions (travel fee applies)</li>
  </ul>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>What types of private events do you offer?</dt>
    <dd>Birthdays, bachelorettes, corporate wellness days, team-building, baby showers, student group events, and brand activations.</dd>
    <dt>How much does a private event cost?</dt>
    <dd>Events start at $1,200 for up to 20 guests at a studio location. Use our instant quote tool for an accurate estimate.</dd>
    <dt>How far in advance should I book?</dt>
    <dd>3–4 weeks for studio events, 4–6 weeks for offsite or large corporate events.</dd>
    <dt>Can you come to my venue?</dt>
    <dd>Yes. We offer offsite events across the GTA, Hamilton, Kitchener-Waterloo, and Oakville. A travel fee applies.</dd>
  </dl>

  <p><a href="/private-events/quote">Get an Instant Quote</a> | <a href="/corporate-puppy-yoga">Corporate Events</a> | <a href="/birthday">Birthday Packages</a></p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/private-events/quote">Get a Quote</a> | <a href="/corporate-puppy-yoga">Corporate</a> | <a href="/birthday">Birthday</a> | <a href="/puppy-yoga-kitchener">Kitchener</a> | <a href="/puppy-yoga-hamilton">Hamilton</a> | <a href="/puppy-yoga-oakville">Oakville</a>
</footer>
`,
    }),

  "/puppy-yoga-kitchener": () =>
    buildHtml({
      title: "Puppy Yoga Kitchener-Waterloo | AfroPuppyYoga",
      description:
        "Join AfroPuppyYoga for puppy yoga in Kitchener-Waterloo at TenC Dance Studio, 329 King St E. Guided yoga with adorable puppies and Afro-beat music every weekend. Book your class today!",
      canonical: `${BASE}/puppy-yoga-kitchener`,
      schema: [
        breadcrumb({ name: "Puppy Yoga Kitchener", url: `${BASE}/puppy-yoga-kitchener` }),
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": `${BASE}/puppy-yoga-kitchener#business`,
          name: "AfroPuppyYoga — Kitchener-Waterloo",
          description: "Puppy yoga classes in Kitchener-Waterloo at TenC Dance Studio. Guided yoga with adorable puppies and Afro-beat music every weekend.",
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
          geo: { "@type": "GeoCoordinates", latitude: 43.4516, longitude: -80.4925 },
          image: OG_IMAGE,
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "494", bestRating: "5" },
          openingHoursSpecification: [
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "18:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "09:00", closes: "18:00" },
          ],
          priceRange: "$$",
          servesCuisine: "Wellness",
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
                text: "Puppy yoga classes in Kitchener start at $55. All tickets are booked through Luma.",
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
  <p>AfroPuppyYoga brings guided yoga, Afro-beat rhythms, and a litter of adorable puppies to downtown Kitchener every weekend. Whether you're a seasoned yogi or a complete beginner, our classes are designed to be joyful, accessible, and deeply relaxing.</p>
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
    <li><strong>Early Bird Ticket:</strong> $55</li>
    <li><strong>Regular Ticket:</strong> $55</li>
    <li><strong>Bring a Friend (2 tickets):</strong> $55 per person</li>
    <li><strong>Group of 3:</strong> $55 per person</li>
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
    <dd>Classes start at $55.</dd>
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
        "Join AfroPuppyYoga for puppy yoga in Hamilton at Colibri Studio, 2751 Barton St E. Guided yoga with adorable puppies and Afro-beat music. Book your Hamilton class today!",
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
            streetAddress: "2751 Barton St E",
            addressLocality: "Hamilton",
            addressRegion: "ON",
            addressCountry: "CA",
          },
          geo: { "@type": "GeoCoordinates", latitude: 43.2255, longitude: -79.7747 },
          image: OG_IMAGE,
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "494", bestRating: "5" },
          openingHoursSpecification: [
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "18:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "09:00", closes: "18:00" },
          ],
          priceRange: "$$",
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
                text: "AfroPuppyYoga Hamilton classes are held at Colibri Studio, 2751 Barton St E, Hamilton, ON. The studio is located in east Hamilton with parking available on site.",
              },
            },
            {
              "@type": "Question",
              name: "How much does puppy yoga in Hamilton cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Puppy yoga classes in Hamilton start at $55. .",
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
  <p>AfroPuppyYoga brings guided yoga, Afro-beat rhythms, and a litter of adorable puppies to Hamilton. Classes are held at <strong>Colibri Studio, 2751 Barton St E, Hamilton, ON</strong>.</p>
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
    <li><strong>Early Bird Ticket:</strong> $55</li>
    <li><strong>Regular Ticket:</strong> $55</li>
    <li><strong>Bring a Friend (2 tickets):</strong> $55 per person</li>
    <li><strong>Group of 3:</strong> $55 per person</li>
  </ul>

  <h3>Location</h3>
  <address>
    Colibri Studio<br />
    2751 Barton St E<br />
    Hamilton, ON
  </address>
  <p>Easily accessible from Burlington, Stoney Creek, and the greater Hamilton area.</p>

  <h3>Frequently Asked Questions</h3>
  <dl>
    <dt>Where is AfroPuppyYoga in Hamilton?</dt>
    <dd>Colibri Studio, 2751 Barton St E, Hamilton, ON.</dd>
    <dt>How much does it cost?</dt>
    <dd>Classes start at $55.</dd>
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
        "Join AfroPuppyYoga for puppy yoga in Oakville, Ontario. Guided yoga with adorable puppies and Afro-beat music. Book your Oakville class today!",
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
          address: {
            "@type": "PostalAddress",
            streetAddress: "1670 North Service Rd E",
            addressLocality: "Oakville",
            addressRegion: "ON",
            addressCountry: "CA",
          },
          geo: { "@type": "GeoCoordinates", latitude: 43.4675, longitude: -79.6877 },
          image: OG_IMAGE,
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "494", bestRating: "5" },
          openingHoursSpecification: [
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "18:00" },
            { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "09:00", closes: "18:00" },
          ],
          priceRange: "$$",
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
                text: "Puppy yoga classes in Oakville start at $55. .",
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
    <li><strong>Early Bird Ticket:</strong> $55</li>
    <li><strong>Regular Ticket:</strong> $55</li>
    <li><strong>Bring a Friend (2 tickets):</strong> $55 per person</li>
    <li><strong>Group of 3:</strong> $55 per person</li>
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
    <dd>Classes start at $55.</dd>
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
        "Get an instant quote for a private puppy yoga event with AfroPuppyYoga. Perfect for corporate wellness days, bachelorette parties, birthdays, and team events across Ontario.",
      canonical: `${BASE}/private-events/quote`,
      schema: [
        breadcrumb(
          { name: "Private Events", url: `${BASE}/#private-events` },
          { name: "Get a Quote", url: `${BASE}/private-events/quote` }
        ),
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How much does a private puppy yoga event cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Private puppy yoga events start at $1,200 for up to 20 guests at a studio location in Kitchener-Waterloo. Pricing varies based on guest count, location, package tier (Classic, Signature, or Luxury), and any travel fees for offsite events. Use our instant quote tool to get an accurate estimate.",
              },
            },
            {
              "@type": "Question",
              name: "Where can you host a private puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We host private events at our studio locations in Kitchener-Waterloo, Hamilton, and Oakville. We also offer offsite events at your chosen venue across the Greater Toronto Area and surrounding regions. A travel fee applies for offsite locations.",
              },
            },
            {
              "@type": "Question",
              name: "What is included in a private puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "All private events include a guided yoga session with certified instructors, ethically sourced puppies supervised by trained Puppy Monitors, Afro-beat music, all mats and props, and a dedicated event host. Add-ons such as photography, refreshments, and merchandise are available.",
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
  <p>AfroPuppyYoga offers fully customized private puppy yoga events for corporate wellness days, birthday parties, bachelorette parties, baby showers, and team-building events across Ontario. Use our instant quote tool to get an accurate price estimate based on your group size, location, and package preferences.</p>

  <h3>Why Book a Private Event?</h3>
  <ul>
    <li>Exclusive session — just your group and the puppies</li>
    <li>Flexible scheduling, including weekdays for corporate events</li>
    <li>Available at our studios in Kitchener, Hamilton, and Oakville, or offsite at your venue</li>
    <li>Certified yoga instructors and trained Puppy Monitors included</li>
    <li>Customizable packages: Classic, Signature, and Luxury tiers</li>
    <li>Add-ons available: photography, refreshments, branded merchandise</li>
  </ul>

  <h3>Private Event Packages</h3>
  <ul>
    <li><strong>Classic ($1,200–$1,500):</strong> Up to 20 guests, 60-minute session, studio venue in Kitchener-Waterloo</li>
    <li><strong>Signature:</strong> Extended session, premium add-ons, larger group capacity</li>
    <li><strong>Luxury / Custom:</strong> Fully bespoke experience for 40+ guests or special requirements</li>
  </ul>

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
    <dd>Events start at $1,200 for up to 20 guests at a studio location. Pricing varies by guest count, location, and package tier. Use the quote tool on our website for an accurate estimate.</dd>
    <dt>Where can you host a private event?</dt>
    <dd>We host events at our studios in Kitchener-Waterloo, Hamilton, and Oakville, and offsite across the GTA and surrounding regions. A travel fee applies for offsite events.</dd>
    <dt>What is included?</dt>
    <dd>All events include certified instructors, ethically sourced puppies, Puppy Monitors, Afro-beat music, mats, props, and a dedicated event host. Add-ons are available.</dd>
    <dt>How far in advance should I book?</dt>
    <dd>We recommend 3–4 weeks for studio events and 4–6 weeks for offsite or large corporate events.</dd>
  </dl>

  <p><a href="/private-events/quote">Get Your Instant Quote</a></p>
  <p>Also explore our <a href="/birthday">Birthday Packages</a> or <a href="/partnerships">Corporate Partnership</a> options.</p>
</main>
<footer>
  <a href="/">Home</a> | <a href="/birthday">Birthday Packages</a> | <a href="/partnerships">Partnerships</a> | <a href="/loyalty">Loyalty Program</a> | <a href="/ethics">Ethical Standards</a> | <a href="/careers">Careers</a>
</footer>
`,
    }),
};

// ─── Middleware ───────────────────────────────────────────────────────────────

export function seoRenderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Only handle GET requests for HTML pages (not API, assets, etc.)
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/admin/")) return next();
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|json|xml|txt)$/)) return next();

  // Only serve to crawlers
  if (!isCrawler(req)) return next();

  const pageFn = PAGES[req.path];

  // Unknown path — do not fall back to homepage (prevents soft 404s and
  // duplicate homepage canonicals for random/internal URLs).
  if (!pageFn) {
    res
      .status(404)
      .set({ "Content-Type": "text/html; charset=utf-8" })
      .end(
        `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>404 Not Found | AfroPuppyYoga</title><meta name="robots" content="noindex, nofollow" /></head><body><h1>404 — Page Not Found</h1><p><a href="https://afropuppyyoga.ca/">Return to AfroPuppyYoga</a></p></body></html>`
      );
    return;
  }

  const html = pageFn();
  res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
}
