import { BOOK_URL } from "@/const";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_LOCATION_COPY, PUBLIC_LOCATION_LIST } from "@shared/publicLocations";

const passes = [
  {
    name: "Puppy Pass",
    price: "$40",
    period: "/month",
    bestFor: "Casual monthly self-care",
    tagline: "One class a month, zero excuses. Great for beginners and anyone building a wellness habit.",
    badge: null,
    accentColor: "#B83F67",
    bgColor: "#FEFAF4",
    borderColor: "#EBCDD5",
    lumaLink: BOOK_URL,
    savings: "Save up to $10/class vs. drop-in",
    perks: [
      { icon: "🎟", text: "1 free class per month", note: null },
      { icon: "💸", text: "20% off any additional classes", note: null },
      { icon: "🎂", text: "Free class during your birthday month", note: null },
      { icon: "🐾", text: "Early access to select breed drops", note: null },
      { icon: "📨", text: "Members-only updates & early news", note: null },
    ],
    footnote: "Classes do not roll over. Use yours every month.",
  },
  {
    name: "Wellness Pack",
    price: "$60",
    period: "/month",
    bestFor: "Regular attendees who want more",
    tagline: "Two classes a month, priority booking, and perks that reward consistency.",
    badge: "Most Popular",
    accentColor: "#B83F67",
    bgColor: "#FEFAF4",
    borderColor: "#EBCDD5",
    lumaLink: BOOK_URL,
    savings: "Save up to $20/month vs. drop-in",
    perks: [
      { icon: "🎟", text: "2 free classes per month", note: null },
      { icon: "💸", text: "20% off any additional classes", note: null },
      { icon: "⚡", text: "Priority booking — grab spots before they sell out", note: null },
      { icon: "🎂", text: "Free class during your birthday month", note: null },
      { icon: "🐾", text: "Members-only class opportunities", note: null },
      { icon: "📨", text: "Members-only updates & early news", note: null },
    ],
    footnote: "Classes do not roll over. Use both every month.",
  },
];

export default function Memberships() {
  return (
    <section id="memberships" className="py-10 md:py-16 px-4" style={{ background: "#FDE9EF" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-4 py-1.5 rounded-full"
            style={{ background: "#FDE9EF", color: "#B83F67" }}
          >
            Membership Passes
          </span>
          <h2
            className="text-4xl md:text-5xl font-semibold mb-4 leading-tight"
            style={{ fontFamily: "'Fraunces', serif", color: "#34221D" }}
          >
            Save More. Show Up More.
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "#B83F67" }}>
            Members get guaranteed class credits, exclusive perks, and priority access every month — across all APY locations.
          </p>
          <p className="text-sm mt-2" style={{ color: "#34221D" }}>
            ✅ Valid in {PUBLIC_LOCATION_LIST}
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {passes.map((pass) => (
            <div
              key={pass.name}
              className="relative rounded-3xl p-5 sm:p-8 flex flex-col"
              style={{
                background: pass.bgColor,
                border: `1px solid ${pass.borderColor}`,
                boxShadow: "0 4px 16px rgba(52,34,29,0.04)",
              }}
            >
              {/* Badge */}
              {pass.badge && (
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 text-[#34221D] text-xs font-bold tracking-widest uppercase px-5 py-1.5 rounded-full"
                  style={{ background: "#F29CB8" }}
                >
                  {pass.badge}
                </div>
              )}

              {/* Best For pill */}
              <div className="mb-3">
                <span
                  className="inline-block text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "#FDE9EF", color: "#B83F67" }}
                >
                  Best for: {pass.bestFor}
                </span>
              </div>

              {/* Name & Price */}
              <div className="mb-6">
                <h3
                  className="text-2xl font-semibold mb-1"
                  style={{ fontFamily: "'Fraunces', serif", color: "#34221D" }}
                >
                  {pass.name}
                </h3>
                <p className="text-sm mb-4" style={{ color: "#B83F67" }}>
                  {pass.tagline}
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className="text-5xl font-semibold"
                    style={{ color: pass.accentColor, fontFamily: "'Fraunces', serif" }}
                  >
                    {pass.price}
                  </span>
                  <span className="text-lg pb-2" style={{ color: "#34221D" }}>
                    {pass.period}
                  </span>
                </div>
                <p className="text-xs font-semibold" style={{ color: "#287344" }}>
                  💰 {pass.savings}
                </p>
              </div>

              {/* Divider */}
              <div className="w-full h-px mb-6" style={{ background: pass.borderColor }} />

              {/* Perks */}
              <ul className="flex flex-col gap-3 mb-6 flex-1">
                {pass.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-xl mt-0.5 shrink-0">{perk.icon}</span>
                    <span className="font-semibold text-sm" style={{ color: "#34221D" }}>
                      {perk.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Rollover footnote */}
              <p className="text-xs mb-6 italic" style={{ color: "#34221D" }}>
                ⚠️ {pass.footnote}
              </p>

              {/* CTA */}
              <a href={pass.lumaLink} target="_blank" rel="noopener noreferrer">
                <Button
                  className="w-full py-6 text-base font-semibold rounded-full text-[#34221D] hover:opacity-90 transition-colors"
                  style={{ background: "#F29CB8", color: "#34221D", border: "none", boxShadow: "none" }}
                >
                  Join {pass.name} →
                </Button>
              </a>
            </div>
          ))}
        </div>

        {/* Cross-city note + bottom info */}
        <div className="mt-10 rounded-2xl p-6 text-center" style={{ background: "#FDE9EF" }}>
          <p className="font-semibold mb-1" style={{ color: "#B83F67" }}>
            🗺️ Use your membership at any APY location
          </p>
          <p className="text-sm" style={{ color: "#B83F67" }}>
            {MEMBERSHIP_LOCATION_COPY}
          </p>
        </div>
        <p className="text-center text-sm mt-4" style={{ color: "#34221D" }}>
          3-month minimum commitment. Cancel anytime after that. Memberships are managed through Luma.{" "}
          <a href="/loyalty" className="text-[#B83F67] underline underline-offset-4 hover:text-[#34221D]">
            See our loyalty program →
          </a>
        </p>
      </div>
    </section>
  );
}
