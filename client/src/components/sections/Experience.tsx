import { BOOK_URL } from "@/const";
/* ============================================================
   Experience Section — What to expect at AfroPuppyYoga
   Layout: Asymmetric two-column with large image + feature list
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { FIVE_STAR_REVIEW_COUNT, REVIEW_COUNT_LABEL } from "@shared/reviewMetrics";

const CLASS_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/VAHzfQKnVMpHXicj.jpg";

const features = [
  { label: "40 minutes of guided yoga with puppies" },
  { label: "20 minutes of dedicated puppy playtime & cuddles" },
  { label: "Complimentary refreshments included" },
  { label: "Afro-themed music & vibrant atmosphere" },
  { label: "Photos & videos to capture every moment" },
  { label: "All ages 12+ welcome (under 12 with parent/guardian)" },
];

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

function StatCounter({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const { count, ref } = useCountUp(value, 2000);
  return (
    <FadeUp delay={delay}>
      <div className="text-center" ref={ref as unknown as React.RefObject<HTMLDivElement>}>
        <div className="font-display font-medium text-4xl md:text-5xl text-[#B83F67] mb-2">
          {count.toLocaleString()}{suffix}
        </div>
        <div className="font-body text-sm text-[#34221D]/70 font-medium uppercase tracking-wide">
          {label}
        </div>
      </div>
    </FadeUp>
  );
}

export default function Experience() {
  return (
    <section id="experience" className="py-10 md:py-20 bg-[#FEFAF4]">
      <div className="container">
        {/* Section header */}
        <FadeUp>
          <div className="mb-10 md:mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#B83F67]" />
              <span className="text-[#B83F67] font-body text-xs font-semibold tracking-widest uppercase">
                The Experience
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium text-[#34221D] max-w-2xl">
              A Class Unlike
              <br />
              <span className="italic text-[#B83F67]">Anything Else</span>
            </h2>
          </div>
        </FadeUp>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Image column */}
          <FadeUp delay={0.1}>
            <div className="relative">
              <div className="relative overflow-hidden rounded-2xl aspect-[4/3] shadow-sm">
                <img
                  src={CLASS_IMG}
                  alt="AfroPuppyYoga class with participants and puppies"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {/* Decorative overlay */}

              </div>
              {/* Floating badge */}
              <div className="mt-4 flex items-baseline gap-2 text-[#34221D]">
                <div className="font-display font-medium text-2xl">60</div>
                <div className="font-body text-xs font-semibold uppercase tracking-wide">Min Session</div>
              </div>
              {/* Decorative element */}

            </div>
          </FadeUp>

          {/* Content column */}
          <div className="space-y-8">
            <FadeUp delay={0.2}>
              <p className="font-body text-[#34221D]/75 text-lg leading-relaxed">
                Immerse yourself in a rejuvenating puppy yoga session unlike anything else. Each class begins with 40 minutes of guided yoga designed to calm your mind, relax your body, and help you reconnect with your breath.
              </p>
              <p className="font-body text-[#34221D]/75 text-lg leading-relaxed mt-4">
                Afterward, enjoy 20 minutes of pure joy as the puppies come out for cuddles, playtime, and photos. Complimentary refreshments and an Afro-inspired ambiance filled with warm rhythms complete the experience.
              </p>
            </FadeUp>

            {/* Feature list */}
            <FadeUp delay={0.3}>
              <ul className="space-y-3">
                {features.map((f, i) => (
                  <motion.li
                    key={f.label}
                    initial={false}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#B83F67] flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                    <span className="font-body text-[#34221D]/80 text-base">{f.label}</span>
                  </motion.li>
                ))}
              </ul>
            </FadeUp>

            <FadeUp delay={0.5}>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-4 bg-[#F29CB8] text-[#34221D] font-body font-semibold text-base rounded-full hover:bg-[#FDE9EF] transition-all duration-200 shadow-md hover:shadow-md"
              >
                Book Your Spot
              </a>
            </FadeUp>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-12 md:mt-16 pt-8 border-t border-[#EBCDD5] grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCounter value={3486} suffix="+" label="Happy Participants" delay={0} />
          <StatCounter value={FIVE_STAR_REVIEW_COUNT} suffix="" label={REVIEW_COUNT_LABEL} delay={0.1} />
          <StatCounter value={4} suffix="" label="Ontario Locations" delay={0.2} />
          <StatCounter value={100} suffix="%" label="Guest Approval" delay={0.3} />
        </div>
      </div>
    </section>
  );
}
