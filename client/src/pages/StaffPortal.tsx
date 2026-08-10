/* ============================================================
   APY HQ — AfroPuppyYoga Command Centre
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
  Zap,
  Inbox,
  Star,
} from "lucide-react";
import { LOGO_URL } from "@/const";

const TOOLS = [
  {
    id: "submit-invoice",
    title: "Submit Invoice",
    description: "Upload and submit invoices for processing.",
    href: "/submit-invoice",
    icon: Upload,
    accent: "#8B2252",
    adminOnly: false,
    category: "Finance",
  },
  {
    id: "invoices",
    title: "Invoice Dashboard",
    description: "Track all staff invoices, totals, and payment status.",
    href: "/admin/invoices",
    icon: FileText,
    accent: "#8B2252",
    adminOnly: true,
    category: "Finance",
  },
  {
    id: "revenue",
    title: "Revenue",
    description: "Stripe sales, ticket types, time slots, and attendance.",
    href: "/admin/revenue",
    icon: DollarSign,
    accent: "#2E7D32",
    adminOnly: true,
    category: "Finance",
  },
  {
    id: "applications",
    title: "Job Applications",
    description: "Review applications, filter by role and status.",
    href: "/admin/applications",
    icon: Users,
    accent: "#6B3A7D",
    adminOnly: true,
    category: "People",
  },
  {
    id: "private-events",
    title: "Private Events",
    description: "Inquiries, quick booking links, and quote emails.",
    href: "/admin/private-events",
    icon: Sparkles,
    accent: "#8B2252",
    adminOnly: true,
    category: "Events",
  },
  {
    id: "puppy-schedule",
    title: "Puppy Schedule",
    description: "Class calendar with auto Luma event generation.",
    href: "/admin/puppy-schedule",
    icon: CalendarDays,
    accent: "#8B2252",
    adminOnly: true,
    category: "Events",
  },
  {
    id: "breeders",
    title: "Breeder Database",
    description: "Contacts, breeds, rates, confirmations, and calculator.",
    href: "/admin/breeders",
    icon: PawPrint,
    accent: "#8B2252",
    adminOnly: true,
    category: "Breeders",
  },
  {
    id: "breeder-leads",
    title: "Breeder Leads",
    description: "Kijiji sourcing, AI scoring, and outreach pipeline.",
    href: "/admin/breeder-leads",
    icon: Dog,
    accent: "#8B2252",
    adminOnly: true,
    category: "Breeders",
  },
  {
    id: "partnerships",
    title: "Partnerships",
    description: "Corporate wellness, brand collabs, and media inquiries.",
    href: "/admin/partnerships",
    icon: Handshake,
    accent: "#2E7D32",
    adminOnly: true,
    category: "Growth",
  },
  {
    id: "review-texts",
    title: "Review Texts",
    description: "Post-class Google review SMS log and status.",
    href: "/admin/review-texts",
    icon: Star,
    accent: "#D4A017",
    adminOnly: true,
    category: "Growth",
  },
  {
    id: "sms-inbox",
    title: "SMS Inbox",
    description: "Inbound replies from breeders and guests.",
    href: "/admin/sms-inbox",
    icon: Inbox,
    accent: "#7C3AED",
    adminOnly: true,
    category: "Operations",
  },
  {
    id: "cancellation",
    title: "Cancel a Class",
    description: "Cancel and notify all attendees via call and SMS.",
    href: "/admin/cancellation",
    icon: PhoneOff,
    accent: "#C0392B",
    adminOnly: true,
    category: "Operations",
  },
  {
    id: "sms-broadcast",
    title: "SMS Broadcast",
    description: "Text one person, a list, or upload a CSV for bulk sends.",
    href: "/admin/sms-broadcast",
    icon: MessageSquare,
    accent: "#7C3AED",
    adminOnly: true,
    category: "Operations",
  },
];

const CATEGORY_ORDER = ["Finance", "Events", "Breeders", "People", "Growth", "Operations"];

const CATEGORY_COLORS: Record<string, string> = {
  Finance: "#2E7D32",
  Events: "#8B2252",
  Breeders: "#8B2252",
  People: "#6B3A7D",
  Growth: "#D4A017",
  Operations: "#C0392B",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function StaffPortal() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#8B2252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = isAuthenticated && (user?.role === "admin" || user?.role === "staff");
  const isOwner = isAuthenticated && user?.role === "admin";
  const displayName = isOwner ? "Chief Ay" : user?.name?.split(" ")[0] ?? "there";

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    tools: TOOLS.filter(t => t.category === cat),
  })).filter(g => g.tools.length > 0);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">

      {/* Top bar */}
      <header className="bg-white border-b border-[#F0D0DC] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-9 h-9 rounded-xl object-cover shadow-sm" />
            <div>
              <p className="font-bold text-sm text-[#1A0A12] leading-none tracking-wide">APY HQ</p>
              <p className="text-[10px] text-[#8B2252]/60 leading-none mt-0.5 font-medium">Command Centre</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-[#8B2252] hover:text-[#6B1A3E] transition-colors font-medium"
          >
            <ExternalLink size={12} />
            Back to Site
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Hero welcome banner */}
        <div className="relative rounded-2xl overflow-hidden mb-10 p-8" style={{ background: "linear-gradient(135deg, #8B2252 0%, #C2185B 50%, #AD1457 100%)" }}>
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-2 text-white/60">
                {getGreeting()} ·{" "}
                {new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-1">
                Welcome back, <span className="text-[#FFD6E7]">{displayName}</span> 👑
              </h1>
              <p className="text-white/60 text-sm mt-2">
                AfroPuppyYoga Operations · Ontario, Canada
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/20 self-start">
              <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <span className="text-xs text-white/80 font-medium">All systems running</span>
            </div>
          </div>
        </div>

        {/* Auth notice */}
        {!isAuthenticated && (
          <div className="mb-8 p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-3">
            <Lock size={14} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800">
              Some tools require login.{" "}
              <a href="/admin-login" className="underline font-semibold">Sign in</a> to access admin features.
            </p>
          </div>
        )}

        {/* Tool sections by category */}
        <div className="space-y-8">
          {grouped.map(({ category, tools }) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full"
                  style={{ color: CATEGORY_COLORS[category], background: `${CATEGORY_COLORS[category]}15` }}
                >
                  {category}
                </span>
                <div className="flex-1 h-px bg-[#F0D0DC]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const isLocked = tool.adminOnly && !isAdmin;

                  return (
                    <Link key={tool.id} href={tool.href}>
                      <div
                        className={`group relative bg-white rounded-xl p-4 transition-all duration-200 cursor-pointer border h-full ${
                          isLocked
                            ? "opacity-50 cursor-not-allowed border-[#F0D0DC]"
                            : "border-[#F0D0DC] hover:border-[#8B2252]/30 hover:shadow-md hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: `${tool.accent}12`, border: `1.5px solid ${tool.accent}25` }}
                          >
                            <Icon size={18} style={{ color: tool.accent }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h2 className="font-bold text-sm text-[#1A0A12] truncate">
                                {tool.title}
                              </h2>
                              {isLocked && <Lock size={10} className="text-[#C4A0B0] shrink-0" />}
                            </div>
                            <p className="text-xs text-[#6B4C3B]/70 line-clamp-2 leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-[#C4A0B0] group-hover:text-[#8B2252] transition-colors shrink-0 mt-1"
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-12 text-[10px] text-[#C4A0B0] text-center">
          APY HQ · <a href="mailto:afropuppyyoga@gmail.com" className="hover:text-[#8B2252] transition-colors">afropuppyyoga@gmail.com</a>
        </p>
      </main>
    </div>
  );
}
