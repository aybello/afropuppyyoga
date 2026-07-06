/* ============================================================
   Private Event Quote Generator — AfroPuppyYoga
   Pricing logic:
   - Classic package: $1,200-$1,500 (up to 20 guests, 1 hr, at studio)
   - 21-40 guests: second session added (+$800-$1,000)
   - 40+ guests: Luxury / custom quote
   - Offsite travel fee by city distance from KW
   - Package upgrades: Classic / Signature / Luxury
   ============================================================ */
import { useState } from "react";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users,
  MapPin,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Calculator,
  Calendar,
  Phone,
  Mail,
} from "lucide-react";

// ── Pricing constants ──────────────────────────────────────
const BASE_MIN = 1200;
const BASE_MAX = 1500;
const SECOND_SESSION_MIN = 800;
const SECOND_SESSION_MAX = 1000;
const SIGNATURE_UPGRADE = 750; // professional photographer + premium mats + enhanced styling — Signature = BASE_MAX + SIGNATURE_UPGRADE = $2,250
const LUXURY_MIN = 2500;

// Travel fees by city (one-way distance from KW studio)
const TRAVEL_FEES: Record<string, number> = {
  kitchener: 0,
  waterloo: 0,
  cambridge: 0,
  hamilton: 0,
  guelph: 75,
  burlington: 100,
  oakville: 150,
  mississauga: 175,
  toronto: 200,
  brampton: 175,
  markham: 225,
  other: 200,
};

const EVENT_TYPES = [
  "Corporate Wellness",
  "Birthday Party",
  "Bachelorette",
  "Baby Shower",
  "Team Building",
  "School / Youth Event",
  "Other",
];

const LOCATIONS = [
  { value: "kitchener", label: "Kitchener (APY Studio)" },
  { value: "waterloo", label: "Waterloo" },
  { value: "cambridge", label: "Cambridge" },
  { value: "guelph", label: "Guelph" },
  { value: "hamilton", label: "Hamilton (APY Studio)" },
  { value: "burlington", label: "Burlington" },
  { value: "oakville", label: "Oakville (APY Studio)" },
  { value: "other", label: "Other (specify in notes)" },
];

// ── Quote calculation ──────────────────────────────────────
function calculateQuote(
  guests: number,
  locationKey: string,
  packageType: "classic" | "signature" | "luxury"
): { min: number; max: number; sessions: number; isVip: boolean; breakdown: string[] } {
  if (packageType === "luxury" || guests > 40) {
    return {
      min: LUXURY_MIN,
      max: LUXURY_MIN + 2500,
      sessions: Math.ceil(guests / 20),
      isVip: true,
      breakdown: ["Fully customized Luxury experience", "Pricing tailored to your event"],
    };
  }

  const sessions = guests > 20 ? 2 : 1;
  const travelFee = TRAVEL_FEES[locationKey] ?? 200;
  const isOffsite = travelFee > 0;

  let min = BASE_MIN + (sessions === 2 ? SECOND_SESSION_MIN : 0) + travelFee;
  let max = BASE_MAX + (sessions === 2 ? SECOND_SESSION_MAX : 0) + travelFee;

  if (packageType === "signature") {
    min += SIGNATURE_UPGRADE;
    max += SIGNATURE_UPGRADE;
  }

  const breakdown: string[] = [];
  breakdown.push(`Classic package (up to 20 guests, 60-min session, drinks & photos included): $${BASE_MIN}-$${BASE_MAX}`);
  if (sessions === 2) {
    breakdown.push(`Second session for ${guests} guests: +$${SECOND_SESSION_MIN}-$${SECOND_SESSION_MAX}`);
  }
  if (isOffsite) {
    breakdown.push(`Travel fee (${LOCATIONS.find((l) => l.value === locationKey)?.label ?? "offsite"}): +$${travelFee}`);
  }
  if (packageType === "signature") {
    breakdown.push(`Signature upgrade (professional photographer, premium mats, enhanced styling): +$${SIGNATURE_UPGRADE}`);
  }

  return { min, max, sessions, isVip: false, breakdown };
}

