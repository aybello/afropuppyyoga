/* ============================================================
   Hero Section — Full-bleed editorial, text anchored bottom-left
   Background: AI-generated warm yoga studio with puppies
   ============================================================ */
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp";
const BOOK_URL = "https://lu.ma/afropuppyyoga";

const trustedBy = [
  { name: "Wilfrid Laurier University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/laurier_logo_61911be5.webp", height: 32 },
  { name: "University of Waterloo", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/waterloo_logo_6f34835e.webp", height: 28 },
  { name: "McMaster University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mcmaster_dedf4891.png", height: 40 },
  { name: "University of Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/guelph_f38ef088.svg", height: 36 },
  { name: "Scribenote", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/scribenote_dark_6221d6bf.png", height: 28 },
  { name: "F45 Training", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/f45_fe9e22f7.svg", height: 32 },
  { name: "9Round Kickboxing", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/9round_bc6e021c.webp", height: 36 },
  { name: "Home2 Suites by Hilton", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/home2suites_final_6791f5d4.png", height: 36 },
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
            className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.05] mb-6"
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
            className="font-body text-white/85 text-lg md:text-xl leading-relaxed mb-10 max-w-lg"
          >
            Guided yoga, Afro-beat rhythms, and adorable puppies — all in one unforgettable session. Serving Mississauga, Hamilton & Kitchener.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex flex-wrap gap-4"
          >
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-8 py-4 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-base rounded-full hover:bg-[#D4708A] transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              Book a Class
            </a>
            <a
              href="#private-events"
              onClick={(e) => { e.preventDefault(); document.querySelector("#private-events")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center px-8 py-4 bg-white/15 backdrop-blur-sm text-white font-body font-semibold text-base rounded-full border border-white/30 hover:bg-white/25 transition-all duration-200"
            >
              Private Events
            </a>
          </motion.div>
        </div>
      </div>

      {/* Trusted By strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="relative bg-black/40 backdrop-blur-sm border-t border-white/10 py-4"
      >
        <div className="container">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <span className="text-white/50 font-body text-xs font-semibold tracking-widest uppercase shrink-0">
              Trusted By
            </span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {trustedBy.map((org) => (
                <img
                  key={org.name}
                  src={org.src}
                  alt={org.name}
                  style={{ height: org.height }}
                  className="w-auto object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity duration-200"
                />
              ))}
            </div>
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
      `}</style>
    </section>
  );
}
