/* ============================================================
   AdminNav — Shared navigation bar for all APY admin pages
   Shows links between Invoices, Applications, and back to site
   ============================================================ */
import { Link, useLocation } from "wouter";
import { FileText, Users, ArrowLeft, LayoutDashboard } from "lucide-react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

const NAV_ITEMS = [
  {
    href: "/admin/invoices",
    label: "Invoices",
    icon: FileText,
  },
  {
    href: "/admin/applications",
    label: "Applications",
    icon: Users,
  },
];

export default function AdminNav() {
  const [location] = useLocation();

  return (
    <header className="bg-[#FFF5F8] border-b border-[#F0D0DC] px-6 py-4 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
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
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  className={`inline-flex items-center gap-2 px-4 py-2 font-body font-semibold text-sm rounded-full transition-colors ${
                    active
                      ? "bg-[#C2185B] text-white"
                      : "text-[#8B2252] hover:bg-[#FFF0F4] border border-[#F0D0DC] bg-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Back to site */}
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#6B4C3B] bg-white hover:bg-[#FFF0F4] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Site</span>
        </a>
      </div>
    </header>
  );
}
