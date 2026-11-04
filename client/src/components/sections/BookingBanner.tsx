import { BOOK_URL } from "@/const";
/* ============================================================
   Booking Banner — Upcoming classes highlight strip
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";


const upcomingClasses = [
  {
    city: "Kitchener",
    date: "Saturdays & Sundays",
    time: "10:00 AM – 4:30 PM",
    spots: "Limited spots",
  },
  {
    city: "Hamilton",
    date: "Saturdays",
    time: "11:00 AM – 5:30 PM",
    spots: "Limited spots",
  },
  {
    city: "Oakville",
    date: "Coming Soon",
    time: "Stay tuned",
    spots: "Notify me",
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

export default function BookingBanner() {
  return (
    <section className="py-10 md:py-24 bg-[#FDE9EF]">
      <div className="container">
        <FadeUp>
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#F29CB8]" />
              <span className="text-[#B83F67] font-body text-xs font-semibold tracking-widest uppercase">
                Upcoming Classes
              </span>
              <div className="w-8 h-0.5 bg-[#F29CB8]" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-medium text-[#34221D] mb-3">
              Find a Class Near You
            </h2>
            <p className="font-body text-[#34221D]/65 text-base">
              Classes run weekly across three Ontario cities. Spots fill up fast!
            </p>
          </div>
        </FadeUp>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {upcomingClasses.map((cls, i) => (
            <motion.div
              key={cls.city}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-[#FEFAF4] backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-[#EBCDD5] hover:border-[#F29CB8]/30 transition-all duration-300"
            >
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={16} className="text-[#B83F67]" />
                <span className="font-display font-medium text-[#34221D] text-lg">{cls.city}</span>
              </div>
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-[#34221D]/65 shrink-0" />
                  <span className="font-body text-[#34221D]/70 text-sm">{cls.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-[#34221D]/65 shrink-0" />
                  <span className="font-body text-[#34221D]/70 text-sm">{cls.time}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-block px-3 py-1 bg-[#F29CB8]/20 text-[#B83F67] font-body text-xs font-semibold rounded-full">
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
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#F29CB8] text-[#34221D] font-body font-bold text-base rounded-full hover:bg-[#FDE9EF] transition-all duration-200 shadow-sm hover:shadow-md"
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
