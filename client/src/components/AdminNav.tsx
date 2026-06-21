import { LOGO_URL } from "@/const";
/* ============================================================
   AdminNav — Shared navigation bar for all APY admin pages
   Primary tabs: Invoices, Applications, Breeders, Refunds
   More dropdown: Partnerships, Private Events, Birthday
   Staff tab is only visible to admin role (not staff role)
   ============================================================ */
import { Link, useLocation } from "wouter";
import {
  FileText,
  Users,
  ArrowLeft,
  UserCog,
  Handshake,
  Sparkles,
  LayoutGrid,
  Cake,
  PawPrint,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useEffect } from "react";

// Primary tabs always visible in the nav bar
const PRIMARY_ITEMS = [
  { href: "/admin/invoices",     label: "Invoices",     icon: FileText,   adminOnly: false },
  { href: "/admin/applications", label: "Applications", icon: Users,      adminOnly: false },
  { href: "/admin/breeders",     label: "Breeders",     icon: PawPrint,   adminOnly: false },
  { href: "/admin/refunds",      label: "Refunds",      icon: RotateCcw,  adminOnly: false },
  { href: "/admin/staff",        label: "Staff",        icon: UserCog,    adminOnly: true  },
];

// Secondary tabs collapsed into the "More" dropdown
const MORE_ITEMS = [
  { href: "/admin/partnerships",   label: "Partnerships",    icon: Handshake, adminOnly: false },
  { href: "/admin/private-events", label: "Private Events",  icon: Sparkles,  adminOnly: false },
  { href: "/admin/birthday",       label: "Birthday",        icon: Cake,      adminOnly: false },
];

export default function AdminNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const visiblePrimary = PRIMARY_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  const visibleMore = MORE_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  // Check if any "More" item is currently active (so we can highlight the More button)
  const moreIsActive = visibleMore.some(
    (item) => location === item.href || location.startsWith(item.href)
  );

  return (
    <header className="bg-[#FFF5F8] border-b border-[#F0D0DC] px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group shrink-0">
          <img
            src={LOGO_URL}
            alt="AfroPuppyYoga"
            className="w-9 h-9 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col leading-none hidden sm:flex">
            <span className="font-display font-bold text-sm text-[#1A0A12]">AfroPuppyYoga</span>
            <span className="font-body text-[9px] text-[#8B2252] tracking-widest uppercase">Admin Portal</span>
          </div>
        </a>

        {/* Primary nav tabs */}
        <nav className="flex items-center gap-1 flex-1">
          {visiblePrimary.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-body font-semibold text-sm rounded-full transition-colors whitespace-nowrap ${
                  active
                    ? "bg-[#C2185B] text-white"
                    : "text-[#8B2252] hover:bg-[#FFF0F4] border border-[#F0D0DC] bg-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}

          {/* More dropdown */}
          {visibleMore.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-body font-semibold text-sm rounded-full transition-colors whitespace-nowrap ${
                  moreIsActive
                    ? "bg-[#C2185B] text-white"
                    : "text-[#8B2252] hover:bg-[#FFF0F4] border border-[#F0D0DC] bg-white"
                }`}
              >
                More
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>

              {moreOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-[#F0D0DC] rounded-xl shadow-lg py-1.5 min-w-[170px] z-50">
                  {visibleMore.map(({ href, label, icon: Icon }) => {
                    const active = location === href || location.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2 font-body font-semibold text-sm transition-colors ${
                          active
                            ? "bg-[#FFF0F4] text-[#C2185B]"
                            : "text-[#5A3040] hover:bg-[#FFF8FB] hover:text-[#8B2252]"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Right side: All Tools + Back to Site */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/staff"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#8B2252] bg-white hover:bg-[#FFF0F4] transition-colors whitespace-nowrap"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">All Tools</span>
          </Link>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#6B4C3B] bg-white hover:bg-[#FFF0F4] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Back to Site</span>
          </a>
        </div>
      </div>
    </header>
  );
}