// ── Main component ─────────────────────────────────────────
export default function PrivateEventQuote() {
  useSeoMeta({
    title: "Private Event Quote | AfroPuppyYoga",
    description: "Get an instant quote for a private puppy yoga event with AfroPuppyYoga. Perfect for corporate wellness days, bachelorette parties, birthdays, and team events across Ontario.",
    canonical: "https://afropuppyyoga.ca/private-events/quote",
  });
  const [step, setStep] = useState<"form" | "quote" | "submitted">("form");

  // Form state
  const [eventType, setEventType] = useState("");
  const [guests, setGuests] = useState("");
  const [locationKey, setLocationKey] = useState("");
  const [packageType, setPackageType] = useState<"classic" | "signature" | "luxury">("classic");
  const [preferredDate, setPreferredDate] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const guestCount = parseInt(guests) || 0;
  const quoteReady =
    guestCount >= 5 && locationKey && eventType && packageType;

  const quote = quoteReady
    ? calculateQuote(guestCount, locationKey, packageType)
    : null;

  const submitInquiry = trpc.privateEvents.submitInquiry.useMutation({
    onSuccess: () => {
      setStep("submitted");
    },
    onError: () => {
      toast.error("Something went wrong. Please email us directly at afropuppyyogaofficial@gmail.com");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !phone) {
      toast.error("Please enter your name, email, and phone number so we can follow up.");
      return;
    }
    submitInquiry.mutate({
      name,
      email,
      phone,
      eventType,
      guests: guestCount,
      location: LOCATIONS.find((l) => l.value === locationKey)?.label ?? locationKey,
      packageType,
      preferredDate,
      notes,
      estimatedMin: quote?.min ?? 0,
      estimatedMax: quote?.max ?? 0,
    });
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-12 bg-[#3D1A2E] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #F2A0B8 0%, transparent 60%)" }}
        />
        <div className="relative container text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-0.5 bg-[#F2A0B8]" />
            <span className="text-[#F2A0B8] font-body text-xs font-semibold tracking-widest uppercase">
              Private Events
            </span>
            <div className="w-8 h-0.5 bg-[#F2A0B8]" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Get an Instant Quote
          </h1>
          <p className="font-body text-white/60 text-lg max-w-xl mx-auto">
            Tell us about your event and we'll give you a price estimate in seconds. No commitment required.
          </p>
        </div>
      </section>

      {/* Package overview */}
      <section className="py-10 bg-white border-b border-[#F2A0B8]/20">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                emoji: "\uD83D\uDC3E",
                name: "Classic Experience",
                price: "$1,200-$1,500",
                desc: "Perfect for birthdays, girls' days & intimate wellness experiences.",
                color: "border-[#8B2252]/30",
                badge: "bg-[#8B2252]/10 text-[#8B2252]",
                items: [
                  { emoji: "\u2728", text: "60-min beginner-friendly Puppy Yoga session" },
                  { emoji: "\uD83D\uDC36", text: "Puppies + dedicated puppy handlers" },
                  { emoji: "\uD83E\uDDD8", text: "Professional yoga instructor" },
                  { emoji: "\uD83D\uDCF8", text: "Group photo + puppy playtime" },
                  { emoji: "\uD83D\uDC9B", text: "Basic mats included" },
                  { emoji: "\uD83E\uDD64", text: "Refreshments & wellness treats" },
                  { emoji: "\uD83C\uDFB6", text: "Curated music & atmosphere" },
                  { emoji: "\uD83D\uDC65", text: "Up to 20 guests" },
                ],
              },
              {
                emoji: "\u2728",
                name: "Signature Experience",
                price: "$1,500-$2,250",
                desc: "Our most popular - for bachelorettes, celebrations & elevated social experiences.",
                color: "border-[#F2A0B8] ring-2 ring-[#F2A0B8]/30",
                badge: "bg-[#F2A0B8]/20 text-[#8B2252]",
                popular: true,
                items: [
                  { emoji: "\uD83D\uDC3E", text: "Everything in Classic Experience" },
                  { emoji: "\uD83D\uDCF8", text: "Professional event photography" },
                  { emoji: "\uD83E\uDDD8", text: "Premium mats & elevated setup" },
                  { emoji: "\u2728", text: "Enhanced photo moments & event styling" },
                  { emoji: "\uD83D\uDC36", text: "Extended puppy interaction experience" },
                  { emoji: "\uD83D\uDC9B", text: "Elevated event atmosphere & setup" },
                ],
              },
              {
                emoji: "\uD83D\uDC8E",
                name: "Luxury Experience",
                price: "$2,500+",
                desc: "For corporate events, large activations & fully customized luxury experiences.",
                color: "border-[#8B2252]/30",
                badge: "bg-[#1A0A12]/10 text-[#1A0A12]",
                items: [
                  { emoji: "\uD83D\uDC8E", text: "Everything in Signature Experience" },
                  { emoji: "\uD83C\uDFAC", text: "Professional videography options" },
                  { emoji: "\uD83C\uDF81", text: "Curated gift bags & branded add-ons" },
                  { emoji: "\uD83D\uDC36", text: "Larger puppy team & staffing support" },
                  { emoji: "\uD83C\uDF69", text: "Catering, dessert & wellness vendors" },
                  { emoji: "\u2728", text: "Fully customized event experience" },
                ],
              },
            ].map((pkg) => (
              <div
                key={pkg.name}
                className={`rounded-2xl border-2 p-6 relative bg-white ${pkg.color}`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#F2A0B8] text-[#1A0A12] text-xs font-body font-bold rounded-full">
                    Most Popular
                  </span>
                )}
                <div className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-body font-semibold mb-2 ${pkg.badge}`}>
                  {pkg.emoji} {pkg.name}
                </div>
                <div className="font-display text-2xl font-bold text-[#1A0A12] mb-1">{pkg.price}</div>
                <p className="font-body text-[#3D1A2E]/55 text-xs mb-4 leading-relaxed">{pkg.desc}</p>
                <ul className="space-y-2">
                  {pkg.items.map((item) => (
                    <li key={item.text} className="flex items-start gap-2 text-sm font-body text-[#3D1A2E]/70">
                      <span className="shrink-0 text-base leading-none mt-0.5" style={{ color: 'initial', opacity: 1, filter: 'none' }}>{item.emoji}</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center font-body text-[#3D1A2E]/50 text-xs mt-4">
            * Prices shown are for studio location (KW). Travel fees apply for offsite events. Second session required for 21+ guests.
          </p>
        </div>
      </section>

      {/* Quote generator */}
      <section className="py-16">
        <div className="container max-w-3xl">
          <AnimatePresence mode="wait">
            {step === "submitted" ? (
              <motion.div
                key="submitted"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-20 h-20 rounded-full bg-[#F2A0B8]/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={40} className="text-[#8B2252]" />
                </div>
                <h2 className="font-display text-3xl font-bold text-[#1A0A12] mb-3">
                  Inquiry Received!
                </h2>
                <p className="font-body text-[#3D1A2E]/70 text-lg max-w-md mx-auto mb-8">
                  We'll review your details and get back to you within 24 hours with a formal quote and availability.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-[#8B2252] text-white font-body font-semibold rounded-full hover:bg-[#6B1A3F] transition-colors"
                >
                  Back to Home
                </a>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2A0B8]/15 rounded-full mb-4">
                    <Calculator size={16} className="text-[#8B2252]" />
                    <span className="font-body text-sm font-semibold text-[#8B2252]">Instant Estimate</span>
                  </div>
                  <h2 className="font-display text-3xl font-bold text-[#1A0A12] mb-2">
                    Tell Us About Your Event
                  </h2>
                  <p className="font-body text-[#3D1A2E]/60">
                    Fill in the details below to see your estimated price range instantly.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Event details */}
                  <div className="bg-white rounded-2xl border border-[#F2A0B8]/20 p-8 space-y-6">
                    <h3 className="font-display font-bold text-lg text-[#1A0A12] flex items-center gap-2">
                      <Sparkles size={18} className="text-[#F2A0B8]" />
                      Event Details
                    </h3>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Event Type *
                        </Label>
                        <Select value={eventType} onValueChange={setEventType}>
                          <SelectTrigger className="border-[#F2A0B8]/40 focus:border-[#8B2252]">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent>
                            {EVENT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Number of Guests *
                        </Label>
                        <Input
                          type="number"
                          min="5"
                          max="200"
                          placeholder="e.g. 25"
                          value={guests}
                          onChange={(e) => setGuests(e.target.value)}
                          className="border-[#F2A0B8]/40 focus:border-[#8B2252]"
                        />
                        {guestCount > 20 && guestCount <= 40 && (
                          <p className="text-xs font-body text-[#8B2252]">
                            A second session will be added for {guestCount} guests.
                          </p>
                        )}
                        {guestCount > 40 && (
                          <p className="text-xs font-body text-[#8B2252]">
                            For 40+ guests we'll prepare a custom VIP quote.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Event Location *
                        </Label>
                        <Select value={locationKey} onValueChange={setLocationKey}>
                          <SelectTrigger className="border-[#F2A0B8]/40 focus:border-[#8B2252]">
                            <SelectValue placeholder="Select city / venue" />
                          </SelectTrigger>
                          <SelectContent>
                            {LOCATIONS.map((l) => (
                              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {locationKey && TRAVEL_FEES[locationKey] > 0 && (
                          <p className="text-xs font-body text-[#8B2252]">
                            Travel fee: +${TRAVEL_FEES[locationKey]} for this location.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Preferred Date
                        </Label>
                        <Input
                          type="date"
                          value={preferredDate}
                          onChange={(e) => setPreferredDate(e.target.value)}
                          className="border-[#F2A0B8]/40 focus:border-[#8B2252]"
                        />
                      </div>
                    </div>

                    {/* Package selector */}
                    <div className="space-y-3">
                      <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                        Package *
                      </Label>
                      <div className="grid grid-cols-3 gap-3">
                        {(["classic", "signature", "luxury"] as const).map((pkg) => (
                          <button
                            key={pkg}
                            type="button"
                            onClick={() => setPackageType(pkg)}
                            className={`py-3 px-4 rounded-xl border-2 font-body font-semibold text-sm capitalize transition-all ${
                              packageType === pkg
                                ? "border-[#8B2252] bg-[#8B2252]/10 text-[#8B2252]"
                                : "border-[#F2A0B8]/30 text-[#3D1A2E]/60 hover:border-[#F2A0B8]"
                            }`}
                          >
                            {pkg}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live quote estimate */}
                  <AnimatePresence>
                    {quote && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-[#1A0A12] rounded-2xl p-8 text-white"
                      >
                        <div className="flex items-center gap-2 mb-6">
                          <Calculator size={18} className="text-[#F2A0B8]" />
                          <span className="font-body text-sm font-semibold text-[#F2A0B8] uppercase tracking-wider">
                            Your Estimate
                          </span>
                        </div>

                        {quote.isVip ? (
                          <div>
                            <div className="font-display text-4xl font-bold text-white mb-2">
                              $2,500+
                            </div>
                            <p className="font-body text-white/60 text-sm">
                              Custom Luxury quote — we'll reach out with a fully tailored proposal.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="font-display text-4xl font-bold text-white mb-1">
                              ${quote.min.toLocaleString()} - ${quote.max.toLocaleString()}
                            </div>
                            <p className="font-body text-white/50 text-sm mb-6">Estimated price range (CAD)</p>

                            <div className="space-y-2 border-t border-white/10 pt-5">
                              {quote.breakdown.map((line) => (
                                <div key={line} className="flex items-start gap-2">
                                  <ChevronRight size={14} className="text-[#F2A0B8] mt-0.5 shrink-0" />
                                  <span className="font-body text-white/65 text-sm">{line}</span>
                                </div>
                              ))}
                            </div>

                            {quote.sessions === 2 && (
                              <div className="mt-4 px-4 py-3 bg-[#F2A0B8]/10 rounded-xl border border-[#F2A0B8]/20">
                                <p className="font-body text-[#F2A0B8] text-sm">
                                  With {guestCount} guests, we'll run {quote.sessions} back-to-back sessions so everyone gets the full experience.
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Contact info */}
                  <div className="bg-white rounded-2xl border border-[#F2A0B8]/20 p-8 space-y-6">
                    <h3 className="font-display font-bold text-lg text-[#1A0A12] flex items-center gap-2">
                      <Users size={18} className="text-[#F2A0B8]" />
                      Your Contact Info
                    </h3>
                    <p className="font-body text-[#3D1A2E]/55 text-sm -mt-2">
                      We'll follow up with a formal quote and availability within 24 hours.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Full Name *
                        </Label>
                        <Input
                          placeholder="Your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="border-[#F2A0B8]/40 focus:border-[#8B2252]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Email Address *
                        </Label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3D1A2E]/40" />
                          <Input
                            type="email"
                            placeholder="you@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-9 border-[#F2A0B8]/40 focus:border-[#8B2252]"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Phone Number *
                        </Label>
                        <div className="relative">
                          <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3D1A2E]/40" />
                          <Input
                            type="tel"
                            placeholder="+1 (289) 000-0000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="pl-9 border-[#F2A0B8]/40 focus:border-[#8B2252]"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                          Preferred Date
                        </Label>
                        <div className="relative">
                          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3D1A2E]/40" />
                          <Input
                            type="date"
                            value={preferredDate}
                            onChange={(e) => setPreferredDate(e.target.value)}
                            className="pl-9 border-[#F2A0B8]/40 focus:border-[#8B2252]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-body text-sm font-semibold text-[#3D1A2E]">
                        Additional Notes
                      </Label>
                      <Textarea
                        placeholder="Tell us more about your event — theme, special requests, accessibility needs, etc."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="border-[#F2A0B8]/40 focus:border-[#8B2252] min-h-[100px] resize-none"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!quoteReady || !name || !email || submitInquiry.isPending}
                    className="w-full py-4 bg-[#8B2252] hover:bg-[#6B1A3F] text-white font-body font-bold text-base rounded-full transition-all"
                  >
                    {submitInquiry.isPending ? "Sending..." : "Send My Inquiry"}
                    {!submitInquiry.isPending && <ChevronRight size={18} className="ml-1" />}
                  </Button>

                  <p className="text-center font-body text-[#3D1A2E]/40 text-xs">
                    No commitment required. We'll respond within 24 hours.
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <Footer />
    </div>
  );
}
