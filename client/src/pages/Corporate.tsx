import { useEffect, useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { Check, ChevronDown } from "lucide-react";
import { FIVE_STAR_REVIEW_COUNT } from "../../../shared/reviewMetrics";
import { PUBLIC_LOCATION_COUNT, PUBLIC_LOCATION_LIST } from "@shared/publicLocations";

const trustedByLogos = [
  {
    name: "Wilfrid Laurier University",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/laurier_logo_61911be5.webp",
    height: 30,
  },
  {
    name: "University of Waterloo",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/waterloo_fixed_a91debfb.png",
    height: 36,
  },
  {
    name: "McMaster University",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mcmaster_dedf4891.png",
    height: 38,
  },
  {
    name: "University of Guelph",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/guelph_fixed_39bf0fba.png",
    height: 36,
  },
  {
    name: "Brock University",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/brock_university_a69cc38d.png",
    height: 36,
  },
  {
    name: "Manulife",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/manulife_logo_cropped_ecd0a51b.png",
    height: 40,
  },
  {
    name: "Brock Solutions",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/dwXWkrdWFpxsxxJF.png",
    height: 40,
  },
  {
    name: "F45 Training",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/f45_fixed_f11e0ba3.png",
    height: 34,
  },
  {
    name: "Girl Guides of Canada",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/girl-guides-canada-logo_307ab2f6.png",
    height: 40,
  },
  {
    name: "Artemis Canada",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/artemis_canada_logo_b5401a15.jpg",
    height: 36,
  },
  {
    name: "Kitchener Lady Rangers",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/lady_rangers_logo_787e1b41.jpg",
    height: 40,
  },
  {
    name: "MMSA Lang Guelph",
    src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mmsa_lang_logo_46c62a49.webp",
    height: 40,
  },
];

const audiences = [
  { icon: "🏢", label: "HR Teams" },
  { icon: "🎓", label: "Universities & Colleges" },
  { icon: "⚖️", label: "Law Firms" },
  { icon: "💻", label: "Tech Companies" },
  { icon: "🏡", label: "Real Estate Teams" },
  { icon: "🌿", label: "Wellness Committees" },
  { icon: "👩‍🎓", label: "Student Groups" },
  { icon: "📣", label: "Brand Activations" },
];

const whyItWorks = [
  {
    icon: "🧘",
    title: "Low-Pressure Movement",
    desc: "Beginner-friendly yoga that everyone can do — no experience, no judgment. Perfect for mixed-ability groups.",
  },
  {
    icon: "😌",
    title: "Genuine Stress Relief",
    desc: "Puppies and movement together create a proven stress-reduction experience. Your team will feel it immediately.",
  },
  {
    icon: "🤝",
    title: "Social Connection",
    desc: "Shared laughter, shared puppies, shared experience. The kind of bonding that doesn't happen at a conference table.",
  },
  {
    icon: "🎵",
    title: "Culturally Fresh",
    desc: "Feel-good curated soundtrack, warm inclusive energy, and a vibe that feels premium without being stiff.",
  },
  {
    icon: "📸",
    title: "Memorable Content",
    desc: "Your team will be talking about it — and posting about it. Great for internal culture and external brand.",
  },
  {
    icon: "🐾",
    title: "Ethically Sourced Puppies",
    desc: "All puppies are sourced from vetted breeders. Safe, supervised, and insured. Your team is in good hands.",
  },
];

const packages = [
  {
    name: "In-Studio Private Event",
    icon: "🏛️",
    bestFor: "Teams of 6–25",
    desc: `We arrange partner venues in ${PUBLIC_LOCATION_LIST}, subject to availability. Fully private, fully branded to APY. Includes instructor, puppies, mats, and props.`,
    price: "Starting at $1,200",
    includes: [
      "Certified yoga instructor",
      "Ethically sourced puppies + handlers",
      "All mats & props",
      "Custom curated playlist",
    ],
    cta: "Get a Quote",
  },
  {
    name: "On-Site Corporate Event",
    icon: "🏢",
    bestFor: "Teams of 15–50+",
    desc: "We bring the experience to your office, venue, or event space. Ideal for employee appreciation days, wellness weeks, and large-group activations.",
    price: "Starting at $2,000",
    includes: [
      "Everything in Studio +",
      "Full setup & teardown at your venue",
      "Event coordination",
      "Branded APY experience",
    ],
    cta: "Get a Quote",
    badge: "Most Requested",
  },
  {
    name: "Premium Brand Collaboration",
    icon: "✨",
    bestFor: "Brand activations & partnerships",
    desc: "Co-branded puppy yoga events for product launches, influencer campaigns, and wellness brand partnerships. Custom packages available.",
    price: "Custom pricing",
    includes: [
      "Co-branded event design",
      "Influencer & media coordination",
      "Custom merchandise options",
      "Dedicated account manager",
    ],
    cta: "Contact Us",
  },
];

const faqs = [
  {
    q: "How many people can attend a corporate event?",
    a: "We accommodate groups from 6 to 50+ guests. For very large groups (50+), we can arrange multiple sessions or a larger venue. Contact us to discuss your group size.",
  },
  {
    q: "Where can you host corporate events?",
    a: "We operate across Ontario including Kitchener, Hamilton, Oakville, Toronto, Guelph, and surrounding areas. We can come to your office or arrange space at one of our partner studios.",
  },
  {
    q: "Are the puppies safe for a corporate setting?",
    a: "Yes. All puppies are sourced from vetted, ethical breeders, fully vaccinated, and supervised by trained handlers throughout the event. We carry liability insurance and all participants sign a standard waiver.",
  },
  {
    q: "Do employees need yoga experience?",
    a: "Not at all. Our sessions are designed to be 100% beginner-friendly. The instructor guides every pose and keeps the energy light and fun.",
  },
  {
    q: "What is included in the price?",
    a: "Every corporate package includes a certified yoga instructor and event host, ethically sourced puppies and handlers, all mats and props, setup and cleanup, a custom curated playlist, and a branded APY experience. Add-ons like photography, refreshments, and branded merchandise are available.",
  },
  {
    q: "How far in advance do I need to book?",
    a: "We recommend booking at least 2–3 weeks in advance to secure your preferred date and puppy availability. For large groups or special dates, 4–6 weeks is ideal.",
  },
  {
    q: "Do you provide waivers and insurance documentation?",
    a: "Yes. We provide standard liability waivers for all participants and can supply proof of insurance documentation for your HR or facilities team upon request.",
  },
];

function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border border-[#F29CB8]/30 rounded-2xl overflow-hidden bg-white cursor-pointer"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between px-6 py-5 gap-4">
        <span className="font-display font-medium text-[#34221D] text-sm md:text-base">
          {faq.q}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-brand-link flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </div>
      {open && (
        <div className="px-6 pb-5 border-t border-[#F29CB8]/20">
          <p className="font-body text-base text-[#34221D]/80 leading-relaxed pt-4">
            {faq.a}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Corporate() {
  useSeoMeta({
    title:
      "Corporate Puppy Yoga Ontario | Team Wellness & Employee Appreciation | AfroPuppyYoga",
    description: `Corporate puppy yoga across Ontario. ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Team-building, employee appreciation and puppy cuddles. Request your event quote.`,
    canonical: "https://afropuppyyoga.ca/corporate-puppy-yoga",
  });

  useEffect(() => {
    document.title = "Corporate Puppy Yoga Ontario | AfroPuppyYoga";
  }, []);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-[#FEFAF4] pt-28 pb-12 md:pt-32 md:pb-16 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center gap-10 lg:gap-16">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-brand-link font-body text-xs font-semibold tracking-widest uppercase">
                Corporate Wellness
              </span>
              <div className="w-8 h-0.5 bg-primary" />
            </div>
            <h1 className="font-display font-medium text-[#34221D] text-[clamp(2.75rem,5vw,4.5rem)] leading-[1.08] tracking-[-0.035em] mb-6">
              Team Wellness That
              <br />
              <span className="italic text-brand-link">Actually Works</span>
            </h1>
            <p className="font-body text-[#34221D]/80 text-lg leading-relaxed mb-8 max-w-xl">
              Ontario's #1 puppy yoga studio brings the puppies, the yoga, and
              the good vibes to your team. Available across Ontario for groups
              of 6 to 50+.
            </p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link href="/private-events/quote">
                <button className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-4 bg-primary text-[#34221D] font-body font-semibold text-sm rounded-full hover:bg-primary-hover transition-colors motion-reduce:transition-none">
                  Get a Corporate Quote
                </button>
              </Link>
              <a href="mailto:afropuppyyoga@gmail.com?subject=Corporate%20Puppy%20Yoga%20Inquiry">
                <button className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-4 bg-transparent border border-[#34221D]/30 text-[#34221D] font-body font-semibold text-sm rounded-full hover:bg-blush transition-colors motion-reduce:transition-none">
                  Email Us Directly
                </button>
              </a>
            </div>
          </div>
          <img
            src="/manus-storage/apy_corporate_hero_202ea280.jpg"
            alt="AfroPuppyYoga guests enjoying a puppy yoga event"
            className="w-full aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5] object-cover rounded-t-[48%] rounded-b-2xl"
            fetchPriority="high"
          />
        </div>
      </section>

      {/* ── Quick Stats Strip ─────────────────────────────────────── */}
      <section className="bg-blush border-y border-[#E8D8D0] py-6 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { stat: "6–50+", label: "Group sizes" },
            { stat: PUBLIC_LOCATION_COUNT, label: "Ontario locations" },
            { stat: "$1,200", label: "Starting price" },
            { stat: FIVE_STAR_REVIEW_COUNT, label: "Five-Star Reviews" },
          ].map(item => (
            <div key={item.label}>
              <div className="font-display font-medium text-[#34221D] text-2xl">
                {item.stat}
              </div>
              <div className="font-body text-[#34221D]/80 text-sm mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trusted By ───────────────────────────────────────────── */}
      <div className="relative bg-white border-t border-gray-100 border-b py-3 flex items-center">
        <span className="hidden xs:inline-flex shrink-0 text-[#71574F] font-body text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap pl-5 pr-4 border-r border-black/15 z-20 sm:inline-flex items-center">
          Trusted By
        </span>
        <div className="relative flex-1 overflow-hidden motion-reduce:overflow-x-auto">
          <div className="flex items-center animate-[marquee_28s_linear_infinite] motion-reduce:animate-none gap-0 min-w-max">
            {[...trustedByLogos, ...trustedByLogos].map((org, i) => (
              <div
                key={`${org.name}-${i}`}
                className="flex items-center px-8 border-r border-black/10 last:border-r-0 shrink-0"
              >
                <img
                  src={org.src}
                  alt={org.name}
                  style={{ height: org.height }}
                  className="w-auto object-contain transition-colors motion-reduce:transition-none duration-300 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {/* ── Who It's For ─────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#FEFAF4]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-brand-link font-body text-xs font-semibold tracking-widest uppercase">
                Who It's For
              </span>
              <div className="w-8 h-0.5 bg-primary" />
            </div>
            <h2 className="font-display font-medium text-[#34221D] text-3xl md:text-4xl mb-3">
              Built for Every Kind of Team
            </h2>
            <p className="font-body text-[#34221D]/80 text-base max-w-xl mx-auto">
              We work with organizations of all sizes across Ontario.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {audiences.map((a, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl text-center bg-white border border-[#F29CB8]/30 shadow-sm hover:shadow-md hover:border-[#F29CB8]/60 transition-colors motion-reduce:transition-none"
              >
                <span className="text-3xl">{a.icon}</span>
                <span className="font-body font-semibold text-sm text-[#34221D]">
                  {a.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why It Works ─────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#FDE9EF]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-brand-link font-body text-xs font-semibold tracking-widest uppercase">
                Why It Works
              </span>
              <div className="w-8 h-0.5 bg-primary" />
            </div>
            <h2 className="font-display font-medium text-[#34221D] text-3xl md:text-4xl mb-3">
              More Than a Fun Activity
            </h2>
            <p className="font-body text-[#34221D]/80 text-base max-w-xl mx-auto">
              Puppy yoga isn't just fun — it's effective team wellness.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyItWorks.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 border border-[#F29CB8]/30 shadow-sm"
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-display font-medium text-[#34221D] text-base mb-2">
                  {item.title}
                </h3>
                <p className="font-body text-base text-[#34221D]/80 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Packages ─────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#FEFAF4]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-brand-link font-body text-xs font-semibold tracking-widest uppercase">
                Corporate Packages
              </span>
              <div className="w-8 h-0.5 bg-primary" />
            </div>
            <h2 className="font-display font-medium text-[#34221D] text-3xl md:text-4xl mb-3">
              Choose Your Format
            </h2>
            <p className="font-body text-[#34221D]/80 text-base max-w-xl mx-auto">
              Every package includes our instructor, ethically sourced puppies,
              and the full APY experience.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg, i) => (
              <div
                key={i}
                className={`relative rounded-3xl p-7 flex flex-col border ${
                  pkg.badge
                    ? "border-primary shadow-sm"
                    : "border-[#F29CB8]/40 shadow-sm"
                } bg-white`}
              >
                {pkg.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-[#34221D] text-xs font-body font-bold tracking-widest uppercase px-5 py-1.5 rounded-full whitespace-nowrap">
                    {pkg.badge}
                  </div>
                )}
                <div className="text-3xl mb-3">{pkg.icon}</div>
                <span className="inline-block font-body text-xs font-semibold px-3 py-1 rounded-full bg-[#FDE9EF] text-brand-link mb-3 self-start">
                  {pkg.bestFor}
                </span>
                <h3 className="font-display font-medium text-[#34221D] text-xl mb-3">
                  {pkg.name}
                </h3>
                <p className="font-body text-base text-[#34221D]/80 leading-relaxed mb-4 flex-1">
                  {pkg.desc}
                </p>
                <ul className="space-y-1.5 mb-5">
                  {pkg.includes.map(item => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-brand-link flex-shrink-0" />
                      <span className="font-body text-sm text-[#34221D]/80">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="font-display font-medium text-brand-link text-lg mb-5">
                  {pkg.price}
                </p>
                <Link href="/private-events/quote">
                  <button
                    className={`w-full py-3.5 font-body font-bold text-sm rounded-2xl transition-colors motion-reduce:transition-none active:scale-[0.97] ${
                      pkg.badge
                        ? "bg-primary text-[#34221D] hover:bg-primary-hover"
                        : "bg-primary text-[#34221D] hover:bg-primary-hover"
                    }`}
                  >
                    {pkg.cta} →
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#FDE9EF]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-brand-link font-body text-xs font-semibold tracking-widest uppercase">
                FAQ
              </span>
              <div className="w-8 h-0.5 bg-primary" />
            </div>
            <h2 className="font-display font-medium text-[#34221D] text-3xl md:text-4xl">
              Corporate FAQ
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i}>
                <FAQItem faq={faq} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <section className="py-20 px-6 text-center bg-blush border-t border-[#E8D8D0]">
        <div className="max-w-2xl mx-auto">
          <div className="text-4xl mb-4">🐾</div>
          <h2 className="font-display font-medium text-[#34221D] text-3xl md:text-4xl mb-4 leading-tight">
            Ready to book a team wellness day
            <br />
            <span className="italic text-brand-link">
              your team will actually remember?
            </span>
          </h2>
          <p className="font-body text-[#34221D]/80 text-base mb-8 leading-relaxed">
            Fill out our quote form and we'll follow up within 24–48 hours with
            availability, pricing, and next steps.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/private-events/quote">
              <button className="inline-flex items-center justify-center px-10 py-4 bg-primary text-[#34221D] font-body font-bold text-sm rounded-full hover:bg-primary-hover transition-colors motion-reduce:transition-none active:scale-[0.97]">
                Get a Corporate Quote
              </button>
            </Link>
            <a href="mailto:afropuppyyoga@gmail.com?subject=Corporate%20Puppy%20Yoga%20Inquiry">
              <button className="inline-flex items-center justify-center px-10 py-4 bg-transparent border border-[#34221D]/30 text-[#34221D] font-body font-semibold text-sm rounded-full hover:bg-white transition-colors motion-reduce:transition-none">
                Email Us Directly
              </button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
