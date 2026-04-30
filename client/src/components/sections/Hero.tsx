/* ============================================================
   Hero Section — Full-bleed editorial, text anchored bottom-left
   Background: AI-generated warm yoga studio with puppies
   Design: Afro-editorial, warm tones, asymmetric layout
   ============================================================ */
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp";
const BOOK_URL = "https://lu.ma/afropuppyyoga";

// Each logo: src = CDN URL, height = display height in px
// All logos are shown in their natural colors on a white/frosted strip
const trustedBy = [
  { name: "Wilfrid Laurier University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/laurier_logo_61911be5.webp", height: 30 },
  { name: "University of Waterloo", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/waterloo_fixed_a91debfb.png", height: 36 },
  { name: "McMaster University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mcmaster_dedf4891.png", height: 38 },
  { name: "University of Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/guelph_fixed_39bf0fba.png", height: 36 },
  { name: "Brock University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/brock_university_a69cc38d.png", height: 52 },
  { name: "Scribenote", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/scribenote_dark_6221d6bf.png", height: 26 },
  { name: "F45 Training", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/f45_fixed_f11e0ba3.png", height: 34 },
  { name: "9Round Kickboxing", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/9round_composite_ce7b2856.png", height: 34 },
  { name: "The Fit Club Waterloo", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/fitclub_waterloo_bf128bd7.webp", height: 32 },
  { name: "Home2 Suites by Hilton", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/home2suites_wiki_457f2f4b.png", height: 38 },
  { name: "Kitchener Lady Rangers", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/lady_rangers_logo_787e1b41.jpg", height: 64 },
  { name: "Curated KW", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/curatedkw_logo_34f34c0f.webp", height: 64 },
  { name: "MMSA Lang Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mmsa_lang_logo_46c62a49.webp", height: 64 },
  { name: "Artemis Canada", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/artemis_canada_logo_b5401a15.jpg", height: 36 },
  { name: "Club Pilates Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/club-pilates-logo_1eb87a56.png", height: 80 },
  { name: "Girl Guides of Canada", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/girl-guides-canada-logo_307ab2f6.png", height: 80 },
  { name: "Solstice Pilates", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/solstice-pilates-logo_e8079dfc.webp", height: 72 },
];

export default function Hero() {
  const scrollToExperience = () => {
    document.querySelector("#experience")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="home" className="relative min-h-screen flex flex-col">
      {/* Background image with overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={HERO_BG}
          alt="AfroPuppyYoga class"
          className="w-full h-full object-cover object-center scale-105 animate-[kenBurns_20s_ease-in-out_infinite_alternate]"
        />
        {/* Gradient overlay — dark at bottom-left for text legibility, dark at top for nav */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/40" />
        {/* Warm amber tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#F2A0B8]/10 to-transparent" />
      </div>

      {/* Content — bottom-left anchored editorial layout */}
      <div className="relative flex-1 flex flex-col justify-end container pb-20 md:pb-28 pt-24">
        <div className="max-w-2xl">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-8 h-0.5 bg-[#F2A0B8]" />
            <span className="text-[#F2A0B8] font-body text-sm font-semibold tracking-widest uppercase">
              Canada's #1 Puppy Yoga Studio
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-display text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.05] mb-6"
          >
            Where Wellness
            <br />
            Meets{" "}
            <span className="italic text-[#F2A0B8]">Puppy Love</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="font-body text-white/85 text-base md:text-xl leading-relaxed mb-10 max-w-lg"
          >
            Guided yoga, Afro-beat rhythms, and adorable puppies — all in one unforgettable session. Serving Hamilton & Kitchener, with Oakville coming soon.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex flex-row gap-2"
          >
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-3 py-2.5 sm:px-8 sm:py-4 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-xs sm:text-base rounded-full hover:bg-[#D4708A] transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1 whitespace-nowrap"
              onClick={() => trackCTAClick("Book a Class — Hero")}
            >
              Book a Class
            </a>
            <a
              href="#memberships"
              onClick={(e) => { e.preventDefault(); trackCTAClick("Memberships — Hero"); document.querySelector("#memberships")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center justify-center px-3 py-2.5 sm:px-8 sm:py-4 font-body font-bold text-xs sm:text-base rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1 whitespace-nowrap"
              style={{ background: "linear-gradient(135deg, #F2A0B8, #F97316)", color: "#1A0A12" }}
            >
              Memberships
            </a>
            <a
              href="#private-events"
              onClick={(e) => { e.preventDefault(); trackCTAClick("Private Events — Hero"); document.querySelector("#private-events")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center justify-center px-3 py-2.5 sm:px-8 sm:py-4 bg-white/15 backdrop-blur-sm text-white font-body font-semibold text-xs sm:text-base rounded-full border border-white/30 hover:bg-white/25 transition-all duration-200 whitespace-nowrap"
            >
              Private Events
            </a>
          </motion.div>
        </div>
      </div>

      {/* Trusted By — infinite scrolling marquee on a frosted white strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="relative bg-white border-t border-gray-100 py-3 flex items-center"
      >
        {/* Pinned label — sits outside the scrolling track */}
        <span className="hidden xs:inline-flex shrink-0 text-black/40 font-body text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap pl-5 pr-4 border-r border-black/15 z-20 sm:inline-flex items-center">
          Trusted By
        </span>

        {/* Scrolling marquee — overflow hidden on this wrapper only */}
        <div className="relative flex-1 overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          {/* Marquee track — two identical sets for seamless loop */}
          <div className="flex items-center animate-[marquee_28s_linear_infinite] gap-0 min-w-max">
            {[...trustedBy, ...trustedBy].map((org, i) => (
              <div key={`${org.name}-${i}`} className="flex items-center px-8 border-r border-black/10 last:border-r-0 shrink-0">
                <img
                  src={org.src}
                  alt={org.name}
                  style={{ height: org.height }}
                  className="w-auto object-contain transition-all duration-300 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToExperience}
        className="absolute bottom-28 right-8 md:right-12 text-white/60 hover:text-white transition-colors animate-bounce"
        aria-label="Scroll down"
      >
        <ChevronDown size={28} />
      </button>

      <style>{`
        @keyframes kenBurns {
          from { transform: scale(1.05) translate(0, 0); }
          to { transform: scale(1.12) translate(-1%, -1%); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
