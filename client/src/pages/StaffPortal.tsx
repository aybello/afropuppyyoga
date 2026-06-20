/* ============================================================
   Staff Portal — AfroPuppyYoga
   Central hub for all internal tools
   ============================================================ */
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  FileText,
  Users,
  TrendingUp,
  Calculator,
  Upload,
  ArrowRight,
  Lock,
  ExternalLink,
  Handshake,
  Sparkles,
  Cake,
  PawPrint,
} from "lucide-react";

const TOOLS = [
  {
    id: "submit-invoice",
    title: "Submit Invoice",
    description: "Staff can upload and submit their invoices for processing. AI extracts the details automatically.",
    href: "/submit-invoice",
    icon: Upload,
    color: "#8B2252",
    bg: "#FFF5F8",
    border: "#F0D0DC",
    badge: null,
    adminOnly: false,
  },
  {
    id: "invoices",
    title: "Invoice Dashboard",
    description: "View, manage, and track all submitted staff invoices. See totals, due dates, and payment status.",
    href: "/admin/invoices",
    icon: FileText,
    color: "#8B2252",
    bg: "#F9E4EE",
    border: "#E8C0D0",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "applications",
    title: "Job Applications",
    description: "Review all job applications submitted through the Careers page. Filter by role, status, and location.",
    href: "/admin/applications",
    icon: Users,
    color: "#6B3A7D",
    bg: "#F5EEF8",
    border: "#DDD0E8",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "predictor",
    title: "Fill Rate Predictor",
    description: "AI-powered class demand forecasting. Predict ticket sales and revenue for upcoming sessions by breed, location, and month.",
    href: "/predictor",
    icon: TrendingUp,
    color: "#8B2252",
    bg: "#FFF5F8",
    border: "#F0D0DC",
    badge: null,
    adminOnly: false,
  },
  {
    id: "breeder-calculator",
    title: "Breeder Calculator",
    description: "Calculate breeder revenue share and session economics for puppy partners and breeders.",
    href: "/breeder-calculator",
    icon: Calculator,
    color: "#8B2252",
    bg: "#F9E4EE",
    border: "#E8C0D0",
    badge: null,
    adminOnly: false,
  },
  {
    id: "partnerships",
    title: "Partnership Inquiries",
    description: "Review and manage all incoming partnership inquiries — corporate wellness, brand collabs, media, and more.",
    href: "/admin/partnerships",
    icon: Handshake,
    color: "#2E7D32",
    bg: "#F1F8E9",
    border: "#C5E1A5",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "private-events",
    title: "Private Event Inquiries",
    description: "Track every private event inquiry submitted through the quote form — view details, update status, and add internal notes.",
    href: "/admin/private-events",
    icon: Sparkles,
    color: "#8B2252",
    bg: "#FFF5F8",
    border: "#F0D0DC",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "breeders",
    title: "Breeder Database",
    description: "Manage and track your breeder relationships — contact info, breeds, litter timelines, rates, and contract status.",
    href: "/admin/breeders",
    icon: PawPrint,
    color: "#C2185B",
    bg: "#FFF0F4",
    border: "#F0D0DC",
    badge: "Admin",
    adminOnly: true,
  },
  {
    id: "birthday",
    title: "Birthday Inquiries",
    description: "View and manage all birthday package inquiries. Filter by tier, location, and status.",
    href: "/admin/birthday",
    icon: Cake,
    color: "#C2185B",
    bg: "#FFF0F4",
    border: "#F0D0DC",
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
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-[#8B2252] rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <div>
              <p className="font-display font-bold text-sm text-[#1A0A12] leading-none">AfroPuppyYoga</p>
              <p className="font-body text-[10px] text-[#8B6070] leading-none mt-0.5">Staff Portal</p>
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
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Page title */}
        <div className="mb-10">
          <p className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-widest mb-2">
            — Internal Tools
          </p>
          <h1 className="font-display font-bold text-4xl text-[#1A0A12] mb-3">
            Staff Portal
          </h1>
          <p className="font-body text-base text-[#5A3040] max-w-xl">
            Everything you need to manage AfroPuppyYoga operations — invoices, applications, forecasting, and more.
          </p>
        </div>

        {/* Auth notice for non-logged-in users */}
        {!isAuthenticated && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <Lock size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-body text-sm font-semibold text-amber-800">Some tools require login</p>
              <p className="font-body text-xs text-amber-700 mt-0.5">
                Admin tools are restricted to authorized staff.{" "}
                <a href={getLoginUrl()} className="underline hover:no-underline">
                  Sign in
                </a>{" "}
                to access all features.
              </p>
            </div>
          </div>
        )}

        {/* Tool grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isLocked = tool.adminOnly && (!isAuthenticated || (user?.role !== "admin" && user?.role !== "staff"));

            return (
              <Link key={tool.id} href={tool.href}>
                <div
                  className={`group relative bg-white border rounded-2xl p-6 transition-all duration-200 cursor-pointer ${
                    isLocked
                      ? "opacity-60 cursor-not-allowed border-[#F0D0DC]"
                      : "hover:shadow-md hover:-translate-y-0.5 border-[#F0D0DC] hover:border-[#8B2252]/30"
                  }`}
                  style={{ borderColor: tool.border }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: tool.bg }}
                      >
                        <Icon size={20} style={{ color: tool.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="font-display font-bold text-base text-[#1A0A12]">
                            {tool.title}
                          </h2>
                          {tool.badge && (
                            <span
                              className="px-2 py-0.5 text-[10px] font-body font-semibold rounded-full"
                              style={{
                                backgroundColor: tool.bg,
                                color: tool.color,
                                border: `1px solid ${tool.border}`,
                              }}
                            >
                              {tool.badge}
                            </span>
                          )}
                          {isLocked && (
                            <Lock size={11} className="text-[#C4A0B0]" />
                          )}
                        </div>
                        <p className="font-body text-sm text-[#5A3040] leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-[#C4A0B0] group-hover:text-[#8B2252] transition-colors shrink-0 mt-1"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="mt-10 font-body text-xs text-[#C4A0B0] text-center">
          AfroPuppyYoga Staff Portal · For access issues contact{" "}
          <a href="mailto:afropuppyyogaofficial@gmail.com" className="underline hover:no-underline">
            afropuppyyogaofficial@gmail.com
          </a>
        </p>
      </main>
    </div>
  );
}
