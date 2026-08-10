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
} from "lucide-react";

const TOOLS = [
  {
    id: "submit-invoice",
    title: "Submit Invoice",
    description: "Upload and submit invoices for processing.",
    href: "/submit-invoice",
    icon: Upload,
    accent: "#C2185B",
    adminOnly: false,
    category: "Finance",
  },
  {
    id: "invoices",
    title: "Invoice Dashboard",
    description: "Track all staff invoices, totals, and payment status.",
    href: "/admin/invoices",
    icon: FileText,
    accent: "#C2185B",
    badge: "Admin",
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
    badge: "Admin",
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
    badge: "Admin",
    adminOnly: true,
    category: "People",
  },
  {
    id: "private-events",
    title: "Private Events",
    description: "Inquiries, quick booking links, and quote emails.",
    href: "/admin/private-events",
    icon: Sparkles,
    accent: "#C2185B",
    badge: "Admin",
    adminOnly: true,
    category: "Events",
  },
  {
    id: "puppy-schedule",
    title: "Puppy Schedule",
    description: "Class calendar with auto Luma event generation.",
    href: "/admin/puppy-schedule",
    icon: CalendarDays,
    accent: "#C2185B",
    badge: "Admin",
    adminOnly: true,
    category: "Events",
  },
  {
    id: "breeders",
    title: "Breeder Database",
    description: "Contacts, breeds, rates, confirmations, and calculator.",
    href: "/admin/breeders",
    icon: PawPrint,
    accent: "#C2185B",
    badge: "Admin",
    adminOnly: true,
    category: "Breeders",
  },
  {
    id: "breeder-leads",
    title: "Breeder Leads",
    description: "Kijiji sourcing, AI scoring, and outreach pipeline.",
    href: "/admin/breeder-leads",
    icon: Dog,
    accent: "#C2185B",
    badge: "Admin",
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
    badge: "Admin",
    adminOnly: true,
    category: "Growth",
  },
  {
    id: "cancellation",
    title: "Cancel a Class",
    description: "Cancel and notify all attendees via call and SMS.",
    href: "/admin/cancellation",
    icon: PhoneOff,
    accent: "#C0392B",
    badge: "Admin",
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
    badge: "Admin",
    adminOnly: true,
    category: "Operations",
  },
];

const CATEGORY_ORDER = ["Finance", "Events", "Breeders", "People", "Growth", "Operations"];

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
      <div className="min-h-screen bg-[#0D0208] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C2185B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = isAuthenticated && (user?.role === "admin" || user?.role === "staff");
  const isOwner = isAuthenticated && user?.role === "admin";
  const displayName = isOwner ? "Chief Ay" : user?.name?.split(" ")[0] ?? "there";

  // Group tools by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    tools: TOOLS.filter(t => t.category === cat),
  })).filter(g => g.tools.length > 0);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0D0208 0%, #1A0412 50%, #0D0208 100%)" }}>

      {/* Top bar */}
      <header className="border-b border-white/10 sticky top-0 z-40 backdrop-blur-md" style={{ background: "rgba(13,2,8,0.85)" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C2185B, #8B2252)" }}>
              <Zap size={14} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-none tracking-wide">APY HQ</p>
              <p className="text-[10px] text-white/40 leading-none mt-0.5">Command Centre</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            <ExternalLink size={12} />
            Back to Site
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Hero welcome */}
        <div className="mb-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#C2185B" }}>
                {getGreeting()}
              </p>
              <h1 className="text-4xl font-bold text-white leading-tight mb-1">
                Welcome back, <span style={{ color: "#F48FB1" }}>{displayName}</span> 👑
              </h1>
              <p className="text-white/50 text-sm mt-2">
                {new Date().toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                &nbsp;·&nbsp;AfroPuppyYoga Operations
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/60">All systems running</span>
            </div>
          </div>
        </div>

        {/* Auth notice */}
        {!isAuthenticated && (
          <div className="mb-8 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
            <Lock size={14} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-200">
              Some tools require login.{" "}
              <a href="/admin-login" className="underline text-amber-300">Sign in</a> to access admin features.
            </p>
          </div>
        )}

        {/* Tool sections by category */}
        <div className="space-y-8">
          {grouped.map(({ category, tools }) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold tracking-widest uppercase text-white/30">{category}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const isLocked = tool.adminOnly && !isAdmin;

                  return (
                    <Link key={tool.id} href={tool.href}>
                      <div
                        className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer border h-full ${
                          isLocked
                            ? "opacity-40 cursor-not-allowed border-white/5 bg-white/3"
                            : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${tool.accent}22`, border: `1px solid ${tool.accent}44` }}
                          >
                            <Icon size={16} style={{ color: tool.accent }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h2 className="font-bold text-sm text-white truncate">
                                {tool.title}
                              </h2>
                              {isLocked && <Lock size={10} className="text-white/30 shrink-0" />}
                            </div>
                            <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-white/20 group-hover:text-white/60 transition-colors shrink-0 mt-1"
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
        <p className="mt-12 text-[10px] text-white/20 text-center">
          APY HQ · <a href="mailto:afropuppyyoga@gmail.com" className="hover:text-white/40 transition-colors">afropuppyyoga@gmail.com</a>
        </p>
      </main>
    </div>
  );
}
