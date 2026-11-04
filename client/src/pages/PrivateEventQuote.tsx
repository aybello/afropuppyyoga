/* ============================================================
   Private Event Quote Generator — AfroPuppyYoga
   Shared indicative test bands, plus HST.
   Final scope/date/delivery confirmed by APY; off-site travel quoted separately.
   Larger groups receive a custom quote, never an automatic session surcharge.
   ============================================================ */
import { useState } from "react";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { formatCanadianPhoneNumber, normalizeCanadianPhoneNumber } from "@shared/phone";
import { estimatePrivateEventPackage, privateEventBandLabel, PRIVATE_EVENT_PRICE_NOTE, PRIVATE_EVENT_TRAVEL_NOTE, PRIVATE_EVENT_CUSTOM_NOTE, type PrivateEventPackageType } from "@shared/privateEventPricing";
import { publicPortraitUrl } from "@shared/publicPortraits";
import { FIVE_STAR_REVIEW_COUNT } from "@shared/reviewMetrics";
import { recoverPublicPortrait } from "@/lib/publicPortraitRecovery";
import { privateEventPreferencesSchema, privateEventScopeRequiresCustomQuote, validatePrivateEventAttendance, PRIVATE_EVENT_EXPERIENCES, PRIVATE_EVENT_SCHEDULES, PRIVATE_EVENT_VENUES, PRIVATE_EVENT_FORMAT_PRICE_NOTE, PRIVATE_EVENT_CUSTOM_SCOPE_NOTE, type PrivateEventPreferences } from "@shared/privateEventExperience";
import { ExperienceCards, EventPreferencesFields, DEFAULT_EVENT_PREFERENCES, type EventPreferencesDraft } from "@/components/PrivateEventExperience";
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
  { value: "kitchener", label: "Kitchener" },
  { value: "cambridge", label: "Cambridge" },
  { value: "guelph", label: "Guelph" },
  { value: "hamilton", label: "Hamilton" },
  { value: "burlington", label: "Burlington" },
  { value: "oakville", label: "Oakville" },
  { value: "other", label: "Other (specify in notes)" },
];

