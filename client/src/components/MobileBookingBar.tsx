import { BOOK_URL } from "@/const";
/* ============================================================
   MobileBookingBar — Sticky bottom bar visible only on mobile
   Design: Warm Afro-Wellness Editorial
   - Fixed to bottom of viewport on mobile only (hidden md+)
   - Slides up after user scrolls past the hero section
   - Two actions: Book a Class (primary) + Private Events (secondary)
   - Respects safe-area-inset-bottom for notched phones
   ============================================================ */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Users } from "lucide-react";


export default function MobileBookingBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past ~80% of the viewport height (past the hero)
      setVisible(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // check on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Frosted glass backing */}
          <div className="bg-[#FFF5F8]/95 backdrop-blur-md border-t border-[#F0D0DC] shadow-[0_-4px_24px_rgba(139,34,82,0.12)]">
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Primary CTA */}
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#8B2252] text-white font-body font-bold text-sm rounded-xl shadow-md active:scale-95 transition-transform duration-150"
              >
                <CalendarDays size={16} />
                Book a Class
              </a>

              {/* Secondary CTA */}
              <a
                href="#private-events"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .querySelector("#private-events")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center justify-center gap-2 px-4 py-3.5 bg-[#F2A0B8]/20 border border-[#F2A0B8] text-[#8B2252] font-body font-semibold text-sm rounded-xl active:scale-95 transition-transform duration-150"
              >
                <Users size={16} />
                Private
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
