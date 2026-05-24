/* ============================================================
   Loyalty Program Section — "The Pack"
   Layout: Headline + 3-step paw progression + CTA
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
    <section id="loyalty" ref={ref} className="py-16 md:py-28 bg-[#1A0A12]">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-0.5 bg-[#F2A0B8]" />
            <span className="text-[#F2A0B8] font-body text-xs font-semibold tracking-widest uppercase">
              The Pack
            </span>
            <div className="w-8 h-0.5 bg-[#F2A0B8]" />
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight">
            Come Back.<br />
            <span className="italic text-[#F2A0B8]">We Save Your Spot.</span>
          </h2>
          <p className="font-body text-white/70 text-lg max-w-xl mx-auto leading-relaxed">
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
              className="relative"
            >
              {/* Connector line between steps */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(100%+0px)] w-8 border-t-2 border-dashed border-[#F2A0B8]/30 z-10" style={{ transform: "translateX(-50%)" }} />
              )}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-7 h-full flex flex-col items-start">
                <div className="w-12 h-12 rounded-full bg-[#8B2252] flex items-center justify-center mb-5 text-xl">
                  {step.emoji}
                </div>
                <div className="text-[#F2A0B8] font-body text-xs font-semibold tracking-widest uppercase mb-2">
                  Step {step.number}
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-3">
                  {step.title}
                </h3>
                <p className="font-body text-white/60 text-sm leading-relaxed">
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
          className="bg-[#8B2252]/20 border border-[#8B2252]/30 rounded-2xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6 mb-10"
        >
          <div className="flex flex-wrap gap-6 justify-center md:justify-start">
            <div className="text-center md:text-left">
              <div className="text-white font-display font-bold text-2xl">3</div>
              <div className="text-white/50 font-body text-xs uppercase tracking-wide">Classes</div>
            </div>
            <div className="w-px bg-white/10 hidden md:block" />
            <div className="text-center md:text-left">
              <div className="text-white font-display font-bold text-2xl">1</div>
              <div className="text-white/50 font-body text-xs uppercase tracking-wide">Free Ticket</div>
            </div>
            <div className="w-px bg-white/10 hidden md:block" />
            <div className="text-center md:text-left">
              <div className="text-white font-display font-bold text-2xl">60</div>
              <div className="text-white/50 font-body text-xs uppercase tracking-wide">Day Expiry</div>
            </div>
            <div className="w-px bg-white/10 hidden md:block" />
            <div className="text-center md:text-left">
              <div className="text-[#F2A0B8] font-display font-bold text-2xl">∞</div>
              <div className="text-white/50 font-body text-xs uppercase tracking-wide">Repeats Forever</div>
            </div>
          </div>
          <div className="text-white/50 font-body text-sm text-center md:text-right max-w-xs">
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
            className="inline-flex items-center px-8 py-4 border border-white/20 text-white font-body font-semibold text-base rounded-full hover:border-white/40 hover:bg-white/5 transition-all duration-200"
          >
            Learn More
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
