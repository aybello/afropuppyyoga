/* ============================================================
   InstagramFeed Section — Reel tiles, 9:16 aspect ratio
   Design: Warm Afro-Wellness Editorial (Pink variant)
   - 6 Reels: 2 customer review + 4 entertainment/relatable
   - 3-column grid desktop, horizontal snap-scroll on mobile
   ============================================================ */
import { motion } from "framer-motion";
import { Instagram } from "lucide-react";

const REELS = [
  {
    shortcode: "DV99b-vDPCy",
    caption: "Customer review 🐶❤️ — hear what our guests are saying!",
    tag: "Review",
  },
  {
    shortcode: "DVKKYGIEa4-",
    caption: "Another happy guest shares their puppy yoga experience 🧘‍♀️🐾",
    tag: "Review",
  },
  {
    shortcode: "DWaCFHXEXYy",
    caption: "i'm okay with it tho! 😂🐶 #puppyyoga #relationships",
    tag: "Relatable",
  },
  {
    shortcode: "DWPixfhESbI",
    caption: "got exactly what i wanted 😛 #puppyyoga #fyp",
    tag: "Relatable",
  },
  {
    shortcode: "DWU4taXDNKg",
    caption: "🧐🤨 #puppyyoga #dog #protect #relatable #fyp",
    tag: "Relatable",
  },
  {
    shortcode: "DWh-37KDNNr",
    caption: "gone….to puppy yoga! 🐶 #puppyyoga #puppylove",
    tag: "Relatable",
  },
];

function ReelCard({ reel, index }: { reel: typeof REELS[0]; index: number }) {
  const embedUrl = `https://www.instagram.com/reel/${reel.shortcode}/embed/captioned/`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      className="flex-shrink-0 w-[300px] md:w-auto snap-start group"
    >
      {/* 9:16 aspect ratio container */}
      <div
        className="relative rounded-2xl overflow-hidden bg-[#1A0A12] shadow-md group-hover:shadow-xl transition-shadow duration-300"
        style={{ paddingBottom: "177.78%" /* 16/9 * 100 */ }}
      >
        <iframe
          src={embedUrl}
          title={reel.caption}
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          scrolling="no"
          frameBorder="0"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "#1A0A12",
          }}
        />
      </div>

      {/* Tag + caption below */}
      <div className="mt-3 px-1">
        <span
          className={`inline-block font-body text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full mb-1.5 ${
            reel.tag === "Review"
              ? "bg-[#8B2252]/10 text-[#8B2252]"
              : "bg-[#F2A0B8]/30 text-[#6B1A3F]"
          }`}
        >
          {reel.tag}
        </span>
        <p className="font-body text-[#1A0A12]/70 text-xs leading-relaxed line-clamp-2">
          {reel.caption}
        </p>
      </div>
    </motion.div>
  );
}

export default function InstagramFeed() {
  return (
    <section id="instagram" className="py-24 md:py-32 bg-[#FFF0F4] overflow-hidden">
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
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                @afropuppyyoga
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1A0A12]">
              Watch the Magic
              <br />
              <span className="italic text-[#8B2252]">Unfold</span>
            </h2>
            <p className="mt-3 font-body text-[#1A0A12]/60 text-base max-w-md">
              Real moments from real classes — plus what our guests have to say.
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#F2A0B8] to-[#E1306C] text-white font-body font-semibold text-sm rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 self-start md:self-auto"
          >
            <Instagram size={16} />
            Follow on Instagram
          </motion.a>
        </div>

        {/* Reels grid */}
        <div className="flex md:grid md:grid-cols-3 gap-5 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none scrollbar-hide">
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
          <p className="font-body text-[#1A0A12]/50 text-sm mb-4">
            New content every week — follow us to stay in the loop!
          </p>
          <a
            href="https://www.instagram.com/afropuppyyoga"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-body text-sm font-semibold text-[#8B2252] hover:text-[#1A0A12] transition-colors duration-200"
          >
            <Instagram size={15} />
            @afropuppyyoga · 10K+ followers
          </a>
        </motion.div>
      </div>
    </section>
  );
}
