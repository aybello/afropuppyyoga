import { BOOK_URL, LOGO_URL  } from "@/const";
/* ============================================================
   Navbar — Warm Afro-Wellness Editorial
   Transparent on hero, solid ivory on scroll
   Primary links: Home, Experience, Memberships, Private Events, Gallery, Careers, Loyalty
   Secondary links (More ▾): Birthday, Partnerships
   ============================================================ */
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";


const primaryLinks = [
  { label: "Home", href: "#home" },
  { label: "Experience", href: "#experience" },
  { label: "Memberships", href: "#memberships" },
  { label: "Private Events", href: "#private-events" },
  { label: "Gallery", href: "#gallery" },
  { label: "Careers", href: "/careers", isPage: true },
];

// Loyalty is highlighted separately (pill style like Memberships)
const loyaltyLink = { label: "🐾 Rewards", href: "/loyalty", isPage: true };

const moreLinks = [
  { label: "🎂 Birthday Packages", href: "/birthday", isPage: true },
  { label: "🤝 Partnerships", href: "/partnerships", isPage: true },
  { label: "🐶 Private Event Quote", href: "/private-events/quote", isPage: true },
  { label: "🌿 Ethical Standards", href: "/ethics", isPage: true },
];

// All links for mobile menu
const allLinks = [...primaryLinks, loyaltyLink, ...moreLinks];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);

  const isSubPage = typeof window !== "undefined" && window.location.pathname !== "/";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close More dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setMenuOpen(false);
    setMoreOpen(false);
    if (href.startsWith("#")) {
      if (isSubPage) {
        window.location.href = "/" + href;
      } else {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const navTextClass = scrolled || isSubPage ? "text-[#1A0A12]" : "text-white/90";
  const navHoverClass = "hover:bg-[#8B2252]/10 hover:text-[#8B2252]";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled || isSubPage
            ? "bg-[#FFF5F8]/95 backdrop-blur-md shadow-sm border-b border-[#F0D0DC]"
            : "bg-transparent"
        }`}
      >
        <div className="container">
          <nav className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <a
              href={isSubPage ? "/" : "#home"}
              onClick={(e) => { if (!isSubPage) handleNavClick(e, "#home"); }}
              className="flex items-center gap-2.5 group shrink-0"
            >
              <img
                src={LOGO_URL}
                alt="AfroPuppyYoga"
                className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="flex flex-col leading-none">
                <span className={`font-display font-bold text-base md:text-lg tracking-tight transition-colors duration-300 ${scrolled || isSubPage ? "text-[#1A0A12]" : "text-white"}`}>
                  AfroPuppyYoga
                </span>
                <span className={`text-[10px] font-body tracking-widest uppercase transition-colors duration-300 ${scrolled || isSubPage ? "text-[#8B2252]" : "text-[#F2A0B8]"}`}>
                  Ontario's #1 Puppy Yoga
                </span>
              </div>
            </a>

            {/* Desktop Nav */}
            <ul className="hidden lg:flex items-center gap-0.5">
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  {link.label === "Memberships" ? (
                    <a
                      href={isSubPage ? "/#memberships" : link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="px-3 py-1.5 text-sm font-body font-bold rounded-full transition-all duration-200 text-white"
                      style={{ background: "linear-gradient(135deg, #e91e8c, #8B2252)", boxShadow: "0 2px 8px rgba(233,30,140,0.35)" }}
                    >
                      {link.label}
                    </a>
                  ) : (link as any).isPage ? (
                    <a
                      href={link.href}
                      onClick={() => { setMenuOpen(false); setMoreOpen(false); }}
                      className={`px-3 py-2 text-sm font-body font-medium rounded-md transition-all duration-200 ${navTextClass} ${navHoverClass}`}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <a
                      href={isSubPage ? `/${link.href}` : link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`px-3 py-2 text-sm font-body font-medium rounded-md transition-all duration-200 ${navTextClass} ${navHoverClass}`}
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}

              {/* Loyalty — same bright hot pink pill as Memberships */}
              <li>
                <a
                  href={loyaltyLink.href}
                  onClick={() => { setMenuOpen(false); setMoreOpen(false); }}
                  className="px-3 py-1.5 text-sm font-body font-bold rounded-full transition-all duration-200 text-white"
                  style={{ background: "linear-gradient(135deg, #e91e8c, #8B2252)", boxShadow: "0 2px 8px rgba(233,30,140,0.35)" }}
                >
                  {loyaltyLink.label}
                </a>
              </li>

              {/* More dropdown */}
              <li ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-body font-medium rounded-md transition-all duration-200 ${navTextClass} ${navHoverClass}`}
                >
                  More
                  <ChevronDown size={14} className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-[#FFF5F8] border border-[#F0D0DC] rounded-2xl shadow-xl overflow-hidden z-50">
                    {moreLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setMoreOpen(false)}
                        className="block px-4 py-3 text-sm font-body font-medium text-[#1A0A12] hover:bg-[#8B2252]/10 hover:text-[#8B2252] transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            </ul>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCTAClick("Book a Class — Navbar")}
                className="inline-flex items-center px-4 py-2 sm:px-5 sm:py-2.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-semibold text-xs sm:text-sm rounded-full hover:bg-[#D4708A] transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                Book a Class
              </a>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`lg:hidden p-2 rounded-md transition-colors ${scrolled || isSubPage ? "text-[#1A0A12]" : "text-white"}`}
                aria-label="Toggle menu"
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
        <div className={`absolute top-0 right-0 h-full w-72 bg-[#FFF5F8] shadow-2xl transition-transform duration-300 ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between p-5 border-b border-[#F0D0DC]">
            <span className="font-display font-bold text-lg text-[#1A0A12]">Menu</span>
            <button onClick={() => setMenuOpen(false)} className="p-1 text-[#1A0A12]">
              <X size={20} />
            </button>
          </div>
          <ul className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-80px)]">
            {allLinks.map((link) => (
              <li key={link.href}>
                {link.label === "Memberships" ? (
                  <a
                    href={isSubPage ? "/#memberships" : link.href}
                    onClick={(e) => { handleNavClick(e, link.href); setMenuOpen(false); }}
                    className="block px-4 py-3 font-body font-bold rounded-lg text-white transition-colors"
                    style={{ background: "linear-gradient(135deg, #e91e8c, #8B2252)" }}
                  >
                    {link.label}
                  </a>
                ) : link.label === loyaltyLink.label ? (
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 font-body font-bold rounded-lg text-white transition-colors"
                    style={{ background: "linear-gradient(135deg, #e91e8c, #8B2252)" }}
                  >
                    {link.label}
                  </a>
                ) : (link as any).isPage ? (
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-[#1A0A12] font-body font-medium rounded-lg hover:bg-[#8B2252]/10 hover:text-[#8B2252] transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <a
                    href={isSubPage ? `/${link.href}` : link.href}
                    onClick={(e) => { handleNavClick(e, link.href); setMenuOpen(false); }}
                    className="block px-4 py-3 text-[#1A0A12] font-body font-medium rounded-lg hover:bg-[#8B2252]/10 hover:text-[#8B2252] transition-colors"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
            <li className="pt-4">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCTAClick("Book a Class — Mobile Menu")}
                className="block text-center px-5 py-3 bg-[#F2A0B8] text-[#1A0A12] font-body font-semibold rounded-full hover:bg-[#D4708A] transition-colors"
              >
                Book a Class
              </a>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
