/* ============================================================
   Loyalty Program Section — "The Pack"
   Layout: Headline + 3-step paw progression + CTA
   Colors: Warm light palette matching APY brand (#FEFAF4, #8B2252, #F2A0B8)
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "wouter";

const steps = [
  {
    number: "1",
    emoji: "🐾",
    title: "Attend a Class",
    description: "Book any APY class through Luma using your email address. Every class counts.",
  },
  {
    number: "2",
    emoji: "🐾",
    title: "Come Back Again",
    description: "Attend a second class. You'll receive a progress email after each one so you always know where you stand.",
  },
  {
    number: "3",
    emoji: "🎉",
    title: "Earn a Free Class",
    description: "After your third class, a free ticket lands in your inbox automatically. No forms, no codes to remember.",
  },
];

export default function LoyaltyProgram() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="loyalty" ref={ref} className="py-16 md:py-28 bg-[#FDE8F0]">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-0.5 bg-[#8B2252]" />
            <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
              The Pack
            </span>
            <div className="w-8 h-0.5 bg-[#8B2252]" />
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-[#1A0A12] mb-5 leading-tight">
            Come Back.<br />
            <span className="italic text-[#8B2252]">We Save Your Spot.</span>
          </h2>
          <p className="font-body text-[#1A0A12]/65 text-lg max-w-xl mx-auto leading-relaxed">
            The APY Loyalty Program rewards you for showing up. Attend 3 classes and your next one is on us — automatically.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-14">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 * i }}
            >
              <div className="bg-white border border-[#F2A0B8]/40 rounded-2xl p-7 h-full flex flex-col items-start shadow-sm">
                <div className="w-12 h-12 rounded-full bg-[#F2A0B8]/30 flex items-center justify-center mb-5 text-xl">
                  {step.emoji}
                </div>
                <div className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase mb-2">
                  Step {step.number}
                </div>
                <h3 className="font-display text-xl font-bold text-[#1A0A12] mb-3">
                  {step.title}
                </h3>
                <p className="font-body text-[#1A0A12]/60 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Details strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-[#8B2252]/8 border border-[#F2A0B8]/50 rounded-2xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6 mb-10"
        >
          <div className="flex flex-wrap gap-6 justify-center md:justify-start">
            {[
              { value: "3", label: "Classes" },
              { value: "1", label: "Free Ticket" },
              { value: "60", label: "Day Expiry" },
              { value: "∞", label: "Repeats Forever" },
            ].map((stat, i) => (
              <div key={i} className="text-center md:text-left">
                <div className="text-[#8B2252] font-display font-bold text-2xl">{stat.value}</div>
                <div className="text-[#1A0A12]/50 font-body text-xs uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="text-[#1A0A12]/50 font-body text-sm text-center md:text-right max-w-xs">
            The cycle resets after each reward. Class 4 becomes your new Class 1.
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="https://lu.ma/afropuppyyoga"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-8 py-4 bg-[#8B2252] text-white font-body font-semibold text-base rounded-full hover:bg-[#6B1A3F] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Book a Class
          </a>
          <Link
            href="/loyalty"
            className="inline-flex items-center px-8 py-4 border border-[#8B2252]/30 text-[#8B2252] font-body font-semibold text-base rounded-full hover:border-[#8B2252]/60 hover:bg-[#8B2252]/5 transition-all duration-200"
          >
            Learn More
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
