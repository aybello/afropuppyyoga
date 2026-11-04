/* ============================================================
   Private Events Section — Corporate + Personal events
   Layout: Authentic event photo and editorial header with light content panels
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Building2, PartyPopper, Users, MapPin, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { trackCTAClick } from "@/hooks/useAnalytics";

const EVENTS_IMG = "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg";


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
      initial={false}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function PrivateEvents() {
  return (
    <section id="private-events" className="py-10 md:py-20 bg-[#FDE9EF] relative">
      <div className="relative container">
        {/* Header */}
        <div className="grid lg:grid-cols-[1.1fr_1fr] items-center gap-8 lg:gap-14 mb-12">
          <FadeUp>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-px bg-[#EBCDD5]" />
                <span className="text-[#B83F67] font-body text-xs font-semibold tracking-widest uppercase">
                  Private Events
                </span>
                <div className="w-8 h-px bg-[#EBCDD5]" />
              </div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium text-[#34221D] mb-6">
                Host an Experience
                <br />
                <span className="italic text-[#B83F67]">They'll Never Forget</span>
              </h2>
              <p className="font-body text-[#34221D]/70 text-lg max-w-2xl leading-relaxed">
                Whether you're planning a corporate wellness day, team bonding session, birthday party, or bachelorette — AfroPuppyYoga brings joy, connection, and a whole lot of puppy cuddles to your event.
              </p>
            </div>
          </FadeUp>
          <img src={EVENTS_IMG} alt="Smiling AfroPuppyYoga guest holding two Golden Retriever puppies" loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover rounded-2xl" />
        </div>

        {/* Event type cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {eventTypes.map((event, i) => (
            <FadeUp key={event.title} delay={i * 0.15}>
              <div className="bg-[#FEFAF4] backdrop-blur-sm rounded-2xl p-8 border border-[#EBCDD5] hover:border-[#B83F67]/50 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FDE9EF]/30 flex items-center justify-center shrink-0 group-hover:bg-[#FDE9EF]/50 transition-colors">
                    <event.icon size={22} className="text-[#34221D]" />
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 bg-[#F29CB8]/30 text-[#34221D] text-xs font-body font-semibold rounded-full mb-2">
                      {event.tag}
                    </span>
                    <h3 className="font-display font-medium text-xl text-[#34221D]">{event.title}</h3>
                  </div>
                </div>
                <p className="font-body text-[#34221D]/65 leading-relaxed">{event.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>

        {/* What's included + Locations */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <FadeUp delay={0.2}>
            <div className="bg-[#FEFAF4] rounded-2xl p-8 border border-[#EBCDD5]">
              <div className="flex items-center gap-2 mb-5">
                <Users size={18} className="text-[#B83F67]" />
                <h3 className="font-display font-medium text-lg text-[#34221D]">What's Included</h3>
              </div>
              <ul className="space-y-3">
                {includes.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B83F67] mt-2 shrink-0" />
                    <span className="font-body text-[#34221D]/70 text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div className="bg-[#FEFAF4] rounded-2xl p-8 border border-[#EBCDD5]">
              <div className="flex items-center gap-2 mb-5">
                <MapPin size={18} className="text-[#B83F67]" />
                <h3 className="font-display font-medium text-lg text-[#34221D]">Available Locations</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {locations.map((loc) => (
                  <span
                    key={loc}
                    className="px-4 py-2 bg-[#F29CB8]/25 text-[#34221D] font-body text-sm font-medium rounded-full border border-[#B83F67]/50"
                  >
                    {loc}
                  </span>
                ))}
              </div>
              <p className="font-body text-[#34221D]/65 text-sm mt-6 leading-relaxed">
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
              className="inline-flex items-center justify-center gap-3 px-7 sm:px-10 py-4 bg-[#F29CB8] text-[#34221D] font-body font-bold text-lg rounded-full hover:bg-[#FEFAF4] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Sparkles size={20} />
              Book Your Private Event
            </Link>
            <p className="font-body text-[#34221D]/65 text-sm mt-5">
              Get an instant quote in 60 seconds — no commitment required.
            </p>
            <p className="font-body text-[#34221D]/65 text-xs mt-2">
              Questions?{" "}
              <a href="mailto:afropuppyyoga@gmail.com" className="text-[#B83F67] hover:text-[#34221D] transition-colors">
                afropuppyyoga@gmail.com
              </a>
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
