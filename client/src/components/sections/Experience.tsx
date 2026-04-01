/* ============================================================
   Experience Section — What to expect at AfroPuppyYoga
   Layout: Asymmetric two-column with large image + feature list
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

const CLASS_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/VAHzfQKnVMpHXicj.jpg";
const BOOK_URL = "https://lu.ma/afropuppyyoga";

const features = [
  { label: "40 minutes of guided yoga with puppies" },
  { label: "20 minutes of dedicated puppy playtime & cuddles" },
  { label: "Complimentary refreshments included" },
  { label: "Afro-themed music & vibrant atmosphere" },
  { label: "Photos & videos to capture every moment" },
  { label: "All ages 12+ welcome" },
];

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

function StatCounter({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const { count, ref } = useCountUp(value, 2000);
  return (
    <FadeUp delay={delay}>
      <div className="text-center" ref={ref as unknown as React.RefObject<HTMLDivElement>}>
        <div className="font-display font-bold text-4xl md:text-5xl text-[#8B2252] mb-2">
          {count.toLocaleString()}{suffix}
        </div>
        <div className="font-body text-sm text-[#1A0A12]/60 font-medium uppercase tracking-wide">
          {label}
        </div>
      </div>
    </FadeUp>
  );
}

export default function Experience() {
  return (
    <section id="experience" className="py-24 md:py-32 bg-[#FFF5F8]">
      <div className="container">
        {/* Section header */}
        <FadeUp>
          <div className="mb-16 md:mb-20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                The Experience
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-[#1A0A12] max-w-2xl">
              A Class Unlike
              <br />
              <span className="italic text-[#8B2252]">Anything Else</span>
            </h2>
          </div>
        </FadeUp>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image column */}
          <FadeUp delay={0.1}>
            <div className="relative">
              <div className="relative overflow-hidden rounded-2xl aspect-[4/3] shadow-2xl">
                <img
                  src={CLASS_IMG}
                  alt="AfroPuppyYoga class with participants and puppies"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
                {/* Decorative overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A0A12]/30 to-transparent" />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-6 -right-4 md:-right-8 bg-[#F2A0B8] text-[#1A0A12] rounded-2xl px-6 py-4 shadow-xl">
                <div className="font-display font-bold text-3xl">60</div>
                <div className="font-body text-xs font-semibold uppercase tracking-wide">Min Session</div>
              </div>
              {/* Decorative element */}
              <div className="absolute -top-4 -left-4 w-24 h-24 rounded-full bg-[#8B2252]/10 -z-10" />
            </div>
          </FadeUp>

          {/* Content column */}
          <div className="space-y-8">
            <FadeUp delay={0.2}>
              <p className="font-body text-[#1A0A12]/75 text-lg leading-relaxed">
                Immerse yourself in a rejuvenating puppy yoga session unlike anything else. Each class begins with 40 minutes of guided yoga designed to calm your mind, relax your body, and help you reconnect with your breath.
              </p>
              <p className="font-body text-[#1A0A12]/75 text-lg leading-relaxed mt-4">
                Afterward, enjoy 20 minutes of pure joy as the puppies come out for cuddles, playtime, and photos. Complimentary refreshments and an Afro-inspired ambiance filled with warm rhythms complete the experience.
              </p>
            </FadeUp>

            {/* Feature list */}
            <FadeUp delay={0.3}>
              <ul className="space-y-3">
                {features.map((f, i) => (
                  <motion.li
                    key={f.label}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#8B2252] flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                    <span className="font-body text-[#1A0A12]/80 text-base">{f.label}</span>
                  </motion.li>
                ))}
              </ul>
            </FadeUp>

            <FadeUp delay={0.5}>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-4 bg-[#8B2252] text-white font-body font-semibold text-base rounded-full hover:bg-[#6B1A3F] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                Book Your Spot
              </a>
            </FadeUp>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-20 md:mt-28 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCounter value={1000} suffix="+" label="Happy Participants" delay={0} />
          <StatCounter value={167} suffix="+" label="5-Star Reviews" delay={0.1} />
          <StatCounter value={3} suffix="" label="Ontario Locations" delay={0.2} />
          <StatCounter value={100} suffix="%" label="Guest Approval" delay={0.3} />
        </div>
      </div>
    </section>
  );
}
