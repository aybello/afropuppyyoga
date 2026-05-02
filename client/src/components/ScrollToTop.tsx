/* ============================================================
   ScrollToTop — Floating button to scroll back to top
   Pure CSS transitions — no framer-motion dependency
   ============================================================ */
import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-20 md:bottom-8 md:right-24 z-50 w-11 h-11 md:w-12 md:h-12 bg-[#8B2252] text-white rounded-full shadow-lg hover:bg-[#6B1A3F] hover:-translate-y-1 flex items-center justify-center"
      aria-label="Scroll to top"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.8)",
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}
    >
      <ArrowUp size={20} />
    </button>
  );
}
