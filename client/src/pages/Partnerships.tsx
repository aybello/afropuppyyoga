/* ============================================================
   Partnerships Page — AfroPuppyYoga
   5 partnership categories + real partners + inquiry form
   ============================================================ */
import { useState } from "react";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { Building2, Sparkles, Tv, Store, Heart, CheckCircle, ArrowRight, ExternalLink } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";

const PARTNERSHIP_TYPES = [
  "Corporate Wellness",
  "Brand Collaboration",
  "Media & Production",
  "Local Business",
  "Breeder Partnership",
] as const;

type PartnershipType = (typeof PARTNERSHIP_TYPES)[number];

const CATEGORIES = [
  {
    type: "Corporate Wellness" as PartnershipType,
    icon: Building2,
    title: "Corporate Wellness",
    tagline: "Bring puppies to your team",
    description:
      "Book recurring private sessions for your employees. Puppy yoga is one of the most effective and memorable team wellness experiences available. We work with companies of all sizes across the GTA.",
    benefits: [
      "Private sessions for 10–100+ employees",
      "Flexible scheduling around your team's calendar",
      "Custom wellness packages with monthly retainer options",
      "Certificate of participation for HR wellness programs",
    ],
  },
  {
    type: "Brand Collaboration" as PartnershipType,
    icon: Sparkles,
    title: "Brand Collaboration",
    tagline: "Align with Ontario's #1 puppy yoga brand",
    description:
      "Partner with AfroPuppyYoga to reach a highly engaged wellness audience. We work with brands in pet care, apparel, food and beverage, wellness products, and lifestyle. Our audience is 80% women aged 22–40.",
    benefits: [
      "Product placement at classes (KW + Hamilton)",
      "Co-branded social content (854K+ monthly Instagram views)",
      "Sponsored giveaways and featured posts",
      "Exclusive member discount codes for your audience",
    ],
  },
  {
    type: "Media & Production" as PartnershipType,
    icon: Tv,
    title: "Media & Production",
    tagline: "Film with us",
    description:
      "AfroPuppyYoga is a visually stunning, emotionally engaging setting for TV, film, YouTube, and editorial content. We are open to collaborations with production companies, reality shows, lifestyle media, and content creators.",
    benefits: [
      "Location access for filming at KW and Hamilton studios",
      "Puppy and instructor coordination for productions",
      "Paid collaboration agreements for featured content",
      "Press and editorial partnerships",
    ],
  },
  {
    type: "Local Business" as PartnershipType,
    icon: Store,
    title: "Local Business",
    tagline: "Cross-promote with aligned local brands",
    description:
      "We love supporting and growing alongside other local businesses. If your brand serves a similar wellness-minded audience, let's create something together. Think cafes, spas, florists, photographers, and fitness studios.",
    benefits: [
      "Reciprocal member discount programs",
      "Co-hosted events and pop-ups",
      "Cross-promotion on social media",
      "Featured partner listing on our website",
    ],
  },
  {
    type: "Breeder Partnership" as PartnershipType,
    icon: Heart,
    title: "Breeder Partnership",
    tagline: "Become an official APY breeder partner",
    description:
      "We partner with ethical, responsible breeders who share our commitment to puppy welfare. Our classes run every Saturday across two locations and we are always looking for healthy, well-socialized puppies.",
    benefits: [
      "Regular, recurring booking schedule",
      "Featured breeder profile on our website",
      "Featured placement across our social media and marketing channels",
      "Strict welfare standards and puppy care protocols",
    ],
  },
];

const inquiryInputClassName = "w-full min-h-12 rounded-xl border border-input bg-background px-4 py-3 font-body text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors motion-reduce:transition-none";
const inquiryLabelClassName = "mb-2 block font-body text-sm font-semibold text-foreground";

type FormState = {
  partnershipType: PartnershipType | "";
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  proposal: string;
};

