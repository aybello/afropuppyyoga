/* ============================================================
   Gift Cards Section — Warm, inviting CTA strip
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Gift, Heart } from "lucide-react";

const GIFT_CARD_URL = "https://luma.com/15iajebr";

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function GiftCards() {
  return (
    <section className="py-10 md:py-16 bg-[#FDE9EF]">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5 md:gap-8">
          {/* Left */}
          <FadeUp>
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-[#34221D]/15 flex items-center justify-center shrink-0">
                <Gift size={28} className="text-[#34221D]" />
              </div>
              <div>
                <h2 className="font-display font-medium text-3xl md:text-4xl text-[#34221D] mb-2">
                  Give the Gift of Joy
                </h2>
                <p className="font-body text-[#34221D]/70 text-sm md:text-lg leading-relaxed max-w-lg">
                  AfroPuppyYoga gift cards are the perfect present for birthdays, holidays, and anyone who deserves a little puppy love. Available in any amount.
                </p>
              </div>
            </div>
          </FadeUp>

          {/* Right */}
          <FadeUp delay={0.15}>
            <div className="flex flex-row md:flex-col lg:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
              <a
                href={GIFT_CARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 flex-1 md:flex-none px-5 md:px-8 py-3 md:py-4 bg-[#F29CB8] text-[#34221D] font-body font-bold text-sm md:text-base rounded-full hover:bg-[#FEFAF4] transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Gift size={18} />
                Buy a Gift Card
              </a>
              <a
                href="mailto:afropuppyyoga@gmail.com?subject=Gift%20Card%20Inquiry"
                className="inline-flex items-center justify-center gap-2 flex-1 md:flex-none px-5 md:px-8 py-3 md:py-4 bg-white/30 text-[#34221D] font-body font-semibold text-sm md:text-base rounded-full border-2 border-[#34221D]/20 hover:bg-white/50 transition-all duration-200"
              >
                <Heart size={18} />
                Learn More
              </a>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
