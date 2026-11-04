/* ============================================================
   Our Values Section — Brand values extracted from Reviews
   Layout: 3-col grid of value cards
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const values = [
  { title: "Wellness First", desc: "Creating a balanced space for mind and body through gentle movement and relaxation." },
  { title: "Community Spirit", desc: "More than a class — a community where genuine connections and shared memories are made." },
  { title: "Compassion & Care", desc: "Kindness in everything we do, ensuring both guests and puppies feel safe and valued." },
  { title: "Joyful Energy", desc: "Positivity and laughter in every class — movement, good vibes, and puppy interactions." },
  { title: "Inclusivity", desc: "Everyone is welcome. We embrace all ages, backgrounds, and experience levels." },
  { title: "Wholesome Fun", desc: "Blending wellness with play, turning each session into a meaningful, memorable experience." },
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

export default function OurValues() {
  return (
    <section id="our-values" className="py-10 md:py-16 bg-[#FEFAF4]">
      <div className="container">
        <FadeUp>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-0.5 bg-[#B83F67]" />
            <span className="text-[#B83F67] font-body text-xs font-semibold tracking-widest uppercase">Our Values</span>
          </div>
          <h3 className="font-display text-3xl md:text-4xl font-medium text-[#34221D] mb-2">
            The Principles Behind Every Session
          </h3>
          <p className="font-body text-[#34221D]/70 mb-10">What guides every class, every event, and every puppy cuddle.</p>
        </FadeUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          {values.map((val, i) => (
            <motion.div
              key={val.title}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="flex gap-3 pt-5 border-t border-[#EBCDD5]"
            >
              <div>
                <h4 className="font-display font-medium text-lg text-[#34221D] mb-1">{val.title}</h4>
                <p className="font-body text-sm md:text-base text-[#34221D]/70 leading-relaxed">{val.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
