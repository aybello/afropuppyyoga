/* ============================================================
   Reviews Section — Testimonials + Values
   Layout: Scrolling testimonial cards + brand values
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Star, Quote } from "lucide-react";

const reviews = [
  {
    name: "Sheila Soares",
    rating: 5,
    text: "So fun and well run! Highly recommend this experience. The puppies were adorable and the yoga instructor was amazing. Will definitely be back!",
    date: "1 month ago",
    avatar: "SS",
  },
  {
    name: "Cameron T.",
    rating: 5,
    text: "Absolutely incredible experience! The Afro-beat music, the puppies, the yoga — everything was perfectly curated. I've never felt so relaxed and happy at the same time.",
    date: "2 months ago",
    avatar: "CT",
  },
  {
    name: "Priya M.",
    rating: 5,
    text: "Brought my whole friend group for a birthday celebration and everyone LOVED it. The staff were so welcoming and the puppies were pure joy. 10/10 would recommend!",
    date: "3 months ago",
    avatar: "PM",
  },
  {
    name: "Jessica L.",
    rating: 5,
    text: "I was nervous as a yoga beginner but the instructor made it so accessible and fun. The puppies kept interrupting my poses in the best way possible. Laughed the whole time!",
    date: "3 months ago",
    avatar: "JL",
  },
  {
    name: "Marcus R.",
    rating: 5,
    text: "Took my partner here for our anniversary. The vibe was immaculate — Afro beats, cute puppies, good energy. We're already planning our next visit.",
    date: "4 months ago",
    avatar: "MR",
  },
  {
    name: "Aisha B.",
    rating: 5,
    text: "As someone who does yoga regularly, this was such a refreshing twist. The cultural element with the music and the warmth of the instructors made it feel truly special.",
    date: "5 months ago",
    avatar: "AB",
  },
];

const values = [
  { title: "Wellness First", desc: "Creating a balanced space for mind and body through gentle movement and relaxation." },
  { title: "Community Spirit", desc: "More than a class — a community where genuine connections and shared memories are made." },
  { title: "Compassion & Care", desc: "Kindness in everything we do, ensuring both guests and puppies feel safe and valued." },
  { title: "Joyful Energy", desc: "Positivity and laughter in every class — movement, good vibes, and puppy interactions." },
  { title: "Inclusivity", desc: "Everyone is welcome. We embrace all ages, backgrounds, and experience levels." },
  { title: "Wholesome Fun", desc: "Blending wellness with play, turning each session into a meaningful, memorable experience." },
];

const avatarColors = [
  "bg-[#2D5A27]",
  "bg-[#D4603A]",
  "bg-[#F4A800]",
  "bg-[#2D5A27]",
  "bg-[#D4603A]",
  "bg-[#F4A800]",
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

export default function Reviews() {
  return (
    <section id="reviews" className="py-24 md:py-32 bg-[#F5EFE0]">
      <div className="container">
        {/* Header */}
        <FadeUp>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#D4603A]" />
                <span className="text-[#D4603A] font-body text-xs font-semibold tracking-widest uppercase">
                  Reviews
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1E1208]">
                See What Our
                <br />
                <span className="italic text-[#D4603A]">Clients Say</span>
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="font-display font-bold text-5xl text-[#1E1208]">4.9</div>
                <div className="flex gap-0.5 justify-center my-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-[#F4A800] text-[#F4A800]" />
                  ))}
                </div>
                <div className="font-body text-xs text-[#1E1208]/50">Based on 167+ reviews</div>
              </div>
              <a
                href="https://www.google.com/search?q=afropuppyyoga+reviews"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 border-2 border-[#D4603A] text-[#D4603A] font-body font-semibold text-sm rounded-full hover:bg-[#D4603A] hover:text-white transition-all duration-200"
              >
                Leave a Review
              </a>
            </div>
          </div>
        </FadeUp>

        {/* Review cards grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
          {reviews.map((review, i) => (
            <motion.div
              key={review.name}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-[#e8dcc8] hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${avatarColors[i]} flex items-center justify-center text-white font-body font-bold text-sm`}>
                    {review.avatar}
                  </div>
                  <div>
                    <div className="font-display font-bold text-sm text-[#1E1208]">{review.name}</div>
                    <div className="font-body text-xs text-[#1E1208]/40">{review.date}</div>
                  </div>
                </div>
                <Quote size={20} className="text-[#F4A800]/40 shrink-0" />
              </div>
              <div className="flex gap-0.5 mb-3">
                {[...Array(review.rating)].map((_, j) => (
                  <Star key={j} size={13} className="fill-[#F4A800] text-[#F4A800]" />
                ))}
              </div>
              <p className="font-body text-[#1E1208]/70 text-sm leading-relaxed">{review.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Values section */}
        <FadeUp>
          <div className="mb-10">
            <h3 className="font-display text-3xl font-bold text-[#1E1208] mb-2">
              Our Values, Shaped by Our Clients
            </h3>
            <p className="font-body text-[#1E1208]/60">The principles that guide every session we host.</p>
          </div>
        </FadeUp>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {values.map((val, i) => (
            <motion.div
              key={val.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="flex gap-4 p-5 bg-white/60 rounded-xl border border-[#e8dcc8]"
            >
              <div className="w-1.5 rounded-full bg-gradient-to-b from-[#2D5A27] to-[#D4603A] shrink-0" />
              <div>
                <h4 className="font-display font-bold text-base text-[#1E1208] mb-1.5">{val.title}</h4>
                <p className="font-body text-sm text-[#1E1208]/60 leading-relaxed">{val.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
