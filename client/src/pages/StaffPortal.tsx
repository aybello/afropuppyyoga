/* ============================================================
   Staff Portal — AfroPuppyYoga
   Central hub for all internal tools
   ============================================================ */
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FileText,
  Users,
  Upload,
  ArrowRight,
  Lock,
  ExternalLink,
  Handshake,
  Sparkles,
  PawPrint,
  PhoneOff,
  MessageSquare,
  DollarSign,
  Dog,
  CalendarDays,
} from "lucide-react";

const TOOLS = [
  {
    id: "submit-invoice",
    title: "Submit Invoice",
    description: "Upload and submit invoices for processing.",
    href: "/submit-invoice",
    icon: Upload,
    color: "#8B2252",
    bg: "#FFF5F8",
    adminOnly: false,
  },
  {
    id: "invoices",
    title: "Invoice Dashboard",
    description: "Track all staff invoices, totals, and payment status.",
    href: "/admin/invoices",
    icon: FileText,
    color: "#8B2252",
    bg: "#F9E4EE",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "applications",
    title: "Job Applications",
    description: "Review applications, filter by role and status.",
    href: "/admin/applications",
    icon: Users,
    color: "#6B3A7D",
    bg: "#F5EEF8",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "private-events",
    title: "Private Events",
    description: "Inquiries, quick booking links, and quote emails.",
    href: "/admin/private-events",
    icon: Sparkles,
    color: "#8B2252",
    bg: "#FFF5F8",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "breeders",
    title: "Breeder Database",
    description: "Contacts, breeds, rates, confirmations, and calculator.",
    href: "/admin/breeders",
    icon: PawPrint,
    color: "#8B2252",
    bg: "#FFF0F4",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "breeder-leads",
    title: "Breeder Leads",
    description: "Kijiji sourcing, AI scoring, and outreach pipeline.",
    href: "/admin/breeder-leads",
    icon: Dog,
    color: "#8B2252",
    bg: "#FFF0F4",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "puppy-schedule",
    title: "Puppy Schedule",
    description: "Class calendar with auto Luma event generation.",
    href: "/admin/puppy-schedule",
    icon: CalendarDays,
    color: "#8B2252",
    bg: "#FFF5F8",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "revenue",
    title: "Revenue",
    description: "Stripe sales, ticket types, time slots, and attendance.",
    href: "/admin/revenue",
    icon: DollarSign,
    color: "#2E7D32",
    bg: "#F1F8E9",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "partnerships",
    title: "Partnerships",
    description: "Corporate wellness, brand collabs, and media inquiries.",
    href: "/admin/partnerships",
    icon: Handshake,
    color: "#2E7D32",
    bg: "#F1F8E9",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "cancellation",
    title: "Cancel a Class",
    description: "Cancel and notify all attendees via call and SMS.",
    href: "/admin/cancellation",
    icon: PhoneOff,
    color: "#C0392B",
    bg: "#FEF2F2",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "sms-broadcast",
    title: "SMS Broadcast",
    description: "Text one person, a list, or upload a CSV for bulk sends.",
    href: "/admin/sms-broadcast",
    icon: MessageSquare,
    color: "#8b5cf6",
    bg: "#F5F0FF",
    badge: "Admin",
    adminOnly: true,
  },
];

export default function StaffPortal() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#8B2252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      {/* Header */}
      <header className="bg-white border-b border-[#F0D0DC] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-7 h-7 bg-[#8B2252] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div>
              <p className="font-display font-bold text-sm text-[#1A0A12] leading-none">AfroPuppyYoga</p>
              <p className="font-body text-[10px] text-[#3D1A2E] leading-none mt-0.5">Staff Portal</p>
            </div>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 font-body text-xs text-[#8B2252] hover:text-[#8B2252] transition-colors"
          >
            <ExternalLink size={12} />
            Back to Site
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl text-[#1A0A12]">
            Staff Portal
          </h1>
          <p className="font-body text-sm text-[#3D1A2E] mt-1">
            All internal tools for managing AfroPuppyYoga operations.
          </p>
        </div>

        {/* Auth notice */}
        {!isAuthenticated && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
            <Lock size={14} className="text-amber-600 shrink-0" />
            <p className="font-body text-xs text-amber-800">
              Some tools require login.{" "}
              <a href="/admin-login" className="underline">Sign in</a> to access admin features.
            </p>
          </div>
        )}

        {/* Tool grid — 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isLocked = tool.adminOnly && (!isAuthenticated || (user?.role !== "admin" && user?.role !== "staff"));

            return (
              <Link key={tool.id} href={tool.href}>
                <div
                  className={`group relative bg-white border border-[#F0D0DC] rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer h-full ${
                    isLocked
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:shadow-sm hover:-translate-y-0.5 hover:border-[#8B2252]/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: tool.bg }}
                    >
                      <Icon size={16} style={{ color: tool.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="font-display font-bold text-sm text-[#1A0A12] truncate">
                          {tool.title}
                        </h2>
                        {tool.badge && (
                          <span className="px-1.5 py-0.5 text-[9px] font-body font-semibold rounded-full bg-[#F9E4EE] text-[#8B2252] border border-[#F0D0DC] shrink-0">
                            {tool.badge}
                          </span>
                        )}
                        {isLocked && <Lock size={10} className="text-[#C4A0B0] shrink-0" />}
                      </div>
                      <p className="font-body text-xs text-[#6B4C3B] mt-0.5 line-clamp-1">
                        {tool.description}
                      </p>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-[#C4A0B0] group-hover:text-[#8B2252] transition-colors shrink-0"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <p className="mt-8 font-body text-[10px] text-[#C4A0B0] text-center">
          AfroPuppyYoga Staff Portal · <a href="mailto:afropuppyyoga@gmail.com" className="underline">afropuppyyoga@gmail.com</a>
        </p>
      </main>
    </div>
  );
}
