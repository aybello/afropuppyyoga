import { Button } from "@/components/ui/button";

const passes = [
  {
    name: "Puppy Pass",
    price: "$40",
    period: "/month",
    tagline: "Perfect for beginners and casual puppy lovers.",
    badge: null,
    accentColor: "#e91e8c",
    bgColor: "#fff5fa",
    borderColor: "#f9a8d4",
    lumaLink: "https://lu.ma/afropuppyyoga",
    perks: [
      { icon: "🎟", text: "1 free class per month" },
      { icon: "💸", text: "20% off any additional classes" },
      { icon: "🎂", text: "1 free class during your birthday month" },
      { icon: "📨", text: "Members-only updates & early news" },
    ],
  },
  {
    name: "Wellness Pack",
    price: "$60",
    period: "/month",
    tagline: "For regulars who want consistency and extra perks.",
    badge: "Most Popular",
    accentColor: "#8B2252",
    bgColor: "#fff5f8",
    borderColor: "#f9a8d4",
    lumaLink: "https://lu.ma/afropuppyyoga",
    perks: [
      { icon: "🎟", text: "2 free classes per month" },
      { icon: "💸", text: "20% off any additional classes" },
      { icon: "🎂", text: "1 free class during your birthday month" },
      { icon: "📨", text: "Members-only updates & early news" },
    ],
  },
];

export default function Memberships() {
  return (
    <section id="memberships" className="py-10 md:py-20 px-4" style={{ background: "linear-gradient(135deg, #fdf2f8 0%, #fff7ed 50%, #fdf2f8 100%)" }}>
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
            Join as a member and get guaranteed class credits, exclusive perks, and priority access — every single month.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
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
                <div className="flex items-end gap-1">
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
              </div>

              {/* Divider */}
              <div className="w-full h-px mb-6" style={{ background: pass.borderColor }} />

              {/* Perks */}
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {pass.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-xl mt-0.5 shrink-0">{perk.icon}</span>
                    <span>
                      <span className="font-semibold text-sm" style={{ color: "#1a0a0f" }}>
                        {perk.text}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a href={pass.lumaLink} target="_blank" rel="noopener noreferrer">
                <Button
                  className="w-full py-6 text-base font-bold rounded-2xl text-white transition-all"
                  style={{ background: pass.accentColor, border: "none" }}
                >
                  Join {pass.name} →
                </Button>
              </a>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm mt-8" style={{ color: "#9d6b7a" }}>
          3-month minimum commitment. Cancel anytime after that. Memberships are managed through Luma.
        </p>
      </div>
    </section>
  );
}
