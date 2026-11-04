import { BOOK_URL, LOGO_URL } from "@/const";
import { useState, useEffect, useRef } from "react";
import { ChevronDownIcon, CloseIcon, MenuIcon } from "@/components/PublicIcons";
import { trackCTAClick } from "@/hooks/useAnalytics";
import { handleHomeSectionClick, homeSectionHref, scrollToHomeSection } from "./homeSectionNavigation";

const primaryLinks = [
  { label: "Home", href: "#home" },
  { label: "Experience", href: "#experience" },
  { label: "Memberships", href: "#memberships" },
  { label: "Private Events", href: "#private-events" },
  { label: "Class Pictures", href: "https://drive.google.com/drive/folders/1Q8WpKFj4cUsXlnn0jeKdBeWz5hSunp2t?usp=drive_link", isPage: true, isExternal: true },
  { label: "Careers", href: "/careers", isPage: true },
];
const loyaltyLink = { label: "🐾 Rewards", href: "/loyalty", isPage: true };
const moreLinks = [
  { label: "🖼️ Gallery", href: "#gallery" },
  { label: "📍 Kitchener", href: "/puppy-yoga-kitchener", isPage: true },
  { label: "📍 Hamilton", href: "/puppy-yoga-hamilton", isPage: true },
  { label: "📍 Oakville", href: "/puppy-yoga-oakville", isPage: true },
  { label: "📍 Guelph", href: "/puppy-yoga-guelph", isPage: true },
  { label: "🏢 Corporate Events", href: "/corporate-puppy-yoga", isPage: true },
  { label: "🤝 Partnerships", href: "/partnerships", isPage: true },
  { label: "🐶 Private Event Quote", href: "/private-events/quote", isPage: true },
  { label: "🌿 Ethical Standards", href: "/ethics", isPage: true },
];
// Keep all primary links visible on desktop and preserve the mobile order.
const desktopLinks = primaryLinks;
const desktopMoreLinks = moreLinks;
const allLinks = [...primaryLinks, loyaltyLink, ...moreLinks];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);
  const isSubPage = typeof window !== "undefined" && window.location.pathname !== "/";

  useEffect(() => {
    const navigateToHash = () => scrollToHomeSection(window.location.hash);
    // Wait until the homepage's deferred-section listeners have mounted.
    const timer = window.setTimeout(navigateToHash, 0);
    window.addEventListener("hashchange", navigateToHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", navigateToHash);
    };
  }, []);

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
    if (href.startsWith("#")) handleHomeSectionClick(e, href);
  };

  return (
    <>
      <header className="apy-public-nav fixed top-0 left-0 right-0 z-50 border-b border-border bg-ivory text-espresso">
        <div className="container">
          <nav aria-label="Main navigation" className="flex items-center justify-between gap-2 h-16 md:h-20">
            <a
              href={isSubPage ? "/" : "#home"}
              onClick={(e) => { if (!isSubPage) handleNavClick(e, "#home"); }}
              className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 rounded-md"
            >
              <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-7 h-9 sm:w-10 sm:h-12 md:w-14 md:h-14 object-contain" />
              <div className="flex flex-col leading-none">
                <span className="font-display font-medium text-xs sm:text-base md:text-2xl tracking-tight text-espresso">AfroPuppyYoga</span>
                <span className="hidden sm:block mt-1.5 text-[9px] font-body tracking-[0.12em] uppercase text-brand-link">Ontario's #1 Puppy Yoga</span>
              </div>
            </a>

            <ul className="hidden xl:flex items-center gap-0.5">
              {desktopLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href.startsWith("#") ? homeSectionHref(link.href) : link.href}
                    target={(link as { isExternal?: boolean }).isExternal ? "_blank" : undefined}
                    rel={(link as { isExternal?: boolean }).isExternal ? "noopener noreferrer" : undefined}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="apy-nav-link"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={loyaltyLink.href} onClick={() => { setMenuOpen(false); setMoreOpen(false); }} className="apy-nav-link">
                  {loyaltyLink.label}
                </a>
              </li>
              <li ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className="apy-nav-link"
                  aria-expanded={moreOpen}
                  aria-controls="apy-more-navigation"
                >
                  More
                  <ChevronDownIcon size={14} className={`transition-transform duration-150 ${moreOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {moreOpen && (
                  <div id="apy-more-navigation" className="absolute top-full right-0 mt-2 w-60 max-h-[calc(100svh-7rem)] overflow-y-auto bg-ivory border border-border rounded-xl shadow-md z-50 p-1.5">
                    {desktopMoreLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href.startsWith("#") ? homeSectionHref(link.href) : link.href}
                        target={(link as { isExternal?: boolean }).isExternal ? "_blank" : undefined}
                        rel={(link as { isExternal?: boolean }).isExternal ? "noopener noreferrer" : undefined}
                        onClick={(e) => handleNavClick(e, link.href)}
                        className="flex items-center min-h-11 px-3 py-2.5 text-sm font-body font-medium text-espresso hover:bg-blush hover:text-brand-link rounded-lg transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            </ul>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <a href="/staff-access" className="hidden xl:inline-flex items-center min-h-11 px-3 py-2 text-xs font-body font-medium rounded-full border border-border text-espresso hover:bg-blush transition-colors">
                Staff Portal
              </a>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCTAClick("Book a Class — Navbar")}
                className="apy-primary-action px-3 sm:px-5 text-xs sm:text-sm"
              >
                Book a Class
              </a>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="xl:hidden min-h-11 w-9 sm:w-11 flex items-center justify-center rounded-lg text-espresso hover:bg-blush transition-colors"
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                aria-controls="apy-mobile-navigation"
              >
                {menuOpen ? <CloseIcon size={22} aria-hidden /> : <MenuIcon size={22} aria-hidden />}
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div className={`apy-public-nav fixed inset-0 z-40 xl:hidden transition-opacity duration-150 ${menuOpen ? "visible opacity-100 pointer-events-auto" : "invisible opacity-0 pointer-events-none"}`}>
        <div className="absolute inset-0 bg-espresso/30" onClick={() => setMenuOpen(false)} />
        <div id="apy-mobile-navigation" className={`absolute top-16 md:top-20 bottom-0 right-0 w-80 max-w-full bg-ivory border-l border-border shadow-md flex flex-col transition-transform duration-150 ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <span className="font-display font-medium text-xl text-espresso">Menu</span>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="h-11 w-11 flex items-center justify-center rounded-lg text-espresso hover:bg-blush">
              <CloseIcon size={20} aria-hidden />
            </button>
          </div>
          <ul className="p-4 space-y-1 overflow-y-auto flex-1">
            {allLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href.startsWith("#") ? homeSectionHref(link.href) : link.href}
                  target={(link as { isExternal?: boolean }).isExternal ? "_blank" : undefined}
                  rel={(link as { isExternal?: boolean }).isExternal ? "noopener noreferrer" : undefined}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`flex items-center min-h-11 px-4 py-3 text-espresso font-body text-sm font-medium rounded-lg hover:bg-blush hover:text-brand-link transition-colors ${link.label === "Memberships" || link.label === loyaltyLink.label ? "bg-blush" : ""}`}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="pt-4">
              <a href="/staff-access" onClick={() => setMenuOpen(false)} className="flex justify-center min-h-11 px-5 py-3 mb-2 border border-input text-espresso font-body text-sm font-medium rounded-full hover:bg-blush transition-colors">
                Staff Portal
              </a>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCTAClick("Book a Class — Mobile Menu")}
                className="apy-primary-action w-full"
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
