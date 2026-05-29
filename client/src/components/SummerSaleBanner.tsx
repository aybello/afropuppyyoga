/* ============================================================
   Summer Sale Banner — Sticky top bar announcing the sale
   ============================================================ */
import { useState } from "react";
import { X } from "lucide-react";
import { BOOK_URL } from "@/const";

export default function SummerSaleBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="relative z-50 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-semibold"
      style={{
        background: "linear-gradient(90deg, #be185d 0%, #e91e8c 50%, #f97316 100%)",
        color: "#fff",
      }}
    >
      {/* Sunburst emoji + text */}
      <span className="text-base">☀️</span>
      <span className="tracking-wide">
        <span className="font-black uppercase tracking-widest mr-1">SUMMER SALE</span>
        — Classes from{" "}
        <span className="line-through opacity-70 mr-1">$56</span>
        <span className="font-black text-yellow-200">$50</span>
        {" "}· Groups save up to $18
      </span>
      <a
        href={BOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
        style={{ background: "rgba(255,255,255,0.25)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)" }}
      >
        Book Now →
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss banner"
      >
        <X size={16} />
      </button>
    </div>
  );
}
