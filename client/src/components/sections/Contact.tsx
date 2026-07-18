/* ============================================================
   Contact Section — Contact form + social links + locations
   Layout: Two-column — left: form + contact info, right: social + locations
   ============================================================ */
import { BOOK_URL } from "@/const";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Mail, Instagram, Facebook, Youtube, ExternalLink, MapPin, Phone, Send, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const socials = [
  {
    name: "Instagram",
    handle: "@afropuppyyoga",
    url: "https://www.instagram.com/afropuppyyoga",
    icon: Instagram,
    color: "bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#8B2252]",
    followers: "12.2K followers",
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

const locations = [
  {
    city: "Kitchener",
    venue: "TenC Dance Studio",
    address: "329 King Street East, Kitchener, ON",
    mapsUrl: "https://maps.google.com/?q=TenC+Dance+Studio+329+King+Street+East+Kitchener+Ontario",
    active: true,
  },
  {
    city: "Hamilton",
    venue: "Colibri Studio",
    address: "2751 Barton Street East, Hamilton, ON",
    mapsUrl: "https://maps.google.com/?q=Colibri+Studio+2751+Barton+Street+East+Hamilton+Ontario",
    active: true,
  },
  {
    city: "Oakville",
    venue: "1670 North Service Rd E",
    address: "Oakville, ON",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=1670%20North%20Service%20Rd%20E&query_place_id=ChIJofNPAT9DK4gRAhVcvaHDk7Y",
    active: true,
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
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const notifyOwner = trpc.system.notifyOwner.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setForm({ name: "", email: "", message: "" });
    },
    onError: () => {
      setError("Something went wrong. Please email us directly at afropuppyyogaofficial@gmail.com");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    notifyOwner.mutate({
      title: `New Contact Form Message from ${form.name}`,
      content: `**Name:** ${form.name}\n**Email:** ${form.email}\n\n**Message:**\n${form.message}`,
    });
  };

  return (
    <section id="contact" className="py-10 md:py-14 bg-[#8B2252]">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Left: Contact form + info */}
          <div>
            <FadeUp>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-0.5 bg-[#F2A0B8]" />
                <span className="text-[#F2A0B8] font-body text-xs font-semibold tracking-widest uppercase">
                  Get In Touch
                </span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Join
                <br />
                <span className="italic text-[#F2A0B8]">The Pack?</span>
              </h2>
              <p className="font-body text-white/70 text-base leading-relaxed mb-6">
                Whether you're booking a class, planning a private event, or just want to say hello — we'd love to hear from you. Our team responds within 48 hours.
              </p>
            </FadeUp>

            {/* Contact form */}
            <FadeUp delay={0.1}>
              {submitted ? (
                <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-5 border border-white/20 mb-6">
                  <CheckCircle size={22} className="text-[#F2A0B8] flex-shrink-0" />
                  <div>
                    <div className="font-body font-semibold text-white text-sm">Message sent!</div>
                    <div className="font-body text-white/60 text-xs mt-0.5">We'll get back to you within 48 hours.</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Your name"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        maxLength={100}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 font-body text-sm focus:outline-none focus:border-[#F2A0B8]/60 transition-colors"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        maxLength={200}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 font-body text-sm focus:outline-none focus:border-[#F2A0B8]/60 transition-colors"
                      />
                    </div>
                  </div>
                  <textarea
                    placeholder="Your message..."
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    maxLength={1000}
                    rows={4}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 font-body text-sm focus:outline-none focus:border-[#F2A0B8]/60 transition-colors resize-none"
                  />
                  {error && <p className="font-body text-[#F2A0B8] text-xs">{error}</p>}
                  <button
                    type="submit"
                    disabled={notifyOwner.isPending}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-sm rounded-full hover:bg-[#f0b0c4] transition-all duration-200 shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {notifyOwner.isPending ? "Sending..." : <>Send Message <Send size={14} /></>}
                  </button>
                </form>
              )}
            </FadeUp>

            {/* Contact items */}
            <FadeUp delay={0.2}>
              <div className="flex flex-wrap gap-4 mb-6">
                <a href="mailto:afropuppyyogaofficial@gmail.com" className="flex items-center gap-2 group">
                  <Mail size={15} className="text-[#F2A0B8]" />
                  <span className="font-body text-white/70 text-sm group-hover:text-[#F2A0B8] transition-colors">afropuppyyogaofficial@gmail.com</span>
                </a>
                <a href="tel:+12897881885" className="flex items-center gap-2 group">
                  <Phone size={15} className="text-[#F2A0B8]" />
                  <span className="font-body text-white/70 text-sm group-hover:text-[#F2A0B8] transition-colors">(289) 788-1885</span>
                </a>
              </div>
            </FadeUp>

            {/* Book CTA */}
            <FadeUp delay={0.25}>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-base rounded-full hover:bg-[#f0b0c4] transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Book on Luma
                <ExternalLink size={16} />
              </a>
            </FadeUp>
          </div>

          {/* Right: Social links + locations */}
          <div>
            <FadeUp delay={0.1}>
              <h3 className="font-display font-bold text-xl text-white mb-4">
                Follow Our Journey
              </h3>
            </FadeUp>
            <div className="grid grid-cols-2 gap-3 mb-6">
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
                  className="group bg-white/10 hover:bg-white/15 rounded-2xl p-3 sm:p-4 border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${social.color} flex items-center justify-center mb-2`}>
                    <social.icon size={18} className="text-white" />
                  </div>
                  <div className="font-display font-bold text-white text-sm mb-0.5">{social.name}</div>
                  <div className="font-body text-white/50 text-xs">{social.handle}</div>
                  <div className="font-body text-white/40 text-xs mt-0.5 hidden sm:block">{social.followers}</div>
                </motion.a>
              ))}
            </div>

            {/* Locations */}
            <FadeUp delay={0.4}>
              <div className="bg-white/10 rounded-2xl p-5 border border-white/10">
                <h4 className="font-display font-bold text-white text-base mb-3">Our Locations</h4>
                <div className="space-y-3">
                  {locations.map((loc, i) => (
                    <div key={loc.city}>
                      {i > 0 && <div className="border-t border-white/10 mb-3" />}
                      <a
                        href={loc.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#F2A0B8]/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-[#F2A0B8]/30 transition-colors">
                          <MapPin size={15} className="text-[#F2A0B8]" />
                        </div>
                        <div>
                          <div className="font-body text-white font-semibold text-sm group-hover:text-[#F2A0B8] transition-colors">{loc.city}</div>
                          <div className="font-body text-white/60 text-xs leading-relaxed">{loc.venue}<br />{loc.address}</div>
                        </div>
                      </a>
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
