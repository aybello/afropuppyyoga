/* ============================================================
   About Section — Brand story + benefits
   Layout: Asymmetric editorial with image + text
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Heart, Brain, Smile, Activity } from "lucide-react";

const ABOUT_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_about_img-J97haeYoPmNbnyyRPN9b8K.webp";

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
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function About() {
  return (
    <section id="about" className="py-24 md:py-32 bg-[#F5EFE0]">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Text column — comes first on mobile, second on desktop */}
          <div className="order-2 lg:order-1 space-y-8">
            <FadeUp>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#D4603A]" />
                <span className="text-[#D4603A] font-body text-xs font-semibold tracking-widest uppercase">
                  About Us
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1E1208] leading-tight">
                Where Wellness Meets
                <br />
                <span className="italic text-[#D4603A]">Culture & Puppy Love</span>
              </h2>
            </FadeUp>

            <FadeUp delay={0.15}>
              <p className="font-body text-[#1E1208]/75 text-lg leading-relaxed">
                <strong className="text-[#1E1208] font-semibold">AfroPuppyYoga (APY)</strong> blends the serene art of yoga with the playful spirit of puppies, all set to the rhythmic beauty of Afro beats.
              </p>
              <p className="font-body text-[#1E1208]/75 text-lg leading-relaxed mt-4">
                In each class, participants engage in a series of yoga poses that enhance flexibility and reduce stress, while adorable puppies roam freely, adding a touch of joy and spontaneity. Our sessions create a warm, uplifting atmosphere that relaxes the body and energizes the mind.
              </p>
            </FadeUp>

            {/* Pull quote */}
            <FadeUp delay={0.25}>
              <blockquote className="border-l-4 border-[#D4603A] pl-6 py-2">
                <p className="font-accent text-xl md:text-2xl italic text-[#1E1208]/80 leading-relaxed">
                  "An inclusive, vibrant atmosphere inspired by culture, movement, and music — turning every class into a celebration."
                </p>
              </blockquote>
            </FadeUp>

            {/* Benefits grid */}
            <FadeUp delay={0.35}>
              <div className="grid grid-cols-2 gap-4 pt-4">
                {benefits.map((b, i) => (
                  <motion.div
                    key={b.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                    className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-[#e8dcc8] hover:border-[#D4603A]/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#D4603A]/10 flex items-center justify-center mb-3">
                      <b.icon size={18} className="text-[#D4603A]" />
                    </div>
                    <h3 className="font-display font-bold text-sm text-[#1E1208] mb-1">{b.title}</h3>
                    <p className="font-body text-xs text-[#1E1208]/60 leading-relaxed">{b.desc}</p>
                  </motion.div>
                ))}
              </div>
            </FadeUp>
          </div>

          {/* Image column */}
          <div className="order-1 lg:order-2">
            <FadeUp delay={0.1}>
              <div className="relative">
                <div className="relative overflow-hidden rounded-3xl shadow-2xl aspect-[3/4] max-w-sm mx-auto lg:max-w-none">
                  <img
                    src={ABOUT_IMG}
                    alt="AfroPuppyYoga instructor with puppy"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1E1208]/20 to-transparent" />
                </div>
                {/* Decorative circles */}
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-[#D4603A]/15 -z-10" />
                <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full bg-[#2D5A27]/10 -z-10" />
                {/* Floating tag */}
                <div className="absolute top-6 -left-4 md:-left-8 bg-[#2D5A27] text-white rounded-xl px-4 py-3 shadow-lg">
                  <div className="font-body text-xs font-semibold uppercase tracking-wide mb-0.5 text-white/70">Afro-Beat</div>
                  <div className="font-display font-bold text-sm">Yoga + Puppies</div>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
