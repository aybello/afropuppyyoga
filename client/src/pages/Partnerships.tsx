/* ============================================================
   Partnerships Page — AfroPuppyYoga
   5 partnership categories + Club Pilates Guelph feature + inquiry form
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
    accent: "#8B2252",
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
    accent: "#C4556A",
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
    accent: "#F2A0B8",
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
    accent: "#F2A0B8",
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
    accent: "#8B2252",
  },
];

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
      document.getElementById("partnership-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 bg-gradient-to-br from-[#1A0A12] via-[#2D0F1E] to-[#1A0A12] overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #F2A0B8 0%, transparent 50%), radial-gradient(circle at 70% 30%, #8B2252 0%, transparent 50%)" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F2A0B8]/20 rounded-full mb-6">
            <Sparkles size={14} className="text-[#F2A0B8]" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#F2A0B8]">
              Partnerships
            </span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Grow With<br />
            <span className="italic text-[#F2A0B8]">AfroPuppyYoga</span>
          </h1>
          <p className="font-body text-white/65 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            We partner with brands, businesses, and creators who share our values of wellness, joy, and community. If you see an opportunity to build something meaningful together, we want to hear from you.
          </p>
          <a
            href="#partnership-form"
            onClick={() => trackCTAClick("Partner With Us CTA — Hero")}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-base rounded-full hover:bg-[#F2A0B8] transition-all duration-200 shadow-xl hover:-translate-y-1"
          >
            Partner With Us
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* Current Partners */}
      <section className="py-14 px-4 bg-[#FFF5F8] border-b border-[#F0D0DC]">
        <div className="max-w-5xl mx-auto">
          <p className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252] text-center mb-8">
            Current Partners
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* Club Pilates Guelph */}
            <div className="flex items-center gap-5 bg-white rounded-2xl px-8 py-6 shadow-sm border border-[#F0D0DC] max-w-md w-full">
              <div className="w-14 h-14 rounded-full bg-[#8B2252]/10 flex items-center justify-center shrink-0">
                <Heart size={24} className="text-[#8B2252]" />
              </div>
              <div>
                <p className="font-display font-bold text-[#1A0A12] text-lg">Club Pilates Guelph</p>
                <p className="font-body text-[#5A3040] text-sm mt-0.5">Local Business Partner</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-[#8B2252]/10 rounded-full">
                  <CheckCircle size={12} className="text-[#8B2252]" />
                  <span className="font-body text-xs font-semibold text-[#8B2252]">15% off for Club Pilates members</span>
                </div>
              </div>
            </div>
            {/* Fluffy Glaze */}
            <div className="flex items-center gap-5 bg-white rounded-2xl px-8 py-6 shadow-sm border border-[#F0D0DC] max-w-md w-full">
              <div className="w-14 h-14 rounded-full bg-white border border-[#F0D0DC] flex items-center justify-center shrink-0 overflow-hidden p-1">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/fluffy_glaze_logo_34eaac35.png"
                  alt="Fluffy Glaze"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <p className="font-display font-bold text-[#1A0A12] text-lg">Fluffy Glaze</p>
                <p className="font-body text-[#5A3040] text-sm mt-0.5">Local Business Partner</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-[#8B2252]/10 rounded-full">
                  <CheckCircle size={12} className="text-[#8B2252]" />
                  <span className="font-body text-xs font-semibold text-[#8B2252]">Artisan donuts served at select APY events</span>
                </div>
              </div>
            </div>
            {/* Become a partner CTA */}
            <div className="flex items-center gap-4 text-center md:text-left">
              <div>
                <p className="font-display font-bold text-[#1A0A12] text-base">Your brand here</p>
                <p className="font-body text-[#5A3040] text-sm mt-1">Join our growing network of wellness partners</p>
              </div>
              <ArrowRight size={20} className="text-[#8B2252] hidden md:block shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Categories */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display text-4xl font-bold text-[#1A0A12] mb-4">
              Ways to Partner
            </h2>
            <p className="font-body text-[#5A3040] text-base max-w-xl mx-auto">
              Select the partnership type that fits your goals. Click any category to pre-fill the inquiry form below.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.type;
              return (
                <button
                  key={cat.type}
                  onClick={() => handleCategoryClick(cat.type)}
                  className={`text-left p-6 rounded-2xl border-2 transition-all duration-200 hover:-translate-y-1 ${
                    isActive
                      ? "border-[#8B2252] bg-[#8B2252]/5 shadow-lg"
                      : "border-[#F0D0DC] bg-white hover:border-[#8B2252]/40 hover:shadow-md"
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: cat.accent + "20" }}
                  >
                    <Icon size={22} style={{ color: cat.accent }} />
                  </div>
                  <h3 className="font-display font-bold text-[#1A0A12] text-lg mb-1">{cat.title}</h3>
                  <p className="font-body text-[#8B2252] text-xs font-semibold mb-3">{cat.tagline}</p>
                  <p className="font-body text-[#5A3040] text-sm leading-relaxed mb-4">{cat.description}</p>
                  <ul className="space-y-1.5">
                    {cat.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle size={13} className="text-[#8B2252] mt-0.5 shrink-0" />
                        <span className="font-body text-[#5A3040] text-xs">{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center gap-1.5 text-[#8B2252]">
                    <span className="font-body text-xs font-semibold">
                      {isActive ? "Selected" : "Apply for this partnership"}
                    </span>
                    {!isActive && <ArrowRight size={13} />}
                    {isActive && <CheckCircle size={13} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section id="partnership-form" className="py-20 px-4 bg-[#FFF5F8]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-4xl font-bold text-[#1A0A12] mb-3">
              Submit a Partnership Inquiry
            </h2>
            <p className="font-body text-[#5A3040] text-base">
              Tell us about your organization and what you have in mind. We review every inquiry and respond within 3 business days.
            </p>
          </div>

          {submitted ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#F0D0DC] shadow-sm">
              <div className="w-16 h-16 bg-[#8B2252]/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={32} className="text-[#8B2252]" />
              </div>
              <h3 className="font-display font-bold text-2xl text-[#1A0A12] mb-3">Inquiry Received!</h3>
              <p className="font-body text-[#5A3040] text-base max-w-sm mx-auto">
                Thank you for reaching out. Our team will review your proposal and get back to you within 3 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#F0D0DC] shadow-sm p-8 space-y-6">
              {/* Partnership Type */}
              <div>
                <label className="block font-body text-sm font-semibold text-[#1A0A12] mb-2">
                  Partnership Type <span className="text-[#8B2252]">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PARTNERSHIP_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, partnershipType: type }))}
                      className={`px-3 py-2 rounded-lg text-xs font-body font-semibold border-2 transition-all duration-150 text-left ${
                        form.partnershipType === type
                          ? "border-[#8B2252] bg-[#8B2252]/10 text-[#8B2252]"
                          : "border-[#F0D0DC] text-[#5A3040] hover:border-[#8B2252]/40"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Organization + Contact Name */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-body text-sm font-semibold text-[#1A0A12] mb-1.5">
                    Organization / Brand Name <span className="text-[#8B2252]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.organizationName}
                    onChange={(e) => setForm((prev) => ({ ...prev, organizationName: e.target.value }))}
                    placeholder="e.g. Lululemon Canada"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#F0D0DC] font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:border-[#8B2252] transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-semibold text-[#1A0A12] mb-1.5">
                    Your Name <span className="text-[#8B2252]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.contactName}
                    onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#F0D0DC] font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:border-[#8B2252] transition-colors"
                  />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-body text-sm font-semibold text-[#1A0A12] mb-1.5">
                    Email <span className="text-[#8B2252]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="you@company.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#F0D0DC] font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:border-[#8B2252] transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-semibold text-[#1A0A12] mb-1.5">
                    Phone <span className="text-[#5A3040]/50 font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="519-000-0000"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#F0D0DC] font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:border-[#8B2252] transition-colors"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block font-body text-sm font-semibold text-[#1A0A12] mb-1.5">
                  Website or Social Media <span className="text-[#5A3040]/50 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <ExternalLink size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A3040]/40" />
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                    placeholder="https://yourwebsite.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#F0D0DC] font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:border-[#8B2252] transition-colors"
                  />
                </div>
              </div>

              {/* Proposal */}
              <div>
                <label className="block font-body text-sm font-semibold text-[#1A0A12] mb-1.5">
                  Tell Us About Your Proposal <span className="text-[#8B2252]">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  minLength={20}
                  value={form.proposal}
                  onChange={(e) => setForm((prev) => ({ ...prev, proposal: e.target.value }))}
                  placeholder="Describe your organization, what kind of partnership you're proposing, and what you hope to achieve together..."
                  className="w-full px-4 py-2.5 rounded-lg border border-[#F0D0DC] font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:border-[#8B2252] transition-colors resize-none"
                />
                <p className="font-body text-xs text-[#5A3040]/60 mt-1">{form.proposal.length}/2000 characters</p>
              </div>

              {error && (
                <p className="font-body text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full py-4 bg-[#8B2252] text-white font-body font-bold text-base rounded-full hover:bg-[#6B1A3F] transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Partnership Inquiry"}
              </button>

              <p className="font-body text-xs text-center text-[#5A3040]/60">
                We respond to all inquiries within 3 business days. For urgent matters, email us at{" "}
                <a href="mailto:afropuppyyogaofficial@gmail.com" className="text-[#8B2252] underline">
                  afropuppyyogaofficial@gmail.com
                </a>
              </p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
