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
import { formatCanadianPhoneNumber, normalizeCanadianPhoneNumber } from "@shared/phone";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
  breakdown.push(`Classic package (up to 20 guests, 60-min session (40 min yoga + 20 min puppy play), drinks & photos included): $${BASE_MIN}-$${BASE_MAX}`);
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
  const reduceMotion = useReducedMotion();
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
      toast.error("Something went wrong. Please email us directly at afropuppyyoga@gmail.com");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !phone) {
      toast.error("Please enter your name, email, and phone number so we can follow up.");
      return;
    }
    const normalizedPhone = normalizeCanadianPhoneNumber(phone);
    if (!normalizedPhone) {
      toast.error("Please enter a complete 10-digit Canadian phone number, such as (289) 788-1885.");
      return;
    }
    submitInquiry.mutate({
      name,
      email,
      phone: normalizedPhone,
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
    <div className="min-h-screen bg-[#FEFAF4] text-[#34221D] font-body">
      <Navbar />

      <main className="container max-w-7xl pt-28 pb-12 sm:pt-32 sm:pb-16 lg:pt-36 lg:pb-20">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10 xl:gap-16">
          <section
            aria-labelledby="private-event-quote-title"
            className="min-w-0"
          >
            <p className="font-body text-sm font-semibold uppercase tracking-[0.22em] text-[#AA365D] mb-4">
              Private Events
            </p>
            <h1
              id="private-event-quote-title"
              className="font-display text-[clamp(2.75rem,5.2vw,4.75rem)] leading-[1.06] font-medium tracking-[-0.035em] text-[#34221D] mb-5 [text-wrap:pretty]"
            >
              Get an Instant{" "}
              <span className="block italic text-[#AA365D]">Quote</span>
            </h1>
            <p className="font-body text-[#34221D]/80 text-base sm:text-lg leading-relaxed max-w-lg mb-7 sm:mb-8">
              Tell us about your event and we'll give you a price estimate in
              seconds. No commitment required.
            </p>
            <div className="max-w-lg aspect-[5/4] lg:aspect-[4/5] overflow-hidden rounded-t-[48%] rounded-b-[2rem] bg-[#FDE9EF] border border-[#F29CB8]/30">
              <img
                src="/manus-storage/apy_private_events_hero_43ef0f7d.jpg"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover object-center"
                style={{ color: "transparent", fontSize: 0 }}
              />
            </div>
          </section>

          {/* Quote generator */}
          <section className="min-w-0 scroll-mt-28" id="quote-form">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                {step === "submitted" ? (
                  <motion.div
                    key="submitted"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.4,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className="text-center py-10 px-5 sm:py-12 sm:px-7 rounded-2xl border border-[#F29CB8]/50 bg-[#FEFAF4]"
                  >
                    {/* Animated checkmark circle */}
                    <motion.div
                      initial={
                        reduceMotion ? false : { scale: 0.5, opacity: 0 }
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: reduceMotion ? 0 : 0.1,
                        duration: reduceMotion ? 0 : 0.5,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-[#FDE9EF] text-[#AA365D]"
                    >
                      <CheckCircle2
                        size={44}
                        className="text-[#AA365D]"
                        strokeWidth={2}
                      />
                    </motion.div>

                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: reduceMotion ? 0 : 0.25,
                        duration: reduceMotion ? 0 : 0.4,
                      }}
                    >
                      <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#34221D] mb-3 [text-wrap:pretty]">
                        Inquiry Received! 🎉
                      </h2>
                      <p className="font-body text-[#34221D]/80 text-lg max-w-md mx-auto mb-2">
                        We've received your event details and will be in touch
                        within <strong>24 hours</strong> with a formal quote and
                        availability.
                      </p>
                      <p className="font-body text-[#34221D]/80 text-sm max-w-sm mx-auto mb-10 break-words">
                        Check your inbox — a confirmation has been sent to{" "}
                        <strong>{email}</strong>.
                      </p>

                      {/* What happens next */}
                      <div className="max-w-sm mx-auto rounded-2xl border border-[#F29CB8]/40 bg-[#FDE9EF] p-5 sm:p-6 text-left mb-8 space-y-3">
                        <p className="font-body font-semibold text-[#AA365D] text-sm uppercase tracking-wide mb-1">
                          What happens next
                        </p>
                        {[
                          { step: "1", text: "We review your event details" },
                          {
                            step: "2",
                            text: "We confirm puppy & instructor availability",
                          },
                          {
                            step: "3",
                            text: "You receive a formal quote within 24 hrs",
                          },
                        ].map(item => (
                          <div
                            key={item.step}
                            className="flex items-center gap-3"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[#F29CB8] text-[#34221D] text-xs font-semibold">
                              {item.step}
                            </div>
                            <span className="font-body text-sm text-[#34221D]/80">
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>

                      <a
                        href="/"
                        className="inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3 bg-[#F29CB8] text-[#34221D] font-body font-semibold rounded-full hover:bg-[#F29CB8]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D] focus-visible:ring-offset-2 transition-colors motion-reduce:transition-none"
                      >
                        Back to Home
                      </a>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="text-left mb-6">
                      <div className="inline-flex items-center gap-2 text-[#AA365D] mb-3">
                        <Calculator size={16} className="text-[#AA365D]" />
                        <span className="font-body text-sm font-semibold text-[#AA365D]">
                          Instant Estimate
                        </span>
                      </div>
                      <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#34221D] mb-2 [text-wrap:pretty]">
                        Tell Us About Your Event
                      </h2>
                      <p className="font-body text-[#34221D]/80">
                        Fill in the details below to see your estimated price
                        range instantly.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Event details */}
                      <div className="bg-[#FEFAF4] rounded-2xl border border-[#F29CB8]/50 p-5 sm:p-7 space-y-6">
                        <h3 className="font-display font-medium text-2xl sm:text-3xl text-[#34221D] flex items-center gap-2">
                          <Sparkles size={18} className="text-[#AA365D]" />
                          Event Details
                        </h3>

                        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-6">
                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Event Type *
                            </Label>
                            <Select
                              value={eventType}
                              onValueChange={setEventType}
                            >
                              <SelectTrigger className="h-12 md:h-12 data-[size=default]:h-12 md:data-[size=default]:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60 data-[placeholder]:text-[#34221D]/60">
                                <SelectValue placeholder="Select event type" />
                              </SelectTrigger>
                              <SelectContent className="border-[#F29CB8]/40 bg-[#FEFAF4] text-[#34221D]">
                                {EVENT_TYPES.map(t => (
                                  <SelectItem
                                    key={t}
                                    value={t}
                                    className="min-h-11 focus:bg-[#FDE9EF] focus:text-[#34221D]"
                                  >
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Number of Guests *
                            </Label>
                            <Input
                              type="number"
                              min="5"
                              max="200"
                              placeholder="e.g. 25"
                              value={guests}
                              onChange={e => setGuests(e.target.value)}
                              className="h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60"
                            />
                            {guestCount > 20 && guestCount <= 40 && (
                              <p className="text-sm font-body text-[#AA365D]">
                                A second session will be added for {guestCount}{" "}
                                guests.
                              </p>
                            )}
                            {guestCount > 40 && (
                              <p className="text-sm font-body text-[#AA365D]">
                                For 40+ guests we'll prepare a custom VIP quote.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Event Location *
                            </Label>
                            <Select
                              value={locationKey}
                              onValueChange={setLocationKey}
                            >
                              <SelectTrigger className="h-12 md:h-12 data-[size=default]:h-12 md:data-[size=default]:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60 data-[placeholder]:text-[#34221D]/60">
                                <SelectValue placeholder="Select city / venue" />
                              </SelectTrigger>
                              <SelectContent className="border-[#F29CB8]/40 bg-[#FEFAF4] text-[#34221D]">
                                {LOCATIONS.map(l => (
                                  <SelectItem
                                    key={l.value}
                                    value={l.value}
                                    className="min-h-11 focus:bg-[#FDE9EF] focus:text-[#34221D]"
                                  >
                                    {l.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {locationKey && TRAVEL_FEES[locationKey] > 0 && (
                              <p className="text-sm font-body text-[#AA365D]">
                                Travel fee: +${TRAVEL_FEES[locationKey]} for
                                this location.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Preferred Date
                            </Label>
                            <Input
                              type="date"
                              value={preferredDate}
                              onChange={e => setPreferredDate(e.target.value)}
                              className="h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60"
                            />
                          </div>
                        </div>

                        {/* Package selector */}
                        <div className="space-y-3">
                          <Label className="font-body text-sm font-semibold text-[#34221D]">
                            Package *
                          </Label>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {(["classic", "signature", "luxury"] as const).map(
                              pkg => (
                                <button
                                  key={pkg}
                                  type="button"
                                  onClick={() => setPackageType(pkg)}
                                  aria-pressed={packageType === pkg}
                                  className={`min-h-12 py-3 px-2 rounded-xl border font-body font-semibold text-[13px] sm:text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D] focus-visible:ring-offset-2 motion-reduce:transition-none ${
                                    packageType === pkg
                                      ? "border-[#AA365D] bg-[#FDE9EF] text-[#34221D]"
                                      : "border-[#AA365D]/70 bg-[#FEFAF4] text-[#34221D]/80 hover:border-[#AA365D] hover:bg-[#FDE9EF]/50"
                                  }`}
                                >
                                  {pkg}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Live quote estimate */}
                      <AnimatePresence>
                        {quote && (
                          <motion.div
                            initial={
                              reduceMotion ? false : { opacity: 0, y: 10 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={
                              reduceMotion
                                ? { opacity: 1 }
                                : { opacity: 0, y: -10 }
                            }
                            transition={{ duration: reduceMotion ? 0 : 0.2 }}
                            className="rounded-2xl border border-[#F29CB8]/60 bg-[#FDE9EF] p-5 sm:p-7 text-[#34221D]"
                          >
                            <div className="flex items-center gap-2 mb-6">
                              <Calculator
                                size={18}
                                className="text-[#AA365D]"
                              />
                              <span className="font-body text-sm font-semibold text-[#AA365D] uppercase tracking-wider">
                                Your Estimate
                              </span>
                            </div>

                            {quote.isVip ? (
                              <div>
                                <div className="font-display text-[clamp(1.875rem,3vw,2.5rem)] leading-tight font-medium text-[#34221D] [text-wrap:pretty] mb-2">
                                  $2,500+
                                </div>
                                <p className="font-body text-[#34221D]/80 text-sm">
                                  Custom Luxury quote — we'll reach out with a
                                  fully tailored proposal.
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="font-display text-[clamp(1.875rem,3vw,2.5rem)] leading-tight font-medium text-[#34221D] [text-wrap:pretty] mb-1">
                                  ${quote.min.toLocaleString()} - $
                                  {quote.max.toLocaleString()}
                                </div>
                                <p className="font-body text-[#34221D]/80 text-sm mb-6">
                                  Estimated price range (CAD)
                                </p>

                                <div className="space-y-3 border-t border-[#AA365D]/20 pt-5">
                                  {quote.breakdown.map(line => (
                                    <div
                                      key={line}
                                      className="flex items-start gap-2"
                                    >
                                      <ChevronRight
                                        size={14}
                                        className="text-[#AA365D] mt-0.5 shrink-0"
                                      />
                                      <span className="font-body text-[#34221D]/80 text-sm leading-relaxed">
                                        {line}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {quote.sessions === 2 && (
                                  <div className="mt-4 px-4 py-3 bg-[#F29CB8]/10 rounded-xl border border-[#F29CB8]/20">
                                    <p className="font-body text-[#AA365D] text-sm leading-relaxed">
                                      With {guestCount} guests, we'll run{" "}
                                      {quote.sessions} back-to-back sessions so
                                      everyone gets the full experience.
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Contact info */}
                      <div className="bg-[#FEFAF4] rounded-2xl border border-[#F29CB8]/50 p-5 sm:p-7 space-y-6">
                        <h3 className="font-display font-medium text-2xl sm:text-3xl text-[#34221D] flex items-center gap-2">
                          <Users size={18} className="text-[#AA365D]" />
                          Your Contact Info
                        </h3>
                        <p className="font-body text-[#34221D]/80 text-sm -mt-2">
                          We'll follow up with a formal quote and availability
                          within 24 hours.
                        </p>

                        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-6">
                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Full Name *
                            </Label>
                            <Input
                              placeholder="Your name"
                              value={name}
                              onChange={e => setName(e.target.value)}
                              className="h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Email Address *
                            </Label>
                            <div className="relative">
                              <Mail
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#34221D]/80"
                              />
                              <Input
                                type="email"
                                placeholder="you@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="pl-9 h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Phone Number *
                            </Label>
                            <div className="relative">
                              <Phone
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#34221D]/80"
                              />
                              <Input
                                type="tel"
                                placeholder="(289) 788-1885"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                onBlur={() => {
                                  const formatted =
                                    formatCanadianPhoneNumber(phone);
                                  if (formatted !== phone) setPhone(formatted);
                                }}
                                inputMode="tel"
                                autoComplete="tel"
                                aria-describedby="private-event-phone-help"
                                className="pl-9 h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60"
                              />
                            </div>
                            <p
                              id="private-event-phone-help"
                              className="font-body text-sm text-[#34221D]/80"
                            >
                              Canadian mobile or local number required. We will
                              format it automatically.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="font-body text-sm font-semibold text-[#34221D]">
                              Preferred Date
                            </Label>
                            <div className="relative">
                              <Calendar
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#34221D]/80"
                              />
                              <Input
                                type="date"
                                value={preferredDate}
                                onChange={e => setPreferredDate(e.target.value)}
                                className="pl-9 h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="font-body text-sm font-semibold text-[#34221D]">
                            Additional Notes
                          </Label>
                          <Textarea
                            placeholder="Tell us more about your event — theme, special requests, accessibility needs, etc."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60 min-h-[128px] resize-none"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={
                          !quoteReady ||
                          !name ||
                          !email ||
                          submitInquiry.isPending
                        }
                        className="w-full h-auto min-h-12 py-3.5 bg-[#F29CB8] hover:bg-[#F29CB8]/85 text-[#34221D] font-body font-semibold text-base rounded-full focus-visible:ring-[#AA365D] focus-visible:ring-offset-2 transition-colors disabled:opacity-60 motion-reduce:transition-none"
                      >
                        {submitInquiry.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg
                              className="animate-spin motion-reduce:animate-none h-5 w-5 text-[#34221D]"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            Sending your inquiry…
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            Send My Inquiry <ChevronRight size={18} />
                          </span>
                        )}
                      </Button>

                      <p className="text-center font-body text-[#34221D]/80 text-sm">
                        No commitment required. We'll respond within 24 hours.
                      </p>

                      {/* What happens next */}
                      <div className="mt-4 bg-[#F29CB8]/10 border border-[#F29CB8]/25 rounded-xl px-5 py-4 text-left">
                        <p className="font-body text-sm font-semibold text-[#AA365D] uppercase tracking-wider mb-2">
                          What happens after you submit?
                        </p>
                        <ul className="space-y-1.5">
                          <li className="flex items-start gap-2 font-body text-sm text-[#34221D]/80">
                            <span className="text-[#AA365D] font-bold shrink-0">
                              1.
                            </span>{" "}
                            You'll receive a confirmation email right away.
                          </li>
                          <li className="flex items-start gap-2 font-body text-sm text-[#34221D]/80">
                            <span className="text-[#AA365D] font-bold shrink-0">
                              2.
                            </span>{" "}
                            We'll follow up within 24–48 hours with a formal
                            quote and availability.
                          </li>
                          <li className="flex items-start gap-2 font-body text-sm text-[#34221D]/80">
                            <span className="text-[#AA365D] font-bold shrink-0">
                              3.
                            </span>{" "}
                            Final pricing depends on date, location, puppy
                            availability, group size, and add-ons.
                          </li>
                        </ul>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      {/* Package overview */}
      <section className="py-12 sm:py-16 bg-[#FDE9EF]/35 border-t border-[#F29CB8]/35">
        <div className="container">
          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                emoji: "\uD83D\uDC3E",
                name: "Classic Experience",
                price: "$1,200-$1,500",
                bestFor: "Birthdays, girls' days & intimate private events",
                desc: "Perfect for birthdays, girls' days & intimate wellness experiences.",
                color: "border-[#F29CB8]/50",
                badge: "bg-[#FDE9EF] text-[#AA365D]",
                items: [
                  {
                    emoji: "✨",
                    text: "60-min session: 40 min guided yoga + 20 min puppy playtime",
                  },
                  {
                    emoji: "\uD83D\uDC36",
                    text: "Puppies + dedicated puppy handlers",
                  },
                  {
                    emoji: "\uD83E\uDDD8",
                    text: "Professional yoga instructor",
                  },
                  {
                    emoji: "\uD83D\uDCF8",
                    text: "Group photo + puppy playtime",
                  },
                  { emoji: "\uD83D\uDC9B", text: "Basic mats included" },
                  {
                    emoji: "\uD83E\uDD64",
                    text: "Refreshments & wellness treats",
                  },
                  { emoji: "\uD83C\uDFB6", text: "Curated music & atmosphere" },
                  { emoji: "\uD83D\uDC65", text: "Up to 20 guests" },
                ],
              },
              {
                emoji: "\u2728",
                name: "Signature Experience",
                price: "$1,500-$2,250",
                bestFor:
                  "Bachelorettes, elevated celebrations & premium content",
                desc: "Our most popular - for bachelorettes, celebrations & elevated social experiences.",
                color: "border-[#F29CB8]",
                badge: "bg-[#F29CB8]/20 text-[#AA365D]",
                popular: true,
                items: [
                  {
                    emoji: "\uD83D\uDC3E",
                    text: "Everything in Classic Experience",
                  },
                  {
                    emoji: "\uD83D\uDCF8",
                    text: "Professional event photography",
                  },
                  {
                    emoji: "\uD83E\uDDD8",
                    text: "Premium mats & elevated setup",
                  },
                  {
                    emoji: "\u2728",
                    text: "Enhanced photo moments & event styling",
                  },
                  {
                    emoji: "\uD83D\uDC36",
                    text: "Extended puppy interaction experience",
                  },
                  {
                    emoji: "\uD83D\uDC9B",
                    text: "Elevated event atmosphere & setup",
                  },
                ],
              },
              {
                emoji: "\uD83D\uDC8E",
                name: "Luxury Experience",
                price: "$2,500+",
                bestFor: "Corporate wellness, brand activations & large groups",
                desc: "For corporate events, large activations & fully customized luxury experiences.",
                color: "border-[#F29CB8]/50",
                badge: "bg-[#FDE9EF] text-[#34221D]",
                items: [
                  {
                    emoji: "\uD83D\uDC8E",
                    text: "Everything in Signature Experience",
                  },
                  {
                    emoji: "\uD83C\uDFAC",
                    text: "Professional videography options",
                  },
                  {
                    emoji: "\uD83C\uDF81",
                    text: "Curated gift bags & branded add-ons",
                  },
                  {
                    emoji: "\uD83D\uDC36",
                    text: "Larger puppy team & staffing support",
                  },
                  {
                    emoji: "\uD83C\uDF69",
                    text: "Catering, dessert & wellness vendors",
                  },
                  {
                    emoji: "\u2728",
                    text: "Fully customized event experience",
                  },
                ],
              },
            ].map(pkg => (
              <div
                key={pkg.name}
                className={`rounded-2xl border p-6 sm:p-7 relative bg-[#FEFAF4] ${pkg.color}`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#F29CB8] text-[#34221D] text-xs font-body font-bold rounded-full">
                    Most Popular
                  </span>
                )}
                <div
                  className={`inline-block px-3 py-1.5 rounded-full text-sm font-body font-semibold mb-3 ${pkg.badge}`}
                >
                  {pkg.emoji} {pkg.name}
                </div>
                <div className="font-display text-3xl font-medium text-[#34221D] mb-3">
                  {pkg.price}
                </div>
                <div className="flex flex-wrap items-baseline gap-1.5 mb-3">
                  <span className="font-body text-xs font-semibold text-[#AA365D] uppercase tracking-wide">
                    Best for:
                  </span>
                  <span className="font-body text-sm text-[#34221D]/80">
                    {(pkg as any).bestFor}
                  </span>
                </div>
                <p className="font-body text-[#34221D]/80 text-sm mb-5 leading-relaxed">
                  {pkg.desc}
                </p>
                <ul className="space-y-3">
                  {pkg.items.map(item => (
                    <li
                      key={item.text}
                      className="flex items-start gap-2 text-sm font-body text-[#34221D]/80 leading-relaxed"
                    >
                      <span
                        className="shrink-0 text-base leading-none mt-0.5"
                        style={{ color: "initial", opacity: 1, filter: "none" }}
                      >
                        {item.emoji}
                      </span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center font-body text-[#34221D]/80 text-sm mt-6 max-w-3xl mx-auto leading-relaxed">
            * Prices shown are for studio location (KW). Travel fees apply for
            offsite events. Second session required for 21+ guests.
          </p>

          {/* Corporate CTA */}
          <div className="mt-10 max-w-6xl mx-auto rounded-2xl border border-[#F29CB8]/40 bg-[#FDE9EF] p-6 sm:p-8 flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
            <div className="text-3xl shrink-0">🏢</div>
            <div className="flex-1">
              <p className="font-display font-medium text-[#34221D] text-2xl mb-2">
                Planning a team wellness day?
              </p>
              <p className="font-body text-[#34221D]/80 text-sm">
                We work with HR teams, universities, law firms, tech companies &
                wellness committees across Ontario.
              </p>
            </div>
            <a
              href="#quote-form"
              onClick={e => {
                e.preventDefault();
                document
                  .querySelector("#quote-form")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="shrink-0 inline-flex items-center justify-center gap-2 min-h-12 px-5 py-3 bg-[#F29CB8] text-[#34221D] font-body font-semibold text-sm rounded-full hover:bg-[#F29CB8]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D] focus-visible:ring-offset-2 transition-colors motion-reduce:transition-none"
            >
              Request a Corporate Quote
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