// ── Main component ─────────────────────────────────────────
export default function PrivateEventQuote() {
  const reduceMotion = useReducedMotion();
  useSeoMeta({
    title: "Private Event Quote | AfroPuppyYoga",
    description: `${FIVE_STAR_REVIEW_COUNT} five-star reviews. Choose private puppy yoga or a puppy play lounge, then share your schedule and venue. See standard studio package ranges or request a custom quote for your full event.`,
    canonical: "https://afropuppyyoga.ca/private-events/quote",
  });
  const [step, setStep] = useState<"form" | "quote" | "submitted">("form");

  // Form state
  const [eventType, setEventType] = useState("");
  const [guests, setGuests] = useState("");
  const [locationKey, setLocationKey] = useState("");
  const [packageType, setPackageType] = useState<PrivateEventPackageType>("classic");
  const [helpChoosePackage, setHelpChoosePackage] = useState(false);
  const [preferencesDraft, setPreferencesDraft] = useState<EventPreferencesDraft>(DEFAULT_EVENT_PREFERENCES);
  const [preferredDate, setPreferredDate] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const guestCount = Number(guests) || 0;
  const eventPreferences: PrivateEventPreferences = {
    experience: preferencesDraft.experience, schedule: preferencesDraft.schedule, venue: preferencesDraft.venue,
    packagePreference: helpChoosePackage ? "help_me_choose" : packageType,
    durationMinutes: Number(preferencesDraft.durationMinutes),
    ...(preferencesDraft.schedule === "multiple" ? { sessionCount: Number(preferencesDraft.sessionCount), guestsPerSession: Number(preferencesDraft.guestsPerSession) } : {}),
    ...(preferencesDraft.schedule === "drop_in" ? { concurrentGuests: Number(preferencesDraft.concurrentGuests) } : {}),
    scheduleNotes: preferencesDraft.scheduleNotes, venueDetails: preferencesDraft.venueDetails,
  };
  const parsedPreferences = privateEventPreferencesSchema.safeParse(eventPreferences);
  const attendanceError = parsedPreferences.success && guestCount > 0 ? validatePrivateEventAttendance(parsedPreferences.data, guestCount) : null;
  const preferencesReady = parsedPreferences.success && !attendanceError;
  const packageCardsCustom = privateEventScopeRequiresCustomQuote(eventPreferences) || guestCount > 20;
  const quoteReady =
    Number.isInteger(guestCount) && guestCount >= 5 && guestCount <= 2000 && locationKey && eventType && packageType;

  const quote = quoteReady
    ? estimatePrivateEventPackage({ guests: guestCount, packageType, eventPreferences })
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
    if (!quoteReady || !parsedPreferences.success || attendanceError) {
      toast.error(attendanceError || "Please complete your event format, duration and attendance details.");
      return;
    }
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
      packageType: helpChoosePackage ? "classic" : packageType,
      eventPreferences: parsedPreferences.data,
      preferredDate,
      notes,
      estimatedMin: quote?.requiresCustomQuote ? 0 : quote?.min ?? 0,
      estimatedMax: quote?.requiresCustomQuote ? 0 : quote?.max ?? 0,
    });
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4] text-[#34221D] font-body">
      <Navbar />

      <main>
      <ExperienceCards selected={preferencesDraft.experience} onChoose={experience => setPreferencesDraft({ ...preferencesDraft, experience, durationMinutes: experience === "puppy_yoga" && preferencesDraft.schedule === "single" ? "60" : "" })} />
      {/* Package overview */}
      <section id="private-event-packages" aria-labelledby="private-event-packages-title" className="py-10 sm:py-12 bg-[#FDE9EF]/35 border-b border-[#F29CB8]/35">
        <div className="container max-w-6xl mb-8 sm:mb-10">
          <p className="font-body text-sm font-semibold uppercase tracking-[0.22em] text-[#AA365D] mb-3">
            Private Events
          </p>
          <h2 id="private-event-packages-title" className="font-display text-[clamp(2.5rem,4.5vw,3.75rem)] leading-[1.08] font-medium tracking-[-0.035em] text-[#34221D] mb-4 [text-wrap:pretty]">
            Choose Your <span className="italic text-[#AA365D]">Package Level</span>
          </h2>
          <p className="font-body text-[#34221D]/80 text-base sm:text-lg leading-relaxed max-w-2xl">
            Classic is the core experience, Signature adds professional photography and enhanced setup, and Luxury is more customized. These price bands are for standard studio puppy yoga, not every format.
          </p>
        </div>
        <div className="container">
          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                emoji: "\uD83D\uDC3E",
                name: "Classic Experience",
                price: privateEventBandLabel("classic"),
                bestFor: "Birthdays, girls' days & intimate private events",
                desc: "The core studio experience for birthdays, girls' days and intimate wellness events.",
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
                price: privateEventBandLabel("signature"),
                bestFor:
                  "Bachelorettes, elevated celebrations & premium content",
                desc: "The core experience with professional photography and an enhanced setup.",
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
                price: privateEventBandLabel("luxury"),
                bestFor: "Corporate wellness, brand activations & large groups",
                desc: "A more customized experience. Larger or more complex events receive a custom quote above this range.",
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
                    text: "Curated gift bag & branded add-on options",
                  },
                  {
                    emoji: "\uD83D\uDC36",
                    text: "Puppy team & staffing agreed for your scope",
                  },
                  {
                    emoji: "\uD83C\uDF69",
                    text: "Catering, dessert & wellness vendor options",
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
                  {packageCardsCustom ? "Custom event quote" : pkg.price}
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
                  {preferencesDraft.experience === "puppy_lounge" ? (pkg.name === "Classic Experience" ? "The core supervised puppy lounge, with scope and staffing agreed for your event." : pkg.name === "Signature Experience" ? "The puppy lounge with professional photography and an enhanced setup, quoted for your scope." : "A more customized puppy lounge, with styling, content and add-on options agreed in your quote.") : pkg.desc}
                </p>
                <ul className="space-y-3">
                  {(preferencesDraft.experience === "puppy_lounge" ? (pkg.name === "Classic Experience" ? [{ emoji: "", text: "Supervised puppy interaction without guided yoga" }, { emoji: "", text: "Puppies and dedicated handlers" }, { emoji: "", text: "Capacity, operating hours and puppy rest agreed for your scope" }] : pkg.items.filter(item => !/mats|Extended puppy interaction/.test(item.text))) : pkg.items).map(item => (
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
            {PRIVATE_EVENT_FORMAT_PRICE_NOTE} {PRIVATE_EVENT_PRICE_NOTE} Groups of 21+ require a custom session plan and quote.
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
              className="shrink-0 inline-flex items-center justify-center gap-2 min-h-12 px-5 py-3 bg-[#F29CB8] text-[#34221D] font-body font-semibold text-sm rounded-full hover:bg-[#F29CB8]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D] focus-visible:ring-offset-2 transition-colors motion-reduce:transition-none"
            >
              Request a Corporate Quote
            </a>
          </div>
        </div>
      </section>

        <div className="container max-w-7xl py-10 sm:py-12 lg:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10 xl:gap-16">
          <section
            aria-labelledby="private-event-quote-title"
            className="min-w-0"
          >
            <h2
              id="private-event-quote-title"
              className="font-display text-[clamp(2.75rem,5.2vw,4.75rem)] leading-[1.06] font-medium tracking-[-0.035em] text-[#34221D] mb-5 [text-wrap:pretty]"
            >
              Plan Your{" "}
              <span className="block italic text-[#AA365D]">Quote</span>
            </h2>
            <p className="font-body text-[#34221D]/80 text-base sm:text-lg leading-relaxed max-w-lg mb-7 sm:mb-8">
              Tell us about your experience, schedule and venue. See a standard studio package range or request a custom quote for the full event. No commitment required.
            </p>
            <div className="max-w-lg aspect-[5/4] lg:aspect-[4/5] overflow-hidden rounded-t-[48%] rounded-b-[2rem] bg-[#FDE9EF] border border-[#F29CB8]/30">
              <img
                src={publicPortraitUrl("/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg")}
                onError={recoverPublicPortrait}
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
                            text: "We confirm the venue, puppy team and any instructor needed",
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
                          Event Estimate
                        </span>
                      </div>
                      <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#34221D] mb-2 [text-wrap:pretty]">
                        Tell Us About Your Event
                      </h2>
                      <p className="font-body text-[#34221D]/80">
                        Choose your format first. Standard studio sessions show a range; other formats receive a custom event quote.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Event details */}
                      <div className="bg-[#FEFAF4] rounded-2xl border border-[#F29CB8]/50 p-5 sm:p-7 space-y-6">
                        <h3 className="font-display font-medium text-2xl sm:text-3xl text-[#34221D] flex items-center gap-2">
                          <Sparkles size={18} className="text-[#AA365D]" />
                          Event Details
                        </h3>

                        <EventPreferencesFields value={preferencesDraft} onChange={setPreferencesDraft} />
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
                              Total expected attendance *
                            </Label>
                            <Input
                              id="event-total-guests"
                              aria-label="Total expected attendance"
                              type="number"
                              min="5"
                              max="2000"
                              step="1"
                              placeholder="e.g. 25"
                              value={guests}
                              onChange={e => setGuests(e.target.value)}
                              className="h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60"
                            />
                            {guestCount > 20 && guestCount <= 40 && (
                              <p className="text-sm font-body text-[#AA365D]">
                                With {guestCount} guests, we'll confirm a custom session plan and quote.
                              </p>
                            )}
                            {guestCount > 40 && (
                              <p className="text-sm font-body text-[#AA365D]">
                                For larger groups, we'll prepare a custom quote that may exceed the package range.
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
                            {locationKey && (
                              <p className="text-sm font-body text-[#AA365D]">
                                If your event is off-site, travel will be quoted separately.
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
                            Preferred package level
                          </Label>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {(["classic", "signature", "luxury"] as const).map(
                              pkg => (
                                <button
                                  key={pkg}
                                  type="button"
                                  onClick={() => { setPackageType(pkg); setHelpChoosePackage(false); }}
                                  aria-pressed={!helpChoosePackage && packageType === pkg}
                                  className={`min-h-12 py-3 px-2 rounded-xl border font-body font-semibold text-[13px] sm:text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D] focus-visible:ring-offset-2 motion-reduce:transition-none ${
                                    !helpChoosePackage && packageType === pkg
                                      ? "border-[#AA365D] bg-[#FDE9EF] text-[#34221D]"
                                      : "border-[#AA365D]/70 bg-[#FEFAF4] text-[#34221D]/80 hover:border-[#AA365D] hover:bg-[#FDE9EF]/50"
                                  }`}
                                >
                                  {pkg}
                                </button>
                              )
                            )}
                          </div>
                          <button type="button" data-package-help aria-pressed={helpChoosePackage} onClick={() => setHelpChoosePackage(!helpChoosePackage)} className="min-h-12 px-4 py-3 rounded-xl border border-[#AA365D]/60 bg-[#FEFAF4] text-[#34221D] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D]">Help me choose</button>
                          <p className="text-sm text-[#34221D]/70">This is a preference, not a confirmed package or booking price.</p>
                          {attendanceError && <p role="alert" className="text-sm text-[#AA365D]">{attendanceError}</p>}
                          {!parsedPreferences.success && <p className="text-sm text-[#34221D]/70">Complete the duration and any required session or simultaneous-attendance fields before sending.</p>}
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

                            {quote.requiresCustomQuote ? (
                              <div>
                                <div className="font-display text-[clamp(1.875rem,3vw,2.5rem)] leading-tight font-medium text-[#34221D] [text-wrap:pretty] mb-2">
                                  Custom quote required
                                </div>
                                <p className="font-body text-[#34221D]/80 text-sm">
                                  Preferred package level: {helpChoosePackage ? "Help me choose" : packageType.charAt(0).toUpperCase() + packageType.slice(1)}. No package price is confirmed for this format.
                                </p>
                                <p className="font-body text-[#34221D]/80 text-sm mt-3">
                                  {PRIVATE_EVENT_CUSTOM_SCOPE_NOTE} {PRIVATE_EVENT_CUSTOM_NOTE}
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="font-display text-[clamp(1.875rem,3vw,2.5rem)] leading-tight font-medium text-[#34221D] [text-wrap:pretty] mb-1">
                                  {privateEventBandLabel(packageType)}
                                </div>
                                <p className="font-body text-[#34221D]/80 text-sm mb-6">
                                  Indicative package range (CAD). Not a final quote.
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

                                <p className="mt-4 font-body text-[#34221D]/80 text-sm leading-relaxed">{PRIVATE_EVENT_CUSTOM_NOTE}</p>
                              </>
                            )}
                            <p className="font-body text-sm text-[#34221D]/80 mt-4 border-t border-[#AA365D]/20 pt-4" aria-live="polite">
                              {PRIVATE_EVENT_EXPERIENCES[eventPreferences.experience].name} · {PRIVATE_EVENT_SCHEDULES[eventPreferences.schedule]} · {PRIVATE_EVENT_VENUES[eventPreferences.venue]} · {guestCount} attendees
                            </p>
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
                            maxLength={5000}
                            onChange={e => setNotes(e.target.value)}
                            className="h-12 md:h-12 w-full min-w-0 bg-[#FEFAF4] text-base md:text-base text-[#34221D] border-[#AA365D]/70 focus:border-[#AA365D] focus-visible:border-[#AA365D] focus-visible:ring-[#AA365D]/20 rounded-xl placeholder:text-[#34221D]/60 min-h-[128px] resize-none"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={
                          !quoteReady ||
                          !preferencesReady ||
                          !normalizeCanadianPhoneNumber(phone) ||
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
        </div>
      </main>


      <Footer />
    </div>
  );
}
