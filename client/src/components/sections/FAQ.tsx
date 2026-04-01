/* ============================================================
   FAQ Section — Accordion-style Q&A
   Layout: Two-column on desktop, single on mobile
   ============================================================ */
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "What should I wear?",
    a: "Comfortable workout or yoga attire is ideal. We recommend clothes you don't mind getting a little furry — puppies love to cuddle! Avoid wearing anything too precious.",
  },
  {
    q: "Do I need yoga experience?",
    a: "Absolutely not! Our classes are designed for all levels, from complete beginners to experienced yogis. Our certified instructors guide every pose with modifications available.",
  },
  {
    q: "Are the puppies safe?",
    a: "Yes! All our puppies are sourced from reputable local breeders, fully vaccinated, and well-socialized. They are supervised by their handlers throughout the class to ensure their wellbeing and yours.",
  },
  {
    q: "What is included in the ticket price?",
    a: "Your ticket includes a 60-minute session (40 min guided yoga + 20 min puppy playtime), complimentary refreshments, use of yoga mats and props, and a memorable experience you'll talk about for years.",
  },
  {
    q: "Can I bring my own yoga mat?",
    a: "Yes, you're welcome to bring your own mat. We also provide clean, sanitized mats for all participants at no extra charge.",
  },
  {
    q: "Are there age restrictions?",
    a: "Participants must be 12 years or older. Those under 18 must be accompanied by a parent or guardian. We welcome all ages and experience levels.",
  },
  {
    q: "How do I book a private event?",
    a: "Email us at afropuppyyogaofficial@gmail.com with your event details — date, number of guests, location preference, and any special requests. We'll get back to you within 48 hours to confirm availability and discuss customization options.",
  },
  {
    q: "What if I'm allergic to dogs?",
    a: "We recommend consulting your doctor before attending if you have dog allergies. We cannot guarantee an allergen-free environment as puppies are present throughout the session.",
  },
  {
    q: "Can I purchase gift cards?",
    a: "Yes! Gift cards are available for purchase on our Luma page. They make a perfect gift for birthdays, holidays, or anyone who deserves a little joy.",
  },
  {
    q: "Where are your classes held?",
    a: "We host classes across the Greater Toronto Area including Mississauga, Hamilton, and Kitchener. Specific venue details are provided upon booking confirmation.",
  },
];

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.45 }}
      className="border-b border-[#F0D0DC] last:border-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left group"
      >
        <span className="font-display font-bold text-base md:text-lg text-[#1A0A12] group-hover:text-[#8B2252] transition-colors leading-snug">
          {q}
        </span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${open ? "bg-[#8B2252] text-white" : "bg-[#F0D0DC] text-[#1A0A12]"}`}>
          {open ? <Minus size={14} /> : <Plus size={14} />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="font-body text-[#1A0A12]/70 text-base leading-relaxed pb-5 pr-10">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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

export default function FAQ() {
  const half = Math.ceil(faqs.length / 2);
  const leftFaqs = faqs.slice(0, half);
  const rightFaqs = faqs.slice(half);

  return (
    <section id="faq" className="py-24 md:py-32 bg-[#FFF5F8]">
      <div className="container">
        {/* Header */}
        <FadeUp>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-[#8B2252]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                FAQ
              </span>
              <div className="w-8 h-0.5 bg-[#8B2252]" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#1A0A12] mb-4">
              Questions? We've Got{" "}
              <span className="italic text-[#8B2252]">Answers</span>
            </h2>
            <p className="font-body text-[#1A0A12]/60 text-lg max-w-xl mx-auto">
              Everything you need to know before your first puppy yoga session.
            </p>
          </div>
        </FadeUp>

        {/* Two-column FAQ */}
        <div className="grid md:grid-cols-2 gap-x-12 lg:gap-x-20">
          <div>
            {leftFaqs.map((faq, i) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
          <div>
            {rightFaqs.map((faq, i) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} index={i + half} />
            ))}
          </div>
        </div>

        {/* Still have questions CTA */}
        <FadeUp delay={0.3}>
          <div className="mt-16 text-center bg-[#FFF0F4] rounded-2xl p-8 md:p-12">
            <h3 className="font-display font-bold text-2xl text-[#1A0A12] mb-3">
              Still have questions?
            </h3>
            <p className="font-body text-[#1A0A12]/60 mb-6">
              We're happy to help! Reach out and we'll get back to you within 24 hours.
            </p>
            <a
              href="mailto:afropuppyyogaofficial@gmail.com"
              className="inline-flex items-center px-8 py-3.5 bg-[#8B2252] text-white font-body font-semibold rounded-full hover:bg-[#6B1A3F] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              Contact Us
            </a>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
