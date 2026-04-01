/* ============================================================
   InstagramFeed Section — Embedded Instagram Reels
   Design: Warm Afro-Wellness Editorial
   - 6 top-performing Reels embedded via Instagram oEmbed iframes
   - Horizontal scroll on mobile, 3-column grid on desktop
   - CTA to follow on Instagram
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Instagram, Play } from "lucide-react";

// Top-performing Reels from @afropuppyyoga (sorted by engagement)
const REELS = [
  {
    url: "https://www.instagram.com/reel/DWPX6bZEcfi/",
    shortcode: "DWPX6bZEcfi",
    caption: "Dachshund puppies + yoga 🐶🧘‍♀️",
    likes: 163,
  },
  {
    url: "https://www.instagram.com/reel/DWUsnqskdVG/",
    shortcode: "DWUsnqskdVG",
    caption: "Feel-good flow with Dachshund puppies 🐾",
    likes: 80,
  },
  {
    url: "https://www.instagram.com/reel/DWSbQ8UjBlN/",
    shortcode: "DWSbQ8UjBlN",
    caption: "Cool down with playful Husky puppies ❄️🐶",
    likes: 57,
  },
  {
    url: "https://www.instagram.com/reel/DWPixfhESbI/",
    shortcode: "DWPixfhESbI",
    caption: "Got exactly what I wanted 😛 #puppyyoga",
    likes: 41,
  },
  {
    url: "https://www.instagram.com/reel/DWh-37KDNNr/",
    shortcode: "DWh-37KDNNr",
    caption: "Gone… to puppy yoga! 🐶",
    likes: 29,
  },
  {
    url: "https://www.instagram.com/reel/DWQeahHjrxG/",
    shortcode: "DWQeahHjrxG",
    caption: "Unwind with fluffy Samoyed puppies ☁️🐾",
    likes: 27,
  },
];

function ReelCard({ reel, index }: { reel: typeof REELS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);

  // Lazy-load: only render iframe when card is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Load Instagram embed script once
  useEffect(() => {
    if (!inView) return;
    if ((window as any).instgrm) {
      (window as any).instgrm.Embeds.process();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).instgrm) (window as any).instgrm.Embeds.process();
    };
    document.body.appendChild(script);
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="flex-shrink-0 w-[300px] md:w-auto"
    >
      <div className="relative rounded-2xl overflow-hidden bg-[#1E1208]/5 border border-[#1E1208]/8 shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Loading placeholder */}
        {!loaded && inView && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F5EFE6] z-10 pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F4A800] to-[#E1306C] flex items-center justify-center mb-3">
              <Play size={18} className="text-white ml-0.5" fill="white" />
            </div>
            <p className="font-body text-xs text-[#1E1208]/50">Loading reel…</p>
          </div>
        )}

        {inView && (
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={`${reel.url}?utm_source=ig_embed&utm_campaign=loading`}
            data-instgrm-version="14"
            style={{
              background: "#FFF",
              border: 0,
              borderRadius: "12px",
              boxShadow: "none",
              display: "block",
              margin: 0,
              minWidth: "280px",
              padding: 0,
              width: "100%",
            }}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>

      {/* Caption below card */}
      <div className="mt-3 px-1">
        <p className="font-body text-[#1E1208]/70 text-xs leading-relaxed line-clamp-2">
          {reel.caption}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[#F4A800]">♥</span>
          <span className="font-body text-[#1E1208]/40 text-xs">{reel.likes} likes</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function InstagramFeed() {
  return (
    <section id="instagram" className="py-24 md:py-32 bg-[#F5EFE6] overflow-hidden">
      <div className="container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#2D5A27]" />
              <span className="text-[#2D5A27] font-body text-xs font-semibold tracking-widest uppercase">
                @afropuppyyoga
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1E1208]">
              Watch the Magic
              <br />
              <span className="italic text-[#2D5A27]">Unfold</span>
            </h2>
            <p className="mt-3 font-body text-[#1E1208]/60 text-base max-w-md">
              Our latest Reels from Instagram — real moments from real classes, straight from the mat.
            </p>
          </motion.div>

          <motion.a
            href="https://www.instagram.com/afropuppyyoga"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#F4A800] to-[#E1306C] text-white font-body font-semibold text-sm rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 self-start md:self-auto"
          >
            <Instagram size={16} />
            Follow on Instagram
          </motion.a>
        </div>

        {/* Reels grid — horizontal scroll on mobile, 3-col on desktop */}
        <div className="flex md:grid md:grid-cols-3 gap-5 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
          {REELS.map((reel, i) => (
            <ReelCard key={reel.shortcode} reel={reel} index={i} />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="font-body text-[#1E1208]/50 text-sm mb-4">
            New content every week — follow us to stay in the loop!
          </p>
          <a
            href="https://www.instagram.com/afropuppyyoga"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-body text-sm font-semibold text-[#2D5A27] hover:text-[#1E1208] transition-colors duration-200"
          >
            <Instagram size={15} />
            @afropuppyyoga · 10K+ followers
          </a>
        </motion.div>
      </div>
    </section>
  );
}
