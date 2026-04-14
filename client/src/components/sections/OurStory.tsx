/* ============================================================
   Our Story Section — Founder story, warm editorial layout
   Asymmetric text-forward design with decorative accent elements
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

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

export default function OurStory() {
  return (
    <section id="our-story" className="py-24 md:py-32 bg-white overflow-hidden">
      <div className="container">
        <div className="max-w-4xl mx-auto">

          {/* Section label */}
          <FadeUp>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-0.5 bg-[#C4547A]" />
              <span className="text-[#C4547A] font-body text-xs font-semibold tracking-widest uppercase">
                Our Story
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-[#1A0A12] leading-tight mb-10">
              Born From Love —
              <br />
              <span className="italic text-[#C4547A]">A Dog, A Dream & A Community</span>
            </h2>
          </FadeUp>

          {/* Story body */}
          <div className="space-y-6">
            <FadeUp delay={0.1}>
              <p className="font-body text-[#1A0A12]/75 text-lg leading-relaxed">
                <strong className="text-[#1A0A12] font-semibold">AfroPuppyYoga</strong> was founded by <strong className="text-[#1A0A12] font-semibold">Ay</strong> in 2024 — not from a business plan, but from a feeling. Growing up without dogs, his world changed the moment his brother brought one home. That dog opened doors he never expected: new friendships, spontaneous joy, and a sense of belonging he hadn't felt before.
              </p>
            </FadeUp>

            {/* Pull quote */}
            <FadeUp delay={0.2}>
              <blockquote className="border-l-4 border-[#C4547A] pl-6 py-3 my-8">
                <p className="font-accent text-xl md:text-2xl italic text-[#1A0A12]/80 leading-relaxed">
                  "There was a point in my life when I wasn't very happy. My dog was the one good thing I could always look forward to. He saved me."
                </p>
                <footer className="mt-3 font-body text-sm text-[#C4547A] font-semibold tracking-wide">— Ay, Founder of AfroPuppyYoga</footer>
              </blockquote>
            </FadeUp>

            <FadeUp delay={0.25}>
              <p className="font-body text-[#1A0A12]/75 text-lg leading-relaxed">
                That experience became the seed of something bigger — a space where wellness, community, and unconditional love could exist together. Ay wanted to share the kind of joy and connection that his dog had given him, and make it accessible to everyone.
              </p>
            </FadeUp>

            <FadeUp delay={0.3}>
              <p className="font-body text-[#1A0A12]/75 text-lg leading-relaxed">
                Built in collaboration with <strong className="text-[#1A0A12] font-semibold">Megan Durkin</strong> and <strong className="text-[#1A0A12] font-semibold">Ala Zeidan</strong> — engineering graduates from the University of Guelph — and students from Guelph's Animal Biology program and the Ontario Veterinary College, APY was designed from the ground up with both human and puppy wellbeing at its core.
              </p>
            </FadeUp>

            <FadeUp delay={0.35}>
              <p className="font-body text-[#1A0A12]/75 text-lg leading-relaxed">
                The wellness space isn't always inclusive — and Ay knew that firsthand. APY was built to be different: a warm, welcoming environment where everyone belongs, regardless of background, fitness level, or experience with yoga or dogs.
              </p>
            </FadeUp>

            <FadeUp delay={0.4}>
              <p className="font-body text-[#1A0A12]/75 text-lg leading-relaxed">
                The Afro-beat soundtrack? That's personal too. It was the music playing in the background while Ay was building APY late into the night — and it stayed, because wellness should feel like culture, not a chore.
              </p>
            </FadeUp>
          </div>

          {/* Founders strip */}
          <FadeUp delay={0.45}>
            <div className="mt-14 pt-10 border-t border-[#F0D0DC]">
              <p className="font-body text-xs text-[#1A0A12]/40 uppercase tracking-widest mb-4">Founded with</p>
              <div className="flex flex-wrap gap-4">
                {["Ay — Founder", "Megan Durkin — Co-founder", "Ala Zeidan — Co-founder"].map((name) => (
                  <div
                    key={name}
                    className="bg-[#FFF0F4] border border-[#F0D0DC] rounded-full px-5 py-2 font-body text-sm text-[#1A0A12]/70 font-medium"
                  >
                    {name}
                  </div>
                ))}
              </div>
              <p className="font-body text-xs text-[#1A0A12]/40 mt-4">
                In collaboration with the University of Guelph Animal Biology Program & Ontario Veterinary College
              </p>
            </div>
          </FadeUp>

        </div>
      </div>
    </section>
  );
}
