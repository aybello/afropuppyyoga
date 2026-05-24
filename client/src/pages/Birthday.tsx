import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { Cake, Users, Music, Camera, Sparkles, MapPin, CheckCircle2, Star } from "lucide-react";

const TIERS = [
  {
    id: "Basic" as const,
    name: "Basic",
    price: "$600",
    tagline: "The Perfect Celebration",
    color: "#F2A0B8",
    bgColor: "#FFF5F8",
    borderColor: "#F2A0B8",
    minGuests: 6,
    maxGuests: 8,
    format: "Reserved section in a public class",
    includes: [
      "Reserved section for your group (up to 8 people)",
      "Birthday banner & personalized sign",
      "Dedicated puppy cuddle moment for the birthday person",
      "Priority seating for your group",
      "Complimentary birthday card from the APY team",
    ],
    badge: null,
  },
  {
    id: "Premium" as const,
    name: "Premium",
    price: "$900",
    tagline: "The Full Experience",
    color: "#8B2252",
    bgColor: "#FDF0F7",
    borderColor: "#8B2252",
    minGuests: 8,
    maxGuests: 10,
    format: "Reserved section in a public class",
    includes: [
      "Reserved section for your group (up to 10 people)",
      "Birthday banner & personalized sign",
      "Dedicated puppy cuddle moment for the birthday person",
      "Custom playlist curated for your session",
      "1 complimentary ticket for the birthday person",
      "Priority seating for your group",
      "Complimentary birthday card from the APY team",
    ],
    badge: "Most Popular",
  },
  {
    id: "Deluxe" as const,
    name: "Deluxe",
    price: "$1,200",
    tagline: "The Private Celebration",
    color: "#C4556A",
    bgColor: "#FFF5F8",
    borderColor: "#C4556A",
    minGuests: 10,
    maxGuests: 20,
    format: "Private session — the whole class is yours",
    includes: [
      "Full private session for your group (up to 20 people)",
      "Birthday banner & personalized sign",
      "Dedicated puppy cuddle moment for the birthday person",
      "Custom playlist curated for your session",
      "1 complimentary ticket for the birthday person",
      "Professional photo package (digital delivery)",
      "Celebratory sparkling drinks for the group",
      "Priority seating & exclusive access",
    ],
    badge: "Best Value",
  },
];

