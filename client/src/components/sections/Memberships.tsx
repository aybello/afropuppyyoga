import { BOOK_URL } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const passes = [
  {
    name: "Puppy Pass",
    price: "$40",
    period: "/month",
    bestFor: "Casual monthly self-care",
    tagline: "One class a month, zero excuses. Great for beginners and anyone building a wellness habit.",
    badge: null,
    accentColor: "#e91e8c",
    bgColor: "#fff5fa",
    borderColor: "#f9a8d4",
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
    accentColor: "#8B2252",
    bgColor: "#fff5f8",
    borderColor: "#f9a8d4",
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
    <section id="memberships" className="py-10 md:py-16 px-4" style={{ background: "linear-gradient(135deg, #fdf2f8 0%, #fff7ed 50%, #fdf2f8 100%)" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-4 py-1.5 rounded-full"
            style={{ background: "#fce7f3", color: "#be185d" }}
          >
            Membership Passes
          </span>
          <h2
            className="text-4xl md:text-5xl font-black mb-4 leading-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
          >
            Save More. Show Up More.
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "#7c3f5e" }}>
            Members get guaranteed class credits, exclusive perks, and priority access every month — across all APY locations.
          </p>
          <p className="text-sm mt-2" style={{ color: "#9d6b7a" }}>
            ✅ Valid at Kitchener, Hamilton & Oakville
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
                border: `2px solid ${pass.borderColor}`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
              }}
            >
              {/* Badge */}
              {pass.badge && (
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold tracking-widest uppercase px-5 py-1.5 rounded-full"
                  style={{ background: pass.accentColor }}
                >
                  {pass.badge}
                </div>
              )}

              {/* Best For pill */}
              <div className="mb-3">
                <span
                  className="inline-block text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "#fce7f3", color: "#be185d" }}
                >
                  Best for: {pass.bestFor}
                </span>
              </div>

              {/* Name & Price */}
              <div className="mb-6">
                <h3
                  className="text-2xl font-black mb-1"
                  style={{ fontFamily: "'Playfair Display', serif", color: "#1a0a0f" }}
                >
                  {pass.name}
                </h3>
                <p className="text-sm mb-4" style={{ color: "#7c3f5e" }}>
                  {pass.tagline}
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className="text-5xl font-black"
                    style={{ color: pass.accentColor, fontFamily: "'Playfair Display', serif" }}
                  >
                    {pass.price}
                  </span>
                  <span className="text-lg pb-2" style={{ color: "#9d6b7a" }}>
                    {pass.period}
                  </span>
                </div>
                <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>
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
                    <span className="font-semibold text-sm" style={{ color: "#1a0a0f" }}>
                      {perk.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Rollover footnote */}
              <p className="text-xs mb-6 italic" style={{ color: "#9d6b7a" }}>
                ⚠️ {pass.footnote}
              </p>

              {/* CTA */}
              <a href={pass.lumaLink} target="_blank" rel="noopener noreferrer">
                <Button
                  className="w-full py-6 text-base font-bold rounded-2xl text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #e91e8c, #8B2252)", border: "none", boxShadow: "0 2px 8px rgba(233,30,140,0.3)" }}
                >
                  Join {pass.name} →
                </Button>
              </a>
            </div>
          ))}
        </div>

        {/* Cross-city note + bottom info */}
        <div className="mt-10 rounded-2xl p-6 text-center" style={{ background: "#fce7f3" }}>
          <p className="font-semibold mb-1" style={{ color: "#8B2252" }}>
            🗺️ Use your membership at any APY location
          </p>
          <p className="text-sm" style={{ color: "#7c3f5e" }}>
            Your Puppy Pass or Wellness Pack is valid at Kitchener, Hamilton, and Oakville. One membership, three cities.
          </p>
        </div>
        <p className="text-center text-sm mt-4" style={{ color: "#9d6b7a" }}>
          3-month minimum commitment. Cancel anytime after that. Memberships are managed through Luma.{" "}
          <Link href="/loyalty" className="underline hover:text-pink-700">
            See our loyalty program →
          </Link>
        </p>
      </div>
    </section>
  );
}
