/* ============================================================
   Contact Section — Social links + contact info
   Layout: Two-column with contact info + social grid
   ============================================================ */
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Mail, Instagram, Facebook, Youtube, ExternalLink } from "lucide-react";

const BOOK_URL = "https://www.eventbrite.ca/o/afropuppyyoga-84060688843";

const socials = [
  {
    name: "Instagram",
    handle: "@afropuppyyoga",
    url: "https://www.instagram.com/afropuppyyoga",
    icon: Instagram,
    color: "bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888]",
    followers: "Follow for daily puppy content",
  },
  {
    name: "Facebook",
    handle: "AfroPuppyYoga",
    url: "https://www.facebook.com/afropuppyyoga",
    icon: Facebook,
    color: "bg-[#1877F2]",
    followers: "Join our community",
  },
  {
    name: "TikTok",
    handle: "@afropuppyyoga",
    url: "https://www.tiktok.com/@afropuppyyoga",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.28 8.28 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z"/>
      </svg>
    ),
    color: "bg-[#010101]",
    followers: "Watch our class videos",
  },
  {
    name: "YouTube",
    handle: "AfroPuppyYoga",
    url: "https://www.youtube.com/@afropuppyyoga",
    icon: Youtube,
    color: "bg-[#FF0000]",
    followers: "Watch our sessions",
  },
];

const contactInfo = [
  {
    label: "Email",
    value: "afropuppyyogaofficial@gmail.com",
    href: "mailto:afropuppyyogaofficial@gmail.com",
    icon: Mail,
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

export default function Contact() {
  return (
    <section id="contact" className="py-24 md:py-32 bg-[#2D5A27]">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: Contact info + CTA */}
          <div>
            <FadeUp>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#F4A800]" />
                <span className="text-[#F4A800] font-body text-xs font-semibold tracking-widest uppercase">
                  Get In Touch
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Join
                <br />
                <span className="italic text-[#F4A800]">The Pack?</span>
              </h2>
              <p className="font-body text-white/70 text-lg leading-relaxed mb-10">
                Whether you're booking a class, planning a private event, or just want to say hello — we'd love to hear from you. Our team responds within 24 hours.
              </p>
            </FadeUp>

            {/* Contact items */}
            <FadeUp delay={0.15}>
              <div className="space-y-4 mb-10">
                {contactInfo.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-[#F4A800]/20 transition-colors">
                      <item.icon size={20} className="text-[#F4A800]" />
                    </div>
                    <div>
                      <div className="font-body text-xs text-white/50 uppercase tracking-wide mb-0.5">{item.label}</div>
                      <div className="font-body text-white font-medium group-hover:text-[#F4A800] transition-colors">
                        {item.value}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </FadeUp>

            {/* Book CTA */}
            <FadeUp delay={0.25}>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#F4A800] text-[#1E1208] font-body font-bold text-base rounded-full hover:bg-[#e09800] transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Book on Eventbrite
                <ExternalLink size={16} />
              </a>
            </FadeUp>
          </div>

          {/* Right: Social links */}
          <div>
            <FadeUp delay={0.1}>
              <h3 className="font-display font-bold text-xl text-white mb-6">
                Follow Our Journey
              </h3>
            </FadeUp>
            <div className="grid grid-cols-2 gap-4">
              {socials.map((social, i) => (
                <motion.a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
                  className="group bg-white/10 hover:bg-white/15 rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`w-10 h-10 rounded-xl ${social.color} flex items-center justify-center mb-4`}>
                    <social.icon size={20} className="text-white" />
                  </div>
                  <div className="font-display font-bold text-white text-base mb-0.5">{social.name}</div>
                  <div className="font-body text-white/50 text-sm">{social.handle}</div>
                  <div className="font-body text-white/40 text-xs mt-2">{social.followers}</div>
                </motion.a>
              ))}
            </div>

            {/* Locations */}
            <FadeUp delay={0.4}>
              <div className="mt-8 bg-white/10 rounded-2xl p-6 border border-white/10">
                <h4 className="font-display font-bold text-white text-base mb-3">Our Locations</h4>
                <div className="grid grid-cols-3 gap-2">
                  {["Mississauga", "Hamilton", "Kitchener", "Toronto", "Guelph", "Waterloo"].map((city) => (
                    <div
                      key={city}
                      className="text-center py-2 px-3 bg-white/5 rounded-lg border border-white/10"
                    >
                      <span className="font-body text-white/70 text-xs font-medium">{city}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