export default function Birthday() {
  const [selectedTier, setSelectedTier] = useState<"Basic" | "Premium" | "Deluxe" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    preferredDate: "",
    location: "" as "KW" | "Hamilton" | "",
    groupSize: "",
    message: "",
  });

  const submitInquiry = trpc.birthday.submitInquiry.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) {
      toast.error("Please select a package tier.");
      return;
    }
    if (!form.location) {
      toast.error("Please select a location.");
      return;
    }
    const groupSize = parseInt(form.groupSize);
    if (isNaN(groupSize) || groupSize < 6) {
      toast.error("Group size must be at least 6 people.");
      return;
    }
    submitInquiry.mutate({
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      preferredDate: form.preferredDate,
      location: form.location as "KW" | "Hamilton",
      tier: selectedTier,
      groupSize,
      message: form.message || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FEFAF4]">
        <Navbar />
        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <div className="text-center max-w-lg">
            <div className="w-20 h-20 rounded-full bg-[#F2A0B8]/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-[#8B2252]" />
            </div>
            <h1 className="font-display text-4xl font-bold text-[#1A0A12] mb-4">
              Inquiry Received! 🎂
            </h1>
            <p className="font-body text-[#5C3347] text-lg leading-relaxed mb-8">
              Thank you for choosing AfroPuppyYoga for your celebration! We'll review your request and get back to you within 24 hours to confirm availability and next steps.
            </p>
            <a
              href="/"
              className="inline-flex items-center px-8 py-3 bg-[#8B2252] text-white font-body font-semibold rounded-full hover:bg-[#6B1A3F] transition-colors"
            >
              Back to Home
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 text-center bg-gradient-to-b from-[#FFF5F8] to-[#FEFAF4]">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F2A0B8]/20 rounded-full mb-6">
            <Cake size={14} className="text-[#8B2252]" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252]">
              Birthday Packages
            </span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-[#1A0A12] mb-6 leading-tight">
            Celebrate Your Birthday
            <br />
            <span className="italic text-[#8B2252]">With Puppies</span>
          </h1>
          <p className="font-body text-[#5C3347] text-lg leading-relaxed max-w-2xl mx-auto">
            Make your birthday unforgettable. Bring your crew, cuddle some puppies, and create memories that last a lifetime. Choose the package that's right for your group.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl font-bold text-[#1A0A12] text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", icon: Cake, title: "Choose Your Package", desc: "Select the tier that fits your group size and vision." },
              { step: "2", icon: Users, title: "Submit Your Inquiry", desc: "Fill out the form below. We'll confirm availability within 24 hours." },
              { step: "3", icon: Sparkles, title: "Show Up & Celebrate", desc: "Arrive, cuddle puppies, and enjoy your special day!" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#F2A0B8]/20 flex items-center justify-center mx-auto mb-3">
                  <item.icon size={20} className="text-[#8B2252]" />
                </div>
                <div className="font-body text-xs font-bold tracking-widest text-[#F2A0B8] uppercase mb-1">Step {item.step}</div>
                <h3 className="font-display font-bold text-[#1A0A12] mb-2">{item.title}</h3>
                <p className="font-body text-[#5C3347] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tier Cards */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1A0A12] text-center mb-4">
            Choose Your Package
          </h2>
          <p className="font-body text-[#5C3347] text-center mb-10">
            All packages include a reserved spot for your group. Guests purchase their own tickets through Luma.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`relative rounded-2xl p-7 cursor-pointer transition-all duration-200 border-2 ${
                  selectedTier === tier.id
                    ? "border-[#8B2252] shadow-xl -translate-y-1"
                    : "border-transparent shadow-md hover:shadow-lg hover:-translate-y-0.5"
                }`}
                style={{ backgroundColor: tier.bgColor }}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-[#8B2252] text-white font-body text-xs font-bold rounded-full shadow">
                      {tier.badge}
                    </span>
                  </div>
                )}
                {selectedTier === tier.id && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 size={20} className="text-[#8B2252]" />
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-display text-2xl font-bold text-[#1A0A12]">{tier.name}</h3>
                  <p className="font-body text-sm text-[#5C3347]">{tier.tagline}</p>
                </div>
                <div className="mb-4">
                  <span className="font-display text-4xl font-bold" style={{ color: tier.color }}>{tier.price}</span>
                  <span className="font-body text-sm text-[#5C3347] ml-1">package fee</span>
                </div>
                <div className="mb-4 px-3 py-2 bg-white/60 rounded-lg">
                  <p className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-wide mb-0.5">Format</p>
                  <p className="font-body text-sm text-[#1A0A12]">{tier.format}</p>
                  <p className="font-body text-xs text-[#5C3347] mt-0.5">Group: {tier.minGuests}–{tier.maxGuests} people</p>
                </div>
                <ul className="space-y-2">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: tier.color }} />
                      <span className="font-body text-sm text-[#1A0A12] leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {selectedTier && (
            <p className="text-center font-body text-sm text-[#8B2252] font-semibold mt-6">
              ✓ {selectedTier} package selected — fill out the form below to book
            </p>
          )}
        </div>
      </section>

      {/* Booking Form */}
      <section className="py-16 px-4 bg-[#8B2252]" id="book">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F2A0B8]/20 rounded-full mb-4">
              <Star size={14} className="text-[#F2A0B8]" />
              <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#F2A0B8]">
                Book Your Celebration
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              Ready to Celebrate?
            </h2>
            <p className="font-body text-white/60 text-base">
              Fill out the form below and we'll get back to you within 24 hours to confirm your booking.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Selected tier display */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="font-body text-sm text-white/60 mb-1">Selected Package</p>
              {selectedTier ? (
                <p className="font-display font-bold text-[#F2A0B8] text-lg">
                  {selectedTier} — {TIERS.find(t => t.id === selectedTier)?.price}
                </p>
              ) : (
                <p className="font-body text-white/40 text-sm italic">No package selected — scroll up to choose one</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-semibold text-white/80 mb-1.5">Your Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:border-[#F2A0B8] transition-colors"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-semibold text-white/80 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@email.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:border-[#F2A0B8] transition-colors"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-semibold text-white/80 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (519) 000-0000"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:border-[#F2A0B8] transition-colors"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-semibold text-white/80 mb-1.5">Preferred Date *</label>
                <input
                  type="date"
                  required
                  value={form.preferredDate}
                  onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:border-[#F2A0B8] transition-colors"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-semibold text-white/80 mb-1.5">Location *</label>
                <select
                  required
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value as "KW" | "Hamilton" | "" }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-body text-sm focus:outline-none focus:border-[#F2A0B8] transition-colors"
                >
                  <option value="" disabled className="bg-white">Select location</option>
                  <option value="KW" className="bg-white">Kitchener-Waterloo</option>
                  <option value="Hamilton" className="bg-white">Hamilton</option>
                </select>
              </div>
              <div>
                <label className="block font-body text-sm font-semibold text-white/80 mb-1.5">Group Size *</label>
                <input
                  type="number"
                  required
                  min={6}
                  max={20}
                  value={form.groupSize}
                  onChange={e => setForm(f => ({ ...f, groupSize: e.target.value }))}
                  placeholder="e.g. 8"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:border-[#F2A0B8] transition-colors"
                />
                <p className="font-body text-xs text-white/40 mt-1">Minimum 6, maximum 20</p>
              </div>
            </div>

            <div>
              <label className="block font-body text-sm font-semibold text-white/80 mb-1.5">Additional Requests</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Any special requests, dietary needs for refreshments, or questions..."
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 font-body text-sm focus:outline-none focus:border-[#F2A0B8] transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitInquiry.isPending}
              className="w-full py-4 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-base rounded-full hover:bg-[#F2A0B8] transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {submitInquiry.isPending ? "Submitting..." : "Submit Birthday Inquiry"}
            </button>

            <p className="font-body text-white/40 text-xs text-center">
              We'll confirm availability and reach out within 24 hours. Classes run Saturdays in KW and Hamilton.
            </p>
          </form>
        </div>
      </section>

      {/* FAQ strip */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-2xl font-bold text-[#1A0A12] text-center mb-8">Common Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "Do my guests need to buy tickets separately?",
                a: "Yes — the package fee covers the birthday experience upgrades (banner, reserved section, perks). Your guests purchase their own tickets through Luma at the regular class price.",
              },
              {
                q: "What if my preferred date isn't available?",
                a: "We'll let you know within 24 hours and offer the next available date. Classes run every Saturday at both KW and Hamilton locations.",
              },
              {
                q: "Can I add more guests beyond the package limit?",
                a: "For Basic and Premium packages, additional guests can join the public class portion of the session — just have them book through Luma. For Deluxe (private session), the max is 20 people.",
              },
              {
                q: "What are the sparkling drinks in the Deluxe package?",
                a: "We provide non-alcoholic sparkling beverages (sparkling juice, mocktails) for the group. All drinks are puppy-safe and venue-approved.",
              },
            ].map((item) => (
              <div key={item.q} className="border border-[#F2A0B8]/30 rounded-xl p-5">
                <h3 className="font-display font-bold text-[#1A0A12] mb-2">{item.q}</h3>
                <p className="font-body text-[#5C3347] text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
