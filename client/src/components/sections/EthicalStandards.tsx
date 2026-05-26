/**
 * EthicalStandards Section — Compact summary version
 * Shows 4 commitment pillars as icon badges + a brief intro,
 * with a "Read Our Full Standards →" link to the /ethics page.
 * Keeps homepage scroll length manageable.
 */

import { Heart, Shield, Users, Leaf, ArrowRight } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const pillars = [
  {
    icon: Shield,
    title: "Ethical Sourcing",
    summary: "We partner only with responsible breeders and registered rescues — never puppy mills.",
  },
  {
    icon: Heart,
    title: "Puppy-Centered Classes",
    summary: "Calm Zones, rest breaks, and pet-safe sanitization ensure every pup is comfortable.",
  },
  {
    icon: Users,
    title: "Supervised Interactions",
    summary: "Dedicated Puppy Monitors observe every class. Gentle handling rules are strictly enforced.",
  },
  {
    icon: Leaf,
    title: "Responsible Socialization",
    summary: "Our controlled environment supports healthy development during the critical socialization window.",
  },
];

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function EthicalStandards() {
  return (
    <section id="ethical-standards" className="py-10 md:py-20 bg-white">
      <div className="container">

        {/* Header row */}
        <FadeUp>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#8B2252]" />
                <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                  Our Commitment
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1A0A12] leading-tight">
                Puppy Welfare &{" "}
                <span className="italic text-[#8B2252]">Ethical Standards</span>
              </h2>
              <p className="mt-4 font-body text-[#1A0A12]/65 text-base md:text-lg leading-relaxed max-w-xl">
                The wellbeing of our puppies comes first — always. Every decision we make is guided by four core commitments.
              </p>
            </div>
            <a
              href="/ethics"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#8B2252] text-[#8B2252] font-body font-semibold text-sm rounded-full hover:bg-[#8B2252] hover:text-white transition-all duration-200 self-start md:self-auto shrink-0"
            >
              Read Full Standards
              <ArrowRight size={15} />
            </a>
          </div>
        </FadeUp>

        {/* 4-pillar grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-[#FFF5F8] border border-[#F0D0DC] rounded-2xl p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-[#8B2252]/10 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-[#8B2252]" />
                </div>
                <h3 className="font-display font-bold text-base text-[#1A0A12] mb-2">{pillar.title}</h3>
                <p className="font-body text-sm text-[#1A0A12]/65 leading-relaxed">{pillar.summary}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Transparency callout */}
        <FadeUp delay={0.3}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FFF5F8] border border-[#F0D0DC] rounded-2xl px-8 py-6">
            <p className="font-body text-[#1A0A12]/70 text-sm md:text-base max-w-lg">
              <strong className="text-[#1A0A12]">Transparency is our promise.</strong> Questions about our practices or puppy partners? We're happy to share everything.
            </p>
            <a
              href="#contact"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-2.5 bg-[#8B2252] text-white font-body font-semibold text-sm rounded-full hover:bg-[#6B1A3F] transition-colors duration-200"
            >
              Get in Touch
            </a>
          </div>
        </FadeUp>

      </div>
    </section>
  );
}
