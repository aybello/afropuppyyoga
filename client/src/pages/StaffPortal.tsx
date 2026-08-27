/* ============================================================
   APY HQ — AfroPuppyYoga Command Centre
   ============================================================ */
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGO_URL } from "@/const";
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
  Inbox,
  Star,
  CalendarCheck,
  GraduationCap,
} from "lucide-react";

const TEAM_PHOTO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663824308637/IiwudPwckobbrxIv.jpg";

const TOOLS = [
  {
    id: "staff-training",
    title: "Team Training",
    description: "Role-based onboarding, safety and event-day playbooks.",
    href: "/staff/training",
    icon: GraduationCap,
    accent: "#8B2252",
    adminOnly: true,
    category: "People",
  },
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
    accent: "#B8860B",
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
  {
    id: "staff-availability",
    title: "Staff Availability",
    description: "Org chart, vacation tracking, and leave management.",
    href: "/admin/staff-availability",
    icon: CalendarCheck,
    accent: "#0891B2",
    adminOnly: true,
    category: "People",
  },
];

const CATEGORY_ORDER = ["People", "Finance", "Events", "Breeders", "Growth", "Operations"];

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
    <div className="min-h-screen bg-[#F7F2EE]">

      {/* Sticky top bar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EDE0D8] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="APY" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <p className="font-bold text-[13px] text-[#1A0A12] leading-none">APY HQ</p>
              <p className="text-[10px] text-[#8B2252] leading-none mt-0.5 font-medium tracking-wide uppercase">Command Centre</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-[#8B2252] hover:text-[#6B1A3E] transition-colors font-medium">
            <ExternalLink size={12} />
            Back to Site
          </Link>
        </div>
      </header>

      {/* Hero — clean full photo, no overlay */}
      <div className="relative overflow-hidden" style={{ height: "380px" }}>
        <img
          src={TEAM_PHOTO}
          alt="APY Team"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 55%" }}
        />
      </div>

      {/* Welcome bar below photo */}
      <div className="bg-white border-b border-[#EDE0D8] px-6 md:px-10 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#8B2252]/60 mb-0.5">
              {getGreeting()} · {new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-[#1A0A12] leading-tight">
              Welcome back, <span style={{ color: "#8B2252" }}>{displayName}</span> 👑
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-700 font-medium">All systems running</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 md:px-10 py-5">

        {/* Auth notice */}
        {!isAuthenticated && (
          <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-3">
            <Lock size={14} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800">
              Some tools require login.{" "}
              <a href="/admin-login" className="underline font-semibold">Sign in</a> to access admin features.
            </p>
          </div>
        )}

        {/* Tool grid by category */}
        <div className="space-y-5">
          {grouped.map(({ category, tools }) => (
            <div key={category}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-bold tracking-widest uppercase text-[#8B2252]">{category}</h2>
                <div className="flex-1 h-px bg-[#E8D5CC]" />
              </div>
              {/* Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const isLocked = tool.adminOnly && !isAdmin;

                  return (
                    <Link key={tool.id} href={tool.href}>
                      <div
                        className={`group relative bg-white rounded-xl overflow-hidden transition-all duration-150 h-full ${
                          isLocked
                            ? "opacity-45 cursor-not-allowed"
                            : "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
                        }`}
                        style={{ boxShadow: "0 1px 3px rgba(139,34,82,0.07)" }}
                      >
                        <div className="p-4 py-5">
                          <div className="flex items-center justify-between mb-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ background: `${tool.accent}12` }}
                            >
                              <Icon size={19} style={{ color: tool.accent }} />
                            </div>
                            <div className="flex items-center gap-1">
                              {isLocked && <Lock size={9} className="text-[#C4A0B0]" />}
                              <ArrowRight size={14} className="text-[#D4B8C4] group-hover:text-[#8B2252] transition-colors" />
                            </div>
                          </div>
                          <h3 className="font-semibold text-[15px] text-[#1A0A12] leading-snug">{tool.title}</h3>
                          <p className="text-[12px] text-[#7A5A6A] leading-relaxed mt-1">{tool.description}</p>
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
        <p className="mt-6 text-[10px] text-[#C4A0B0] text-center">
          APY HQ · <a href="mailto:afropuppyyoga@gmail.com" className="hover:text-[#8B2252] transition-colors">afropuppyyoga@gmail.com</a>
        </p>
      </main>
    </div>
  );
}
