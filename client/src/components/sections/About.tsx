/* ============================================================
   About Section — Brand story + benefits
   Layout: Asymmetric editorial with image + text
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Heart, Brain, Smile, Activity } from "lucide-react";

const ABOUT_IMG = "/manus-storage/apy_kitchener_gallery_04_oct04_portrait_464e300c.jpg";

const benefits = [
  {
    icon: Heart,
    title: "Stress Relief",
    desc: "Puppy interactions trigger oxytocin release, melting away tension and anxiety in minutes.",
  },
  {
    icon: Smile,
    title: "Mood Elevation",
    desc: "Laughter, movement, and puppy cuddles combine to create an instant mood boost that lasts for days.",
  },
  {
    icon: Brain,
    title: "Mindfulness",
    desc: "Guided breathwork and gentle yoga bring you fully into the present moment.",
  },
  {
    icon: Activity,
    title: "Physical Well-Being",
    desc: "Improve flexibility, reduce muscle tension, and strengthen your body through accessible yoga poses.",
  },
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

export default function About() {
  return (
    <section id="about" className="py-10 md:py-16 bg-[#FEFAF4]">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          {/* Text column — comes first on mobile, second on desktop */}
          <div className="order-1 space-y-8">
            <FadeUp>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#B83F67]" />
                <span className="text-[#B83F67] font-body text-xs font-semibold tracking-widest uppercase">
                  About Us
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-medium text-[#34221D] leading-tight">
                Where Wellness Meets
                <br />
                <span className="italic text-[#B83F67]">Culture & Puppy Love</span>
              </h2>
            </FadeUp>

            <FadeUp delay={0.15}>
              <p className="font-body text-[#34221D]/75 text-lg leading-relaxed">
                <strong className="text-[#34221D] font-semibold">AfroPuppyYoga (APY)</strong> blends the serene art of yoga with the playful spirit of puppies, all set to the rhythmic beauty of Afro beats.
              </p>
              <p className="font-body text-[#34221D]/75 text-lg leading-relaxed mt-4">
                In each class, participants engage in a series of yoga poses that enhance flexibility and reduce stress, while adorable puppies roam freely, adding a touch of joy and spontaneity. Our sessions create a warm, uplifting atmosphere that relaxes the body and energizes the mind.
              </p>
            </FadeUp>

            {/* Pull quote */}
            <FadeUp delay={0.25}>
              <blockquote className="border-l-4 border-[#B83F67] pl-6 py-2">
                <p className="font-accent text-xl md:text-2xl italic text-[#34221D]/80 leading-relaxed">
                  "An inclusive, vibrant atmosphere inspired by culture, movement, and music — turning every class into a celebration."
                </p>
              </blockquote>
            </FadeUp>

            {/* Benefits grid */}
            <FadeUp delay={0.35}>
              <div className="grid grid-cols-2 gap-3 pt-4">
                {benefits.map((b, i) => (
                  <motion.div
                    key={b.title}
                    initial={false}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                    className="bg-white/60 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-[#EBCDD5] hover:border-[#B83F67]/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#B83F67]/10 flex items-center justify-center mb-3">
                      <b.icon size={18} className="text-[#B83F67]" />
                    </div>
                    <h3 className="font-display font-medium text-sm text-[#34221D] mb-1">{b.title}</h3>
                    <p className="font-body text-xs text-[#34221D]/70 leading-relaxed">{b.desc}</p>
                  </motion.div>
                ))}
              </div>
            </FadeUp>
          </div>

          {/* Image column */}
          <div className="order-2">
            <FadeUp delay={0.1}>
              <div className="relative">
                <div className="relative overflow-hidden rounded-3xl shadow-sm aspect-[3/4] max-w-sm mx-auto lg:max-w-none">
                  <img
                    src={ABOUT_IMG}
                    alt="Smiling guest holding a puppy at an AfroPuppyYoga Kitchener class"
                    width={1500}
                    height={2000}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />

                </div>
                {/* Decorative circles */}


                {/* Floating tag */}
                <div className="mt-4 flex flex-wrap items-baseline gap-3 text-[#34221D]">
                  <div className="font-body text-xs font-semibold uppercase tracking-wide mb-0.5 text-[#66514A]">Afro-Beat</div>
                  <div className="font-display font-medium text-sm">Yoga + Puppies</div>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
