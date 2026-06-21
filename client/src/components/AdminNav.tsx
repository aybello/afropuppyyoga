import { LOGO_URL } from "@/const";
/* ============================================================
   AdminNav — Shared navigation bar for all APY admin pages
   Shows links between Invoices, Applications, Partnerships, and back to site
   Staff tab is only visible to admin role (not staff role)
   ============================================================ */
import { Link, useLocation } from "wouter";
import { FileText, Users, ArrowLeft, UserCog, Handshake, Sparkles, LayoutGrid, Cake, PawPrint, RotateCcw } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";


const NAV_ITEMS = [
  {
    href: "/admin/invoices",
    label: "Invoices",
    icon: FileText,
    adminOnly: false,
  },
  {
    href: "/admin/applications",
    label: "Applications",
    icon: Users,
    adminOnly: false,
  },
  {
    href: "/admin/partnerships",
    label: "Partnerships",
    icon: Handshake,
    adminOnly: false,
  },
  {
    href: "/admin/private-events",
    label: "Private Events",
    icon: Sparkles,
    adminOnly: false,
  },
  {
    href: "/admin/birthday",
    label: "Birthday",
    icon: Cake,
    adminOnly: false,
  },
  {
    href: "/admin/breeders",
    label: "Breeders",
    icon: PawPrint,
    adminOnly: false,
  },
  {
    href: "/admin/refunds",
    label: "Refunds",
    icon: RotateCcw,
    adminOnly: false,
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: UserCog,
    adminOnly: true, // only admins can manage staff — hidden from staff role
  },
];

export default function AdminNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  return (
    <header className="bg-[#FFF5F8] border-b border-[#F0D0DC] px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {/* Logo + back to site */}
        <a href="/" className="flex items-center gap-3 group shrink-0">
          <img
            src={LOGO_URL}
            alt="AfroPuppyYoga"
            className="w-10 h-10 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-base text-[#1A0A12]">AfroPuppyYoga</span>
            <span className="font-body text-[10px] text-[#8B2252] tracking-widest uppercase">Admin Portal</span>
          </div>
        </a>

        {/* Admin page tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-none">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-body font-semibold text-sm rounded-full transition-colors whitespace-nowrap ${active ? "bg-[#C2185B] text-white" : "text-[#8B2252] hover:bg-[#FFF0F4] border border-[#F0D0DC] bg-white"}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: Portal home + Back to site */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/staff"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#8B2252] bg-white hover:bg-[#FFF0F4] transition-colors whitespace-nowrap"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden md:inline">All Tools</span>
          </Link>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#6B4C3B] bg-white hover:bg-[#FFF0F4] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Back to Site</span>
          </a>
        </div>
      </div>
    </header>
  );
}
