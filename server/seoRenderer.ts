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
  ${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n  ")}
</head>
<body>
${opts.body}
</body>
</html>`;
}

// ─── Page Definitions ─────────────────────────────────────────────────────────

const BASE = "https://afropuppyyoga.ca";

const PAGES: Record<string, () => string> = {
  "/": () =>
    buildHtml({
      title: "AfroPuppyYoga | Ontario's #1 Puppy Yoga Experience",
      description:
        "Canada's #1 puppy yoga studio. Guided yoga, Afro-beat rhythms & adorable puppies in Hamilton, Kitchener-Waterloo & Oakville, Ontario. Book your class today!",
      canonical: `${BASE}/`,
      schema: [
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": `${BASE}/#business`,
          name: "AfroPuppyYoga",
          description:
            "Canada's #1 puppy yoga studio. Guided yoga, Afro-beat rhythms & adorable puppies in Hamilton, Kitchener-Waterloo & Oakville, Ontario.",
          url: BASE,
          logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og-image_139020fe.png",
          image:
            "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og-image_139020fe.png",
          telephone: "+12897881885",
          email: "info@afropuppyyoga.ca",
          priceRange: "$$",
          currenciesAccepted: "CAD",
          areaServed: [
            { "@type": "City", name: "Kitchener", addressRegion: "ON", addressCountry: "CA" },
            { "@type": "City", name: "Hamilton", addressRegion: "ON", addressCountry: "CA" },
            { "@type": "City", name: "Oakville", addressRegion: "ON", addressCountry: "CA" },
          ],
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.6",
            reviewCount: "494",
            bestRating: "5",
            worstRating: "1",
          },
          sameAs: [
            "https://www.instagram.com/afropuppyyoga",
            "https://www.tiktok.com/@afropuppyyoga",
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is puppy yoga?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Puppy yoga is a guided yoga class where adorable puppies roam freely around the studio while you practice. At AfroPuppyYoga, we combine Afro-beat rhythms with yoga and playful puppies for a unique wellness experience.",
              },
            },
            {
              "@type": "Question",
              name: "Where are AfroPuppyYoga classes held?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We hold classes in Hamilton (Colibri Studio, 2751 Barton St E), Kitchener (TenC Dance Studio, 329 King St E), and Oakville, Ontario.",
              },
            },
            {
              "@type": "Question",
              name: "How much does a puppy yoga class cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Classes start at $45 for early bird tickets. Regular tickets are $46. Bring-a-friend packages and group of 3 packages are also available. Memberships offer discounted monthly access.",
              },
            },
            {
              "@type": "Question",
              name: "Are the puppies safe and ethically sourced?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. All puppies at AfroPuppyYoga come from ethical, registered breeders. We have strict welfare standards — puppies are never stressed, sessions are kept short, and their wellbeing is our top priority.",
              },
            },
            {
              "@type": "Question",
              name: "Can I book a private puppy yoga event?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Absolutely! We offer private puppy yoga events for birthdays, bachelorette parties, corporate team-building, and more. Visit our Private Events page to request a quote.",
              },
            },
          ],
        },
      ],
      body: `
<header>
  <h1>AfroPuppyYoga — Ontario's #1 Puppy Yoga Studio</h1>
  <p>Where Wellness Meets Puppy Love</p>
  <nav>
    <a href="/">Home</a>
    <a href="/careers">Careers</a>
    <a href="/birthday">Birthday Events</a>
    <a href="/partnerships">Partnerships</a>
    <a href="/loyalty">Loyalty Program</a>
    <a href="/ethics">Ethical Standards</a>
  </nav>
</header>

<main>
  <section id="hero">
    <h2>Guided yoga, Afro-beat rhythms, and adorable puppies — all in one unforgettable session.</h2>
    <p>Serving Hamilton, Kitchener-Waterloo &amp; Oakville, Ontario. Canada's #1 puppy yoga studio.</p>
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
      <li><strong>Early Bird Ticket:</strong> $45</li>
      <li><strong>Regular Ticket:</strong> $46</li>
      <li><strong>Bring a Friend Package:</strong> $86 for 2</li>
      <li><strong>Group of 3 Package:</strong> $125 for 3</li>
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
    <p>We are proud to be Canada's #1 puppy yoga studio, with over 494 five-star reviews and thousands of happy participants across Ontario.</p>
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
      <dd>Classes start at $45 for early bird tickets. Regular tickets are $46. Bring-a-friend and group packages are also available.</dd>

      <dt>Are the puppies ethically sourced?</dt>
      <dd>Yes. All puppies come from ethical, registered breeders. We have strict welfare standards — puppies are never stressed, sessions are kept short, and their wellbeing is our top priority.</dd>

      <dt>Can I book a private event?</dt>
      <dd>Yes! We offer private puppy yoga events for birthdays, bachelorette parties, corporate team-building, and more. Visit our Private Events page to request a quote.</dd>

      <dt>Do I need yoga experience?</dt>
      <dd>No experience needed! Our classes are designed for all levels, from complete beginners to experienced yogis.</dd>

      <dt>What should I wear?</dt>
      <dd>Comfortable workout clothes that you don't mind getting puppy paws on. We recommend layers as studios can vary in temperature.</dd>
    </dl>
  </section>

  <section id="contact">
    <h2>Contact Us</h2>
    <p>Email: <a href="mailto:info@afropuppyyoga.ca">info@afropuppyyoga.ca</a></p>
    <p>Phone: <a href="tel:+12897881885">289-788-1885</a></p>
    <p>Instagram: <a href="https://www.instagram.com/afropuppyyoga">@afropuppyyoga</a></p>
    <p>TikTok: <a href="https://www.tiktok.com/@afropuppyyoga">@afropuppyyoga</a></p>
  </section>
</main>

<footer>
  <p>&copy; 2025 AfroPuppyYoga. All rights reserved.</p>
  <p>Canada's #1 Puppy Yoga Studio | Hamilton | Kitchener | Oakville | Ontario</p>
</footer>
`,
    }),

  "/careers": () =>
    buildHtml({
      title: "Careers at AfroPuppyYoga | Join Our Team",
      description:
        "Join the AfroPuppyYoga team! We're looking for passionate yoga instructors, event coordinators, and puppy handlers in Hamilton, Kitchener, and Oakville, Ontario.",
      canonical: `${BASE}/careers`,
      body: `
<header><h1>Careers at AfroPuppyYoga</h1></header>
<main>
  <h2>Join Our Team</h2>
  <p>AfroPuppyYoga is always looking for passionate, energetic people to join our growing team. We value inclusivity, creativity, and a genuine love for wellness and animals.</p>
  <h3>Open Roles</h3>
  <p>We hire yoga instructors, event coordinators, and puppy handlers across our Hamilton, Kitchener, and Oakville locations. Submit your application and video introduction to be considered for upcoming openings.</p>
  <p>To apply, visit our <a href="/careers">Careers page</a> and submit your application.</p>
</main>
`,
    }),

  "/birthday": () =>
    buildHtml({
      title: "Birthday Puppy Yoga Parties | AfroPuppyYoga",
      description:
        "Celebrate your birthday with a private puppy yoga party! AfroPuppyYoga offers unforgettable birthday experiences in Hamilton, Kitchener, and Oakville, Ontario.",
      canonical: `${BASE}/birthday`,
      body: `
<header><h1>Birthday Puppy Yoga Parties — AfroPuppyYoga</h1></header>
<main>
  <h2>Make Your Birthday Unforgettable</h2>
  <p>Celebrate your special day with a private puppy yoga party from AfroPuppyYoga! Our birthday packages include a guided yoga session, Afro-beat music, and a litter of adorable puppies — plus a dedicated host to make your event seamless.</p>
  <h3>What's Included</h3>
  <ul>
    <li>60-minute private puppy yoga session</li>
    <li>Dedicated event host</li>
    <li>Afro-beat music soundtrack</li>
    <li>Ethically sourced puppies</li>
    <li>Available in Hamilton, Kitchener, and Oakville</li>
  </ul>
  <p><a href="/birthday">Request a Birthday Package</a></p>
</main>
`,
    }),

  "/partnerships": () =>
    buildHtml({
      title: "Partner with AfroPuppyYoga | Corporate & Brand Partnerships",
      description:
        "Partner with AfroPuppyYoga for corporate events, brand collaborations, and community wellness initiatives in Ontario. Contact us to explore partnership opportunities.",
      canonical: `${BASE}/partnerships`,
      body: `
<header><h1>Partnerships — AfroPuppyYoga</h1></header>
<main>
  <h2>Partner With Us</h2>
  <p>AfroPuppyYoga partners with brands, studios, and organizations that share our values of wellness, inclusivity, and community. We offer co-branded events, corporate wellness packages, and community collaboration opportunities.</p>
  <p><a href="/partnerships">Apply for a Partnership</a></p>
</main>
`,
    }),

  "/loyalty": () =>
    buildHtml({
      title: "AfroPuppyYoga Loyalty Program | Earn Rewards",
      description:
        "Earn points with every AfroPuppyYoga class and redeem them for free sessions, merchandise, and exclusive perks. Join our loyalty program today.",
      canonical: `${BASE}/loyalty`,
      body: `
<header><h1>AfroPuppyYoga Loyalty Program</h1></header>
<main>
  <h2>Earn Rewards for Every Class</h2>
  <p>The AfroPuppyYoga loyalty program rewards our most dedicated community members. Earn points with every class you attend and redeem them for free sessions, exclusive merchandise, and special perks.</p>
  <p><a href="/loyalty">Join the Loyalty Program</a></p>
</main>
`,
    }),

  "/ethics": () =>
    buildHtml({
      title: "Ethical Standards | AfroPuppyYoga Puppy Welfare",
      description:
        "AfroPuppyYoga is committed to the highest standards of puppy welfare. All our puppies come from ethical, registered breeders and are treated with the utmost care.",
      canonical: `${BASE}/ethics`,
      body: `
<header><h1>Our Ethical Standards — AfroPuppyYoga</h1></header>
<main>
  <h2>Puppy Welfare is Our Top Priority</h2>
  <p>At AfroPuppyYoga, we take the welfare of our puppies extremely seriously. Every puppy that participates in our sessions comes from a registered, ethical breeder who meets our strict welfare criteria.</p>
  <h3>Our Commitments</h3>
  <ul>
    <li>All puppies sourced from registered, ethical breeders</li>
    <li>Sessions kept short to prevent fatigue or stress</li>
    <li>Puppies are never forced to interact with participants</li>
    <li>Health monitored before and after every event</li>
    <li>Puppies have designated rest areas during sessions</li>
    <li>No puppy participates more than once per day</li>
  </ul>
  <p><a href="/ethics">Read our full Ethical Standards</a></p>
</main>
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

  const pageFn = PAGES[req.path] || PAGES["/"];
  const html = pageFn();
  res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
}
