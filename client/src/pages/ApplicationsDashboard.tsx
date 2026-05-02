/* ============================================================
   Applications Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   ============================================================ */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Loader2, RefreshCw, Video, Mail, Phone, Star, Eye, XCircle, Inbox } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

type AppStatus = "new" | "reviewed" | "shortlisted" | "rejected";

function StatusBadge({ status }: { status: AppStatus }) {
  const styles: Record<AppStatus, string> = {
    new: "bg-blue-100 text-blue-700",
    reviewed: "bg-yellow-100 text-yellow-700",
    shortlisted: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-600",
  };
  const icons: Record<AppStatus, React.ReactNode> = {
    new: <Inbox className="w-3 h-3" />,
    reviewed: <Eye className="w-3 h-3" />,
    shortlisted: <Star className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  };
  const labels: Record<AppStatus, string> = {
    new: "New",
    reviewed: "Reviewed",
    shortlisted: "Shortlisted",
    rejected: "Rejected",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold ${styles[status]}`}>
      {icons[status]} {labels[status]}
    </span>
  );
}

export default function ApplicationsDashboard() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const { data: applications, isLoading, refetch } = trpc.careers.list.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const updateStatus = trpc.careers.updateStatus.useMutation({
    onSuccess: () => utils.careers.list.invalidate(),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Admin Access Required</h2>
        <p className="font-body text-[#6B4C3B] mb-6">Please log in to view applications.</p>
        <button
          onClick={() => window.location.href = getLoginUrl("/admin/applications")}
          className="inline-flex items-center px-6 py-3 font-body font-semibold text-sm rounded-full text-white transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #e91e8c, #c2410c)" }}
        >
          Log In
        </button>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Access Denied</h2>
        <p className="font-body text-[#6B4C3B]">This page is for admins only.</p>
      </div>
    );
  }

  const newCount = applications?.filter((a) => a.status === "new").length ?? 0;
  const shortlistedCount = applications?.filter((a) => a.status === "shortlisted").length ?? 0;
  const totalCount = applications?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      {/* Header */}
      <header className="bg-[#FFF5F8] border-b border-[#F0D0DC] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
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

          <div className="flex items-center gap-3">
            <Link href="/admin/invoices">
              <a className="inline-flex items-center gap-2 px-4 py-2 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#8B2252] bg-white hover:bg-[#FFF0F4] transition-colors">
                Invoices
              </a>
            </Link>
            <Link href="/careers">
              <a className="inline-flex items-center gap-2 px-4 py-2 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#8B2252] bg-white hover:bg-[#FFF0F4] transition-colors">
                Careers Page
              </a>
            </Link>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#6B4C3B] bg-white hover:bg-[#FFF0F4] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Page title */}
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-[#8B2252]" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252]">Admin</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1A0A12]">Job Applications</h1>
          <p className="font-body text-sm text-[#6B4C3B] mt-1">Review and manage applicants for all open positions</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-[#F0D0DC]">
            <p className="font-body text-sm text-[#6B4C3B] mb-2">Total Applications</p>
            <p className="font-display font-bold text-4xl text-[#1A0A12]">{totalCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-blue-200">
            <p className="font-body text-sm text-blue-500 mb-2">New (Unreviewed)</p>
            <p className="font-display font-bold text-4xl text-blue-600">{newCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-emerald-200">
            <p className="font-body text-sm text-emerald-600 mb-2">Shortlisted</p>
            <p className="font-display font-bold text-4xl text-emerald-600">{shortlistedCount}</p>
          </div>
        </div>

        {/* Applications table */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
            </div>
          ) : !applications || applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF0F4] flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-[#8B2252]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#1A0A12] mb-2">No applications yet</h3>
              <p className="font-body text-[#6B4C3B] text-sm">
                Applications submitted through the careers page will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FFF5F8] border-b border-[#F0D0DC]">
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Applicant</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Role</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Location</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Contact</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Video</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Applied</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app, idx) => (
                    <tr
                      key={app.id}
                      className={`border-b border-[#F0D0DC] last:border-0 transition-colors hover:bg-[#FFF5F8] ${idx % 2 === 0 ? "" : "bg-[#FEFAF4]"}`}
                    >
                      {/* Applicant */}
                      <td className="px-5 py-4">
                        <p className="font-body font-semibold text-sm text-[#1A0A12]">{app.name}</p>
                        {app.whyAPY && (
                          <p className="font-body text-xs text-[#6B4C3B] mt-0.5 max-w-[200px] truncate" title={app.whyAPY}>
                            {app.whyAPY}
                          </p>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4 font-body text-sm text-[#6B4C3B]">{app.role}</td>

                      {/* Location */}
                      <td className="px-5 py-4 font-body text-sm text-[#6B4C3B]">{app.location}</td>

                      {/* Contact */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <a
                            href={`mailto:${app.email}`}
                            className="flex items-center gap-1.5 font-body text-xs text-[#8B2252] hover:underline"
                          >
                            <Mail className="w-3 h-3 shrink-0" />
                            {app.email}
                          </a>
                          {app.phone && (
                            <a
                              href={`tel:${app.phone}`}
                              className="flex items-center gap-1.5 font-body text-xs text-[#6B4C3B] hover:underline"
                            >
                              <Phone className="w-3 h-3 shrink-0" />
                              {app.phone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Video */}
                      <td className="px-5 py-4">
                        {app.videoUrl ? (
                          <a
                            href={app.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF0F4] border border-[#F0D0DC] rounded-lg font-body text-xs font-semibold text-[#8B2252] hover:bg-[#F9E4EE] transition-colors"
                          >
                            <Video className="w-3 h-3" />
                            Watch
                          </a>
                        ) : (
                          <span className="font-body text-xs text-[#C4A0B0] italic">No video</span>
                        )}
                      </td>

                      {/* Applied date */}
                      <td className="px-5 py-4 font-body text-xs text-[#6B4C3B]">
                        {new Date(app.createdAt).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <Select
                          value={app.status}
                          onValueChange={(val) =>
                            updateStatus.mutate({ id: app.id, status: val as AppStatus })
                          }
                        >
                          <SelectTrigger className="w-36 h-8 text-xs font-body border-[#F0D0DC] bg-white">
                            <SelectValue>
                              <StatusBadge status={app.status as AppStatus} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="shortlisted">Shortlisted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
