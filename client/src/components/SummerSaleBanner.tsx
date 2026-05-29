/* ============================================================
   Summer Sale Banner — renders inline inside the fixed Navbar header
   No positioning needed — it stacks above the nav naturally
   ============================================================ */
import { useState } from "react";
import { X } from "lucide-react";
import { BOOK_URL } from "@/const";

export default function SummerSaleBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="relative w-full flex items-center justify-center gap-2 px-8 py-2 text-center text-xs sm:text-sm font-semibold"
      style={{
        background: "linear-gradient(90deg, #be185d 0%, #e91e8c 50%, #f97316 100%)",
        color: "#fff",
      }}
    >
      <span>☀️</span>
      <span>
        <span className="font-black uppercase tracking-widest">SUMMER SALE</span>
        {" — Classes from "}
        <span className="line-through opacity-70">$56</span>
        {" "}
        <span className="font-black text-yellow-200">$50</span>
        <span className="hidden sm:inline"> · Groups save up to $18</span>
      </span>
      <a
        href={BOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold ml-1"
        style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)" }}
      >
        Book Now →
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
