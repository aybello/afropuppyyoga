/* ============================================================
   Gift Cards Section — Warm, inviting CTA strip
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Gift, Heart } from "lucide-react";

const BOOK_URL = "https://lu.ma/afropuppyyoga";
const GIFT_CARD_URL = "https://luma.com/15iajebr";

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function GiftCards() {
  return (
    <section className="py-10 md:py-20 bg-[#F2A0B8]">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left */}
          <FadeUp>
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-[#1A0A12]/15 flex items-center justify-center shrink-0">
                <Gift size={28} className="text-[#1A0A12]" />
              </div>
              <div>
                <h2 className="font-display font-bold text-3xl md:text-4xl text-[#1A0A12] mb-2">
                  Give the Gift of Joy
                </h2>
                <p className="font-body text-[#1A0A12]/70 text-lg leading-relaxed max-w-lg">
                  AfroPuppyYoga gift cards are the perfect present for birthdays, holidays, and anyone who deserves a little puppy love. Available in any amount.
                </p>
              </div>
            </div>
          </FadeUp>

          {/* Right */}
          <FadeUp delay={0.15}>
            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
              <a
                href={GIFT_CARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-[#1A0A12] text-white font-body font-bold text-base rounded-full hover:bg-[#2D1A0A] transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <Gift size={18} />
                Buy a Gift Card
              </a>
              <a
                href="mailto:afropuppyyogaofficial@gmail.com?subject=Gift%20Card%20Inquiry"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-white/30 text-[#1A0A12] font-body font-semibold text-base rounded-full border-2 border-[#1A0A12]/20 hover:bg-white/50 transition-all duration-200"
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