export default function Partnerships() {
  useSeoMeta({
    title: "Partner With AfroPuppyYoga | Corporate Wellness, Brand Collaborations & More",
    description: "Partner with Ontario's #1 puppy yoga studio. We offer corporate wellness sessions, brand collaborations, media partnerships, and local business cross-promotions across Ontario.",
    canonical: "https://afropuppyyoga.ca/partnerships",
  });
  const [form, setForm] = useState<FormState>({
    partnershipType: "",
    organizationName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    proposal: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<PartnershipType | null>(null);

  const submitMutation = trpc.partnership.submitInquiry.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setError("");
    },
    onError: (err) => {
      setError(err.message || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partnershipType) {
      setError("Please select a partnership type.");
      return;
    }
    trackCTAClick(`Partnership Inquiry Submit — ${form.partnershipType}`);
    submitMutation.mutate({
      partnershipType: form.partnershipType as PartnershipType,
      organizationName: form.organizationName,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone || undefined,
      website: form.website || undefined,
      proposal: form.proposal,
    });
  };

  const handleCategoryClick = (type: PartnershipType) => {
    setActiveCategory(type);
    setForm((prev) => ({ ...prev, partnershipType: type }));
    setTimeout(() => {
      const inquiryPanel = document.getElementById("partnership-form");
      if (!inquiryPanel) return;
      window.scrollTo({
        top: Math.max(0, inquiryPanel.getBoundingClientRect().top + window.scrollY - 112),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    }, 100);
  };

  return (
    <div className="apy-page">
      <Navbar />
      <main>
        {/* Light editorial hero, using an existing authentic APY photograph. */}
        <section aria-labelledby="partnerships-heading" className="border-b border-border px-4 pb-10 pt-28 sm:px-6 sm:pb-14 sm:pt-32 lg:px-8 lg:pb-16">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div className="min-w-0">
              <p className="apy-eyebrow mb-5">Partnerships</p>
              <h1 id="partnerships-heading" className="font-display text-[clamp(2.5rem,5.5vw,5rem)] font-normal leading-[1.08] tracking-[-0.035em] text-foreground">
                Grow With<br />
                <span className="block break-words italic text-[var(--brand-link)]">AfroPuppyYoga</span>
              </h1>
              <p className="mt-6 max-w-xl font-body text-base leading-relaxed text-muted-foreground sm:text-lg">
                We partner with brands, businesses, and creators who share our values of wellness, joy, and community. If you see an opportunity to build something meaningful together, we want to hear from you.
              </p>
              <a
                href="#partnership-form"
                onClick={() => trackCTAClick("Partner With Us CTA — Hero")}
                className="apy-primary-action mt-8 w-full sm:w-auto"
              >
                Partner With Us
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
            <div className="min-w-0 overflow-hidden rounded-[42%_42%_1.5rem_1.5rem] border border-border bg-secondary sm:rounded-[42%_42%_2rem_2rem]">
              <img
                src="/manus-storage/apy_corporate_hero_202ea280.jpg"
                alt="AfroPuppyYoga guests gathered together with puppies after a group session"
                width={2133}
                height={1600}
                fetchPriority="high"
                decoding="async"
                className="block h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* Preserve every genuine existing partner detail and the original logo. */}
        <section aria-labelledby="current-partners-heading" className="border-b border-border bg-secondary/40 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 id="current-partners-heading" className="mb-6 font-body text-sm font-semibold text-foreground">Current Partners</h2>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[1fr_1.15fr_0.8fr] xl:gap-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Heart size={22} className="text-[var(--brand-link)]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-xl font-medium text-foreground">Club Pilates Guelph</p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">Local Business Partner</p>
                  <p className="mt-2 flex items-start gap-2 font-body text-sm font-medium text-foreground">
                    <CheckCircle size={16} className="mt-0.5 shrink-0 text-[var(--brand-link)]" aria-hidden="true" />
                    <span>15% off for Club Pilates members</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white p-1">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/fluffy_glaze_logo_34eaac35.png"
                    alt="Fluffy Glaze"
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-xl font-medium text-foreground">Fluffy Glaze</p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">Local Business Partner</p>
                  <p className="mt-2 flex items-start gap-2 font-body text-sm font-medium text-foreground">
                    <CheckCircle size={16} className="mt-0.5 shrink-0 text-[var(--brand-link)]" aria-hidden="true" />
                    <span>Artisan donuts served at select APY events</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 border-t border-border pt-5 md:col-span-2 xl:col-span-1 xl:border-t-0 xl:pt-0">
                <div>
                  <p className="font-display text-xl font-medium text-foreground">Your brand here</p>
                  <p className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">Join our growing network of wellness partners</p>
                </div>
                <ArrowRight size={20} className="mt-1 shrink-0 text-[var(--brand-link)]" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:px-8 xl:gap-16">
          {/* Editorial rows retain all category descriptions and benefits, without disclosure hiding. */}
          <section aria-labelledby="partnership-categories-heading" className="min-w-0">
            <div className="mb-8">
              <h2 id="partnership-categories-heading" className="font-display text-[clamp(2rem,3.5vw,3rem)] font-normal tracking-[-0.025em] text-foreground">Ways to Partner</h2>
              <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-muted-foreground">
                Select the partnership type that fits your goals. Click any category to pre-fill the inquiry form below.
              </p>
            </div>
            <div className="border-t border-border">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.type;
                return (
                  <article key={cat.type} className={`border-b border-border py-6 sm:py-8 ${isActive ? "bg-secondary/50" : ""}`}>
                    <h3>
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(cat.type)}
                        aria-pressed={isActive}
                        className="group flex min-h-12 w-full items-start gap-4 rounded-xl text-left transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4 motion-reduce:transition-none sm:gap-5"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center text-[var(--brand-link)]">
                          <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-2xl font-normal leading-snug tracking-[-0.02em] text-foreground sm:text-[1.75rem]">{cat.title}</span>
                          <span className="mt-1 block font-body text-sm font-normal leading-relaxed text-muted-foreground">{cat.tagline}</span>
                          <span className="mt-2 block font-body text-sm font-semibold text-[var(--brand-link)]">{isActive ? "Selected" : "Apply for this partnership"}</span>
                        </span>
                        <span className="mt-2 shrink-0 text-[var(--brand-link)]">
                          {isActive ? <CheckCircle size={20} aria-hidden="true" /> : <ArrowRight size={20} aria-hidden="true" />}
                        </span>
                      </button>
                    </h3>
                    <div className="mt-4 sm:pl-[4.25rem]">
                      <p className="font-body text-base leading-relaxed text-muted-foreground">{cat.description}</p>
                      <ul className="mt-4 space-y-2">
                        {cat.benefits.map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2.5">
                            <CheckCircle size={15} className="mt-1 shrink-0 text-[var(--brand-link)]" aria-hidden="true" />
                            <span className="font-body text-sm leading-relaxed text-foreground">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Same inquiry fields, order, validation, mutation, and states in a compact panel. */}
          <section id="partnership-form" aria-labelledby="partnership-inquiry-heading" className="min-w-0 scroll-mt-28 rounded-2xl border border-border bg-secondary/60 p-5 sm:p-8">
            <div className="mb-7">
              <h2 id="partnership-inquiry-heading" className="font-display text-[clamp(1.875rem,3vw,2.5rem)] font-normal leading-tight tracking-[-0.025em] text-foreground">
                Submit a Partnership Inquiry
              </h2>
              <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
                Tell us about your organization and what you have in mind. We review every inquiry and respond within 3 business days.
              </p>
            </div>

            {submitted ? (
              <div role="status" aria-live="polite" className="rounded-xl border border-border bg-background px-5 py-12 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle size={32} className="text-green-700" aria-hidden="true" />
                </div>
                <h3 className="mb-3 font-display text-2xl font-medium text-foreground">Inquiry Received!</h3>
                <p className="mx-auto max-w-sm font-body text-base leading-relaxed text-muted-foreground">
                  Thank you for reaching out. Our team will review your proposal and get back to you within 3 business days.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} aria-busy={submitMutation.isPending} className="space-y-5">
                {/* Partnership Type */}
                <fieldset>
                  <legend className={inquiryLabelClassName}>
                    Partnership Type <span className="text-[var(--brand-link)]">*</span>
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                    {PARTNERSHIP_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, partnershipType: type }))}
                        aria-pressed={form.partnershipType === type}
                        className={`min-h-12 rounded-xl border px-3 py-2.5 text-left font-body text-sm font-medium leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 motion-reduce:transition-none ${
                          form.partnershipType === type
                            ? "border-ring bg-primary text-primary-foreground"
                            : "border-input bg-background text-foreground hover:border-ring hover:bg-secondary"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Organization + Contact Name */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="partnership-organization" className={inquiryLabelClassName}>
                      Organization / Brand Name <span className="text-[var(--brand-link)]">*</span>
                    </label>
                    <input
                      id="partnership-organization"
                      type="text"
                      required
                      value={form.organizationName}
                      onChange={(e) => setForm((prev) => ({ ...prev, organizationName: e.target.value }))}
                      placeholder="e.g. Lululemon Canada"
                      className={inquiryInputClassName}
                    />
                  </div>
                  <div>
                    <label htmlFor="partnership-contact" className={inquiryLabelClassName}>
                      Your Name <span className="text-[var(--brand-link)]">*</span>
                    </label>
                    <input
                      id="partnership-contact"
                      type="text"
                      required
                      value={form.contactName}
                      onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
                      placeholder="Full name"
                      className={inquiryInputClassName}
                    />
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="partnership-email" className={inquiryLabelClassName}>
                      Email <span className="text-[var(--brand-link)]">*</span>
                    </label>
                    <input
                      id="partnership-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="you@company.com"
                      className={inquiryInputClassName}
                    />
                  </div>
                  <div>
                    <label htmlFor="partnership-phone" className={inquiryLabelClassName}>
                      Phone <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      id="partnership-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="519-000-0000"
                      className={inquiryInputClassName}
                    />
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label htmlFor="partnership-website" className={inquiryLabelClassName}>
                    Website or Social Media <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <div className="relative">
                    <ExternalLink size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      id="partnership-website"
                      type="url"
                      value={form.website}
                      onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                      placeholder="https://yourwebsite.com"
                      className={`${inquiryInputClassName} pl-10`}
                    />
                  </div>
                </div>

                {/* Proposal */}
                <div>
                  <label htmlFor="partnership-proposal" className={inquiryLabelClassName}>
                    Tell Us About Your Proposal <span className="text-[var(--brand-link)]">*</span>
                  </label>
                  <textarea
                    id="partnership-proposal"
                    aria-describedby="partnership-proposal-count"
                    required
                    rows={5}
                    minLength={20}
                    value={form.proposal}
                    onChange={(e) => setForm((prev) => ({ ...prev, proposal: e.target.value }))}
                    placeholder="Describe your organization, what kind of partnership you're proposing, and what you hope to achieve together..."
                    className={`${inquiryInputClassName} resize-y`}
                  />
                  <p id="partnership-proposal-count" className="mt-1 font-body text-sm text-muted-foreground">{form.proposal.length}/2000 characters</p>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-body text-sm text-red-700">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="apy-primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Partnership Inquiry"}
                </button>

                <p className="text-center font-body text-sm leading-relaxed text-muted-foreground">
                  We respond to all inquiries within 3 business days. For urgent matters, email us at{" "}
                  <a href="mailto:afropuppyyoga@gmail.com" className="apy-link break-words underline">
                    afropuppyyoga@gmail.com
                  </a>
                </p>
              </form>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
