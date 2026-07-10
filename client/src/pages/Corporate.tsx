import { useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { Button } from "@/components/ui/button";

const audiences = [
  { icon: "🏢", label: "HR Teams" },
  { icon: "🎓", label: "Universities & Colleges" },
  { icon: "⚖️", label: "Law Firms" },
  { icon: "💻", label: "Tech Companies" },
  { icon: "🏡", label: "Real Estate Teams" },
  { icon: "🌿", label: "Wellness Committees" },
  { icon: "👩‍🎓", label: "Student Groups" },
  { icon: "📣", label: "Brand Activations" },
];

const whyItWorks = [
  {
    icon: "🧘",
    title: "Low-Pressure Movement",
    desc: "Beginner-friendly yoga that everyone can do — no experience, no judgment. Perfect for mixed-ability groups.",
  },
  {
    icon: "😌",
    title: "Genuine Stress Relief",
    desc: "Puppies and movement together create a proven stress-reduction experience. Your team will feel it immediately.",
  },
  {
    icon: "🤝",
    title: "Social Connection",
    desc: "Shared laughter, shared puppies, shared experience. The kind of bonding that doesn't happen at a conference table.",
  },
  {
    icon: "🎵",
    title: "Culturally Fresh",
    desc: "Afrobeats soundtrack, warm inclusive energy, and a vibe that feels premium without being stiff.",
  },
  {
    icon: "📸",
    title: "Memorable Content",
    desc: "Your team will be talking about it — and posting about it. Great for internal culture and external brand.",
  },
  {
    icon: "🐾",
    title: "Ethically Sourced Puppies",
    desc: "All puppies are sourced from vetted breeders. Safe, supervised, and insured. Your team is in good hands.",
  },
];

const packages = [
  {
    name: "In-Studio Private Event",
    icon: "🏛️",
    bestFor: "Teams of 6–25",
    desc: "We host your group at one of our partner studios in Kitchener, Hamilton, or Oakville. Fully private, fully branded to APY. Includes instructor, puppies, mats, and props.",
    price: "Starting at $1,200",
    cta: "Get a Quote",
  },
  {
    name: "On-Site Corporate Event",
    icon: "🏢",
    bestFor: "Teams of 15–50+",
    desc: "We bring the experience to your office, venue, or event space. Ideal for employee appreciation days, wellness weeks, and large-group activations.",
    price: "Starting at $2,000",
    cta: "Get a Quote",
    badge: "Most Requested",
  },
  {
    name: "Premium Brand Collaboration",
    icon: "✨",
    bestFor: "Brand activations & partnerships",
    desc: "Co-branded puppy yoga events for product launches, influencer campaigns, and wellness brand partnerships. Custom packages available.",
    price: "Custom pricing",
    cta: "Contact Us",
  },
];

const faqs = [
  {
    q: "How many people can attend a corporate event?",
    a: "We accommodate groups from 6 to 50+ guests. For very large groups (50+), we can arrange multiple sessions or a larger venue. Contact us to discuss your group size.",
  },
  {
    q: "Where can you host corporate events?",
    a: "We operate across Ontario including Kitchener, Hamilton, Oakville, Toronto, Guelph, Waterloo, and surrounding areas. We can come to your office or arrange space at one of our partner studios.",
  },
  {
    q: "Are the puppies safe for a corporate setting?",
    a: "Yes. All puppies are sourced from vetted, ethical breeders, fully vaccinated, and supervised by trained handlers throughout the event. We carry liability insurance and all participants sign a standard waiver.",
  },
  {
    q: "Do employees need yoga experience?",
    a: "Not at all. Our sessions are designed to be 100% beginner-friendly. The instructor guides every pose and keeps the energy light and fun.",
  },
  {
    q: "What is included in the price?",
    a: "Every corporate package includes a certified yoga instructor and event host, ethically sourced puppies and handlers, all mats and props, setup and cleanup, a custom Afrobeats playlist, and a branded APY experience. Add-ons like photography, refreshments, and branded merchandise are available.",
  },
  {
    q: "How far in advance do I need to book?",
    a: "We recommend booking at least 2–3 weeks in advance to secure your preferred date and puppy availability. For large groups or special dates, 4–6 weeks is ideal.",
  },
  {
    q: "Do you provide waivers and insurance documentation?",
    a: "Yes. We provide standard liability waivers for all participants and can supply proof of insurance documentation for your HR or facilities team upon request.",
  },
];

export default function Corporate() {
  useSeoMeta({
    title: "Corporate Puppy Yoga Ontario | Team Wellness & Employee Appreciation | AfroPuppyYoga",
    description:
      "Book a corporate puppy yoga event in Ontario with AfroPuppyYoga. Perfect for employee appreciation, team building, wellness days, and brand activations. Available across Ontario. Get a custom quote.",
    canonical: "https://afropuppyyoga.ca/corporate-puppy-yoga",
  });

  useEffect(() => {
    document.title = "Corporate Puppy Yoga Ontario | AfroPuppyYoga";
  }, []);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* Hero */}
      <section
        className="relative pt-28 pb-24 px-6 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a0a0f 0%, #3d1030 50%, #8B2252 100%)",
        }}
      >
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block text-xs font-bold tracking-widest uppercase mb-5 px-4 py-1.5 rounded-full bg-white/10 text-white/80">
              Corporate Wellness
            </span>
            <h1
              className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Corporate Puppy Yoga for Team Wellness, Employee Appreciation & Stress Relief
            </h1>
            <p className="text-white/70 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
              Ontario's #1 puppy yoga studio brings the puppies, the yoga, and the Afrobeats to your team. Available across Ontario for groups of 6 to 50+.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/private-events/quote">
                <Button
                  size="lg"
                  className="px-10 py-6 text-base font-bold rounded-full text-white"
                  style={{ background: "#e91e8c", border: "none" }}
                >
                  Get a Corporate Quote
                </Button>
              </Link>
              <a href="mailto:afropuppyyogaofficial@gmail.com?subject=Corporate%20Puppy%20Yoga%20Inquiry">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-10 py-6 text-base font-bold rounded-full border-white text-white hover:bg-white hover:text-[#8B2252]"
                >
                  Email Us Directly
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 px-6 bg-[#FEFAF4]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-black mb-3"
              style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
            >
              Who It's For
            </h2>
            <p className="text-lg" style={{ color: "#7c3f5e" }}>
              We work with organizations of all sizes across Ontario.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {audiences.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl text-center"
                style={{ background: "#fff5fa", border: "1.5px solid #f9a8d4" }}
              >
                <span className="text-3xl">{a.icon}</span>
                <span className="font-semibold text-sm" style={{ color: "#1a0a0f" }}>
                  {a.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why It Works */}
      <section className="py-20 px-6" style={{ background: "#fff5f8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-black mb-3"
              style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
            >
              Why It Works
            </h2>
            <p className="text-lg" style={{ color: "#7c3f5e" }}>
              Puppy yoga isn't just fun — it's effective team wellness.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyItWorks.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white rounded-2xl p-6 shadow-sm"
                style={{ border: "1.5px solid #f9a8d4" }}
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3
                  className="font-bold text-lg mb-2"
                  style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#7c3f5e" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="py-20 px-6 bg-[#FEFAF4]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-black mb-3"
              style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
            >
              Corporate Packages
            </h2>
            <p className="text-lg" style={{ color: "#7c3f5e" }}>
              Choose the format that fits your team.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative rounded-3xl p-7 flex flex-col"
                style={{
                  background: "#fff5fa",
                  border: `2px solid ${pkg.badge ? "#e91e8c" : "#f9a8d4"}`,
                  boxShadow: pkg.badge ? "0 8px 32px rgba(233,30,140,0.15)" : "0 4px 16px rgba(0,0,0,0.06)",
                }}
              >
                {pkg.badge && (
                  <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold tracking-widest uppercase px-5 py-1.5 rounded-full"
                    style={{ background: "#e91e8c" }}
                  >
                    {pkg.badge}
                  </div>
                )}
                <div className="text-3xl mb-3">{pkg.icon}</div>
                <span
                  className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3"
                  style={{ background: "#fce7f3", color: "#be185d" }}
                >
                  {pkg.bestFor}
                </span>
                <h3
                  className="text-xl font-black mb-3"
                  style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
                >
                  {pkg.name}
                </h3>
                <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: "#7c3f5e" }}>
                  {pkg.desc}
                </p>
                <p className="font-bold text-lg mb-5" style={{ color: "#8B2252" }}>
                  {pkg.price}
                </p>
                <Link href="/private-events/quote">
                  <Button
                    className="w-full py-5 font-bold rounded-2xl text-white"
                    style={{ background: "linear-gradient(135deg, #e91e8c, #8B2252)", border: "none" }}
                  >
                    {pkg.cta} →
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust — Partner & Client Logos */}
      <section className="py-16 px-6 bg-white border-t border-b border-[#f9a8d4]/40">
        <div className="max-w-5xl mx-auto">
          <p className="text-center font-body text-xs font-bold tracking-[0.2em] uppercase text-black/40 mb-6">
            Trusted By
          </p>
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
            <div className="flex items-center animate-[marquee_28s_linear_infinite] gap-0 min-w-max">
              {[
                { name: "Wilfrid Laurier University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/laurier_logo_61911be5.webp", height: 30 },
                { name: "University of Waterloo", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/waterloo_fixed_a91debfb.png", height: 36 },
                { name: "McMaster University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mcmaster_dedf4891.png", height: 38 },
                { name: "University of Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/guelph_fixed_39bf0fba.png", height: 36 },
                { name: "Brock University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/brock_university_a69cc38d.png", height: 52 },
                { name: "Manulife", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/manulife_logo_cropped_ecd0a51b.png", height: 40 },
                { name: "Brock Solutions", src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/dwXWkrdWFpxsxxJF.png", height: 72 },
                { name: "F45 Training", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/f45_fixed_f11e0ba3.png", height: 34 },
                { name: "Girl Guides of Canada", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/girl-guides-canada-logo_307ab2f6.png", height: 80 },
                { name: "Artemis Canada", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/artemis_canada_logo_b5401a15.jpg", height: 36 },
                { name: "Kitchener Lady Rangers", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/lady_rangers_logo_787e1b41.jpg", height: 56 },
                { name: "MMSA Lang Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mmsa_lang_logo_46c62a49.webp", height: 56 },
              ].flatMap((org) => [org, { ...org, key: org.name + "-2" }]).map((org, i) => (
                <div key={`${org.name}-${i}`} className="flex items-center px-8 border-r border-black/10 last:border-r-0 shrink-0">
                  <img src={org.src} alt={org.name} style={{ height: org.height }} className="w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6" style={{ background: "#fff5f8" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-black mb-3"
              style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
            >
              Corporate FAQ
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-white rounded-xl px-7 py-6 shadow-sm"
                style={{ border: "1.5px solid #f9a8d4" }}
              >
                <h3 className="font-semibold text-base mb-2" style={{ color: "#1a0a0f" }}>
                  {faq.q}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#7c3f5e" }}>
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        className="py-20 px-6 text-center"
        style={{ background: "linear-gradient(135deg, #1a0a0f 0%, #8B2252 100%)" }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-4xl mb-4">🐾</div>
          <h2
            className="text-3xl md:text-4xl font-black text-white mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Ready to book a team wellness day your team will actually remember?
          </h2>
          <p className="text-white/70 text-base mb-8">
            Fill out our quote form and we'll follow up within 24–48 hours with availability, pricing, and next steps.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/private-events/quote">
              <Button
                size="lg"
                className="px-10 py-6 text-base font-bold rounded-full text-white"
                style={{ background: "#e91e8c", border: "none" }}
              >
                Get a Corporate Quote
              </Button>
            </Link>
            <a href="mailto:afropuppyyogaofficial@gmail.com?subject=Corporate%20Puppy%20Yoga%20Inquiry">
              <Button
                size="lg"
                variant="outline"
                className="px-10 py-6 text-base font-bold rounded-full border-white text-white hover:bg-white hover:text-[#8B2252]"
              >
                Email Us Directly
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
