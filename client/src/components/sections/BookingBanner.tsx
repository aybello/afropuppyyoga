/* ============================================================
   Booking Banner — Upcoming classes highlight strip
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";

const BOOK_URL = "https://www.eventbrite.ca/o/afropuppyyoga-84060688843";

const upcomingClasses = [
  {
    city: "Mississauga",
    date: "Saturdays & Sundays",
    time: "10:00 AM – 11:00 AM",
    spots: "Limited spots",
  },
  {
    city: "Hamilton",
    date: "Saturdays",
    time: "12:00 PM – 1:00 PM",
    spots: "Limited spots",
  },
  {
    city: "Kitchener",
    date: "Sundays",
    time: "2:00 PM – 3:00 PM",
    spots: "Limited spots",
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

export default function BookingBanner() {
  return (
    <section className="py-20 md:py-24 bg-[#2D5A27]">
      <div className="container">
        <FadeUp>
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#F4A800]" />
              <span className="text-[#F4A800] font-body text-xs font-semibold tracking-widest uppercase">
                Upcoming Classes
              </span>
              <div className="w-8 h-0.5 bg-[#F4A800]" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              Find a Class Near You
            </h2>
            <p className="font-body text-white/60 text-base">
              Classes run weekly across three Ontario cities. Spots fill up fast!
            </p>
          </div>
        </FadeUp>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {upcomingClasses.map((cls, i) => (
            <motion.div
              key={cls.city}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-[#F4A800]/30 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={16} className="text-[#F4A800]" />
                <span className="font-display font-bold text-white text-lg">{cls.city}</span>
              </div>
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-white/40 shrink-0" />
                  <span className="font-body text-white/70 text-sm">{cls.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-white/40 shrink-0" />
                  <span className="font-body text-white/70 text-sm">{cls.time}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-block px-3 py-1 bg-[#F4A800]/20 text-[#F4A800] font-body text-xs font-semibold rounded-full">
                  {cls.spots}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <FadeUp delay={0.3}>
          <div className="text-center">
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#F4A800] text-[#1E1208] font-body font-bold text-base rounded-full hover:bg-[#e09800] transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              View All Classes & Book Now
              <ArrowRight size={18} />
            </a>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
