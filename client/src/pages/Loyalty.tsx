import { BOOK_URL } from "@/const";
/* ============================================================
   Loyalty Program Page — /loyalty
   Colors: Warm light palette matching APY brand
   ============================================================ */
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useEffect } from "react";

const steps = [
  {
    number: "01",
    emoji: "🐾",
    title: "Attend Your First Class",
    description:
      "Book any APY class through Luma using your email address. Every confirmed booking counts toward your loyalty progress.",
  },
  {
    number: "02",
    emoji: "🐾",
    title: "Get a Progress Update",
    description:
      "After each class, you'll receive an email letting you know exactly where you stand. No app, no account — just your inbox.",
  },
  {
    number: "03",
    emoji: "🎉",
    title: "Earn a Free Class",
    description:
      "After your third class, a free ticket code lands in your inbox automatically. Valid for 60 days, redeemable on any standard class.",
  },
  {
    number: "04",
    emoji: "🔄",
    title: "The Cycle Resets",
    description:
      "After you redeem your free class, the counter resets. Class 4 becomes your new Class 1. The reward never stops.",
  },
];

const faqs = [
  {
    q: "Do I need to sign up for the loyalty program?",
    a: "No sign-up required. Any customer who books through Luma using the same email address is automatically enrolled. Your attendance is tracked from your very first class.",
  },
  {
    q: "What counts as a qualifying class?",
    a: "Any standard APY class booked and attended through Luma qualifies. Private events and gifted tickets may not count toward your loyalty total.",
  },
  {
    q: "What is the free ticket worth?",
    a: "Your free ticket is equivalent to a standard Early Bird or Regular tier ticket — the same class, the same experience, on us.",
  },
  {
    q: "How long do I have to use my free ticket?",
    a: "Your free ticket code is valid for 60 days from the date it is issued. Make sure to book before it expires.",
  },
  {
    q: "Can I stack rewards?",
    a: "Yes — the cycle repeats indefinitely. Every 3 classes earns you 1 free class, forever.",
  },
  {
    q: "What if I book with different email addresses?",
    a: "Your attendance is tracked by email address. Always use the same email when booking to ensure your classes are counted correctly.",
  },
];

export default function Loyalty() {
  useEffect(() => {
    document.title = "The Pack — APY Loyalty Program | AfroPuppyYoga";
  }, []);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#FFF5F8] pt-28 pb-20 px-6 border-b border-[#F2A0B8]/20">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                The Pack
              </span>
              <div className="w-8 h-0.5 bg-[#8B2252]" />
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold text-[#1A0A12] mb-6 leading-tight">
              APY Loyalty Program
            </h1>
            <p className="font-body text-[#1A0A12]/65 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
              Attend 3 classes. Get 1 free. Automatically. No apps, no punch cards, no forms — just show up and we take care of the rest.
            </p>
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-10 py-4 bg-[#8B2252] text-white font-body font-semibold text-base rounded-full hover:bg-[#6B1A3F] transition-all duration-200 shadow-md"
            >
              Book a Class to Start
            </a>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-[#FEFAF4]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1A0A12] mb-3">
              How It Works
            </h2>
            <p className="font-body text-[#1A0A12]/60 text-lg">
              Four simple steps. Zero effort on your part.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white border border-[#F2A0B8]/30 rounded-2xl p-8 flex gap-5 shadow-sm"
              >
                <div className="shrink-0 w-12 h-12 rounded-full bg-[#F2A0B8]/30 flex items-center justify-center text-xl">
                  {step.emoji}
                </div>
                <div>
                  <div className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase mb-1">
                    {step.number}
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#1A0A12] mb-2">
                    {step.title}
                  </h3>
                  <p className="font-body text-[#1A0A12]/65 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="py-12 px-6 bg-[#8B2252]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "3", label: "Classes to earn" },
              { value: "1", label: "Free ticket" },
              { value: "60", label: "Days to redeem" },
              { value: "∞", label: "Repeats forever" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="font-display text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="font-body text-white/60 text-sm uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-[#FFF5F8]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1A0A12] mb-3">
              Questions
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="bg-white border border-[#F2A0B8]/30 rounded-xl px-7 py-6 shadow-sm"
              >
                <h3 className="font-body font-semibold text-[#1A0A12] text-base mb-2">
                  {faq.q}
                </h3>
                <p className="font-body text-[#1A0A12]/65 text-sm leading-relaxed">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-6 bg-[#FFF5F8] border-t border-[#F2A0B8]/20 text-center">
        <div className="max-w-xl mx-auto">
          <div className="text-4xl mb-4">🐾</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1A0A12] mb-4">
            Your next free class is 3 sessions away.
          </h2>
          <p className="font-body text-[#1A0A12]/60 text-base mb-8">
            Book your first class today. We'll handle the rest.
          </p>
          <a
            href={BOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-10 py-4 bg-[#8B2252] text-white font-body font-semibold text-base rounded-full hover:bg-[#6B1A3F] transition-all duration-200 shadow-md"
          >
            Book a Class
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
