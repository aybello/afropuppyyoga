/* ============================================================
   BirthdayBanner — Homepage CTA for Birthday Packages
   ============================================================ */
import { Cake, Users, Star } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";

export default function BirthdayBanner() {
  return (
    <section className="py-16 px-4 bg-gradient-to-br from-[#1A0A12] via-[#3D1A2E] to-[#1A0A12]">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left: Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F2A0B8]/20 rounded-full mb-5">
              <Cake size={14} className="text-[#F2A0B8]" />
              <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#F2A0B8]">
                Birthday Packages
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Celebrate Your Birthday
              <br />
              <span className="italic text-[#F2A0B8]">With Puppies</span>
            </h2>
            <p className="font-body text-white/65 text-base leading-relaxed mb-8">
              Make your birthday unforgettable. Bring your crew, cuddle some puppies, and create memories that last a lifetime. Three packages available — from reserved sections to full private sessions.
            </p>
            <a
              href="/birthday"
              onClick={() => trackCTAClick("Explore Birthday Packages — Homepage Banner")}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#F2A0B8] text-[#1A0A12] font-body font-bold text-base rounded-full hover:bg-[#F2A0B8] transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              <Cake size={18} />
              Explore Birthday Packages
            </a>
          </div>

          {/* Right: Package cards */}
          <div className="space-y-3">
            {[
              { name: "Basic", price: "$600", desc: "Reserved section for up to 8 guests", color: "#F2A0B8" },
              { name: "Premium", price: "$900", desc: "Reserved section + custom playlist + 1 free ticket", color: "#8B2252", badge: "Most Popular" },
              { name: "Deluxe", price: "$1,200", desc: "Full private session for up to 20 guests", color: "#8B2252" },
            ].map((pkg) => (
              <a
                key={pkg.name}
                href="/birthday"
                onClick={() => trackCTAClick(`Birthday Package ${pkg.name} — Homepage Banner`)}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#F2A0B8]/40 hover:bg-white/8 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: pkg.color + "30" }}>
                    <Star size={16} style={{ color: pkg.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-white text-sm">{pkg.name}</span>
                      {pkg.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-body font-bold rounded-full" style={{ backgroundColor: pkg.color + "30", color: pkg.color }}>
                          {pkg.badge}
                        </span>
                      )}
                    </div>
                    <p className="font-body text-white/50 text-xs">{pkg.desc}</p>
                  </div>
                </div>
                <span className="font-display font-bold text-lg shrink-0 ml-3" style={{ color: pkg.color }}>
                  {pkg.price}
                </span>
              </a>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Users size={14} className="text-white/40" />
              <p className="font-body text-white/40 text-xs">Minimum 6 guests. Classes run every Saturday at KW and Hamilton.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
