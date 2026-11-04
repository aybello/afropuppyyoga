/* ============================================================
   BirthdayBanner — Homepage CTA for Birthday Packages
   ============================================================ */
import { Cake, Users, Star } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";

export default function BirthdayBanner() {
  return (
    <section className="py-16 px-4 bg-[#FDE9EF]">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left: Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F29CB8]/20 rounded-full mb-5">
              <Cake size={14} className="text-[#B83F67]" />
              <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#B83F67]">
                Birthday Packages
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium text-[#34221D] mb-4 leading-tight">
              Celebrate Your Birthday
              <br />
              <span className="italic text-[#B83F67]">With Puppies</span>
            </h2>
            <p className="font-body text-[#34221D]/65 text-base leading-relaxed mb-8">
              Make your birthday unforgettable. Bring your crew, cuddle some puppies, and create memories that last a lifetime. Three packages available — from reserved sections to full private sessions.
            </p>
            <a
              href="/private-events/quote"
              onClick={() => trackCTAClick("Explore Birthday Packages — Homepage Banner")}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#F29CB8] text-[#34221D] font-body font-bold text-base rounded-full hover:bg-[#FDE9EF] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Cake size={18} />
              Book a Birthday Event
            </a>
          </div>

          {/* Right: Package cards */}
          <div className="space-y-3">
            {[
              { name: "Basic", price: "$600", desc: "Reserved section for up to 8 guests", color: "#F29CB8" },
              { name: "Premium", price: "$900", desc: "Reserved section + custom playlist + 1 free ticket", color: "#B83F67", badge: "Most Popular" },
              { name: "Deluxe", price: "$1,200", desc: "Full private session for up to 20 guests", color: "#B83F67" },
            ].map((pkg) => (
              <a
                key={pkg.name}
                href="/private-events/quote"
                onClick={() => trackCTAClick(`Birthday Package ${pkg.name} — Homepage Banner`)}
                className="flex items-center justify-between p-4 rounded-xl bg-[#FEFAF4] border border-[#EBCDD5] hover:border-[#F29CB8]/40 hover:bg-[#FEFAF4] transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: pkg.color + "30" }}>
                    <Star size={16} style={{ color: pkg.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-medium text-[#34221D] text-sm">{pkg.name}</span>
                      {pkg.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-body font-bold rounded-full" style={{ backgroundColor: pkg.color + "30", color: pkg.color }}>
                          {pkg.badge}
                        </span>
                      )}
                    </div>
                    <p className="font-body text-[#34221D]/65 text-xs">{pkg.desc}</p>
                  </div>
                </div>
                <span className="font-display font-medium text-lg shrink-0 ml-3" style={{ color: pkg.color }}>
                  {pkg.price}
                </span>
              </a>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Users size={14} className="text-[#34221D]/65" />
              <p className="font-body text-[#34221D]/65 text-xs">Minimum 6 guests. Classes run every Saturday at KW and Hamilton.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
