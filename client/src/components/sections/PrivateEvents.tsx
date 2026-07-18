/* ============================================================
   Private Events Section — Corporate + Personal events
   Layout: Full-bleed image with overlaid content cards
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Building2, PartyPopper, Users, MapPin, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { trackCTAClick } from "@/hooks/useAnalytics";

const EVENTS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_private_events-Nb3wGnpKGLiacEq7DDkbgp.webp";


const eventTypes = [
  {
    icon: Building2,
    title: "Corporate Wellness",
    desc: "Boost team morale, melt stress, and spark real connection. Perfect for mental health days, creative offsites, and team appreciation events.",
    tag: "Team Building",
  },
  {
    icon: PartyPopper,
    title: "Private Parties",
    desc: "Birthdays, bachelorettes, baby showers, and more. Our sessions bring pure happiness, laughter, and connection to your celebration.",
    tag: "Celebrations",
  },
];

const includes = [
  "45–60 min yoga class with adorable puppies",
  "Certified yoga instructors & event hosts",
  "All mats, props & cleanup provided",
  "Custom playlists and Afro-inspired ambiance",
  "Add-ons: Photography, Refreshments & Merchandise",
];

const locations = ["Toronto", "Kitchener", "Guelph", "Hamilton", "Oakville"];

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

export default function PrivateEvents() {
  return (
    <section id="private-events" className="py-10 md:py-32 bg-[#FFF5F8] relative overflow-hidden">
      {/* Background image with dark overlay */}
      <div className="absolute inset-0">
        <img
          src={EVENTS_IMG}
          alt="Private puppy yoga event"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0A12]/50 via-[#1A0A12]/40 to-[#1A0A12]/70" />
      </div>

      {/* Decorative circles — clipped by section overflow-hidden */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#8B2252]/5 translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#8B2252]/10 -translate-x-1/3 translate-y-1/3" />

      <div className="relative container">
        {/* Header */}
        <FadeUp>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                Private Events
              </span>
              <div className="w-8 h-0.5 bg-[#8B2252]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Host an Experience
              <br />
              <span className="italic text-[#F2A0B8]">They'll Never Forget</span>
            </h2>
            <p className="font-body text-white/70 text-lg max-w-2xl mx-auto leading-relaxed">
              Whether you're planning a corporate wellness day, team bonding session, birthday party, or bachelorette — AfroPuppyYoga brings joy, connection, and a whole lot of puppy cuddles to your event.
            </p>
          </div>
        </FadeUp>

        {/* Event type cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {eventTypes.map((event, i) => (
            <FadeUp key={event.title} delay={i * 0.15}>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#8B2252]/50 transition-all duration-300 hover:-translate-y-1 group">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#8B2252]/30 flex items-center justify-center shrink-0 group-hover:bg-[#8B2252]/50 transition-colors">
                    <event.icon size={22} className="text-white" />
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 bg-[#8B2252]/30 text-white text-xs font-body font-semibold rounded-full mb-2">
                      {event.tag}
                    </span>
                    <h3 className="font-display font-bold text-xl text-white">{event.title}</h3>
                  </div>
                </div>
                <p className="font-body text-white/65 leading-relaxed">{event.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>

        {/* What's included + Locations */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <FadeUp delay={0.2}>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <div className="flex items-center gap-2 mb-5">
                <Users size={18} className="text-[#8B2252]" />
                <h3 className="font-display font-bold text-lg text-white">What's Included</h3>
              </div>
              <ul className="space-y-3">
                {includes.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8B2252] mt-2 shrink-0" />
                    <span className="font-body text-white/70 text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <div className="flex items-center gap-2 mb-5">
                <MapPin size={18} className="text-[#8B2252]" />
                <h3 className="font-display font-bold text-lg text-white">Available Locations</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {locations.map((loc) => (
                  <span
                    key={loc}
                    className="px-4 py-2 bg-[#8B2252]/25 text-white font-body text-sm font-medium rounded-full border border-[#8B2252]/50"
                  >
                    {loc}
                  </span>
                ))}
              </div>
              <p className="font-body text-white/50 text-sm mt-6 leading-relaxed">
                We'll come to your location and transform your event into a feel-good memory filled with laughter, connection, and plenty of tail wags.
              </p>
            </div>
          </FadeUp>
        </div>

        {/* CTA */}
        <FadeUp delay={0.4}>
          <div className="text-center">
            <Link
              href="/private-events/quote"
              onClick={() => trackCTAClick("Book Your Private Event — Private Events")}
              className="inline-flex items-center gap-3 px-12 py-5 bg-[#8B2252] text-white font-body font-bold text-lg rounded-full hover:bg-[#7a1d47] transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              <Sparkles size={20} />
              Book Your Private Event
            </Link>
            <p className="font-body text-white/40 text-sm mt-5">
              Get an instant quote in 60 seconds — no commitment required.
            </p>
            <p className="font-body text-white/30 text-xs mt-2">
              Questions?{" "}
              <a href="mailto:afropuppyyogaofficial@gmail.com" className="text-[#8B2252]/70 hover:text-[#8B2252] transition-colors">
                afropuppyyogaofficial@gmail.com
              </a>
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
