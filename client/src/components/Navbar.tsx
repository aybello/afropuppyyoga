/* ============================================================
   Navbar — Warm Afro-Wellness Editorial
   Transparent on hero, solid ivory on scroll
   ============================================================ */
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { trackCTAClick } from "@/hooks/useAnalytics";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";
const BOOK_URL = "https://lu.ma/afropuppyyoga";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Experience", href: "#experience" },
  { label: "Private Events", href: "#private-events" },
  { label: "Gallery", href: "#gallery" },
  { label: "Reviews", href: "#reviews" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#FFF5F8]/95 backdrop-blur-md shadow-sm border-b border-[#F0D0DC]"
            : "bg-transparent"
        }`}
      >
        <div className="container">
          <nav className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <a
              href="#home"
              onClick={(e) => { e.preventDefault(); handleNavClick("#home"); }}
              className="flex items-center gap-2.5 group"
            >
              <img
                src={LOGO_URL}
                alt="AfroPuppyYoga"
                className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="flex flex-col leading-none">
                <span
                  className={`font-display font-bold text-base md:text-lg tracking-tight transition-colors duration-300 ${
                    scrolled ? "text-[#1A0A12]" : "text-white"
                  }`}
                >
                  AfroPuppyYoga
                </span>
                <span
                  className={`text-[10px] font-body tracking-widest uppercase transition-colors duration-300 ${
                    scrolled ? "text-[#8B2252]" : "text-[#F2A0B8]"
                  }`}
                >
                  Canada's #1 Puppy Yoga
                </span>
              </div>
            </a>

            {/* Desktop Nav */}
            <ul className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                    className={`px-3 py-2 text-sm font-body font-medium rounded-md transition-all duration-200 hover:bg-[#8B2252]/10 hover:text-[#8B2252] ${
                      scrolled ? "text-[#1A0A12]" : "text-white/90"
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
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
                className={`lg:hidden p-2 rounded-md transition-colors ${
                  scrolled ? "text-[#1A0A12]" : "text-white"
                }`}
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
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={`absolute top-0 right-0 h-full w-72 bg-[#FFF5F8] shadow-2xl transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-5 border-b border-[#F0D0DC]">
            <span className="font-display font-bold text-lg text-[#1A0A12]">Menu</span>
            <button onClick={() => setMenuOpen(false)} className="p-1 text-[#1A0A12]">
              <X size={20} />
            </button>
          </div>
          <ul className="p-4 space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                  className="block px-4 py-3 text-[#1A0A12] font-body font-medium rounded-lg hover:bg-[#8B2252]/10 hover:text-[#8B2252] transition-colors"
                >
                  {link.label}
                </a>
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
