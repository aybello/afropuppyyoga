/* ============================================================
   Birthday Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   Features: View birthday inquiries, update status, filter by tier/location
   Access: admin and staff roles
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Cake,
  Loader2,
  Mail,
  Phone,
  Users,
  MapPin,
  Inbox,
  CalendarDays,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import AdminNav from "@/components/AdminNav";

type InquiryStatus = "new" | "contacted" | "confirmed" | "cancelled";

type BirthdayInquiry = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  preferredDate: string;
  location: "KW" | "Hamilton";
  tier: "Basic" | "Premium" | "Deluxe";
  groupSize: number;
  message: string | null;
  status: InquiryStatus;
  createdAt: Date;
};

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const TIER_COLORS: Record<string, string> = {
  Basic: "bg-gray-50 text-gray-700 border-gray-200",
  Premium: "bg-purple-50 text-purple-700 border-purple-200",
  Deluxe: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function BirthdayDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [selectedInquiry, setSelectedInquiry] = useState<BirthdayInquiry | null>(null);
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");

  const { data: inquiries, isLoading, refetch } = trpc.birthday.getAll.useQuery();

  const updateStatusMutation = trpc.birthday.updateStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success("Status updated");
      refetch();
      if (selectedInquiry) {
        setSelectedInquiry((prev) =>
          prev ? { ...prev, status: vars.status as InquiryStatus } : null
        );
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Auth guard
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Login Required</h2>
          <p className="font-body text-sm text-[#5A3040] mb-4">Please sign in to access the Birthday Dashboard.</p>
          <a href={getLoginUrl()} className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B2252] text-white rounded-full font-body font-semibold text-sm">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin" && user?.role !== "staff") {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Access Denied</h2>
          <p className="font-body text-sm text-[#5A3040]">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const filtered = (inquiries ?? []).filter((inq) => {
    const tierMatch = filterTier === "all" || inq.tier === filterTier;
    const statusMatch = filterStatus === "all" || inq.status === filterStatus;
    const locationMatch = filterLocation === "all" || inq.location === filterLocation;
    return tierMatch && statusMatch && locationMatch;
  });

  const counts = {
    total: inquiries?.length ?? 0,
    new: inquiries?.filter((i) => i.status === "new").length ?? 0,
    contacted: inquiries?.filter((i) => i.status === "contacted").length ?? 0,
    confirmed: inquiries?.filter((i) => i.status === "confirmed").length ?? 0,
    cancelled: inquiries?.filter((i) => i.status === "cancelled").length ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-widest mb-2">
            Admin Portal
          </p>
          <div className="flex items-center gap-3 mb-1">
            <Cake className="w-7 h-7 text-[#8B2252]" />
            <h1 className="font-display font-bold text-3xl text-[#1A0A12]">Birthday Inquiries</h1>
          </div>
          <p className="font-body text-sm text-[#5A3040]">
            Review and manage all incoming birthday package inquiries.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "New", value: counts.new, color: "text-blue-600" },
            { label: "Contacted", value: counts.contacted, color: "text-amber-600" },
            { label: "Confirmed", value: counts.confirmed, color: "text-green-600" },
            { label: "Cancelled", value: counts.cancelled, color: "text-red-500" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-[#F0D0DC] rounded-2xl p-4">
              <p className="font-body text-xs text-[#8B6070] mb-1">{stat.label}</p>
              <p className={`font-display font-bold text-2xl ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-40 font-body text-sm border-[#F0D0DC]">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="Basic">Basic</SelectItem>
              <SelectItem value="Premium">Premium</SelectItem>
              <SelectItem value="Deluxe">Deluxe</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-40 font-body text-sm border-[#F0D0DC]">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="KW">Kitchener-Waterloo</SelectItem>
              <SelectItem value="Hamilton">Hamilton</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 font-body text-sm border-[#F0D0DC]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="w-12 h-12 text-[#C4A0B0] mb-4" />
            <p className="font-display font-bold text-lg text-[#1A0A12] mb-1">No inquiries found</p>
            <p className="font-body text-sm text-[#8B6070]">
              {counts.total === 0 ? "No birthday inquiries have been submitted yet." : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#F0D0DC] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0D0DC] bg-[#FFF5F8]">
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Tier</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Location</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Guests</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inq, idx) => (
                    <tr
                      key={inq.id}
                      className={`border-b border-[#F9EEF2] hover:bg-[#FFF5F8] transition-colors ${idx % 2 === 0 ? "" : "bg-[#FEFAF4]"}`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-body font-semibold text-sm text-[#1A0A12]">{inq.name}</p>
                        <p className="font-body text-xs text-[#8B6070]">{inq.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 text-xs font-body font-semibold rounded-full border ${TIER_COLORS[inq.tier] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {inq.tier}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#C4A0B0]" />
                          <span className="font-body text-sm text-[#1A0A12]">{inq.location === "KW" ? "Kitchener-Waterloo" : "Hamilton"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-[#C4A0B0]" />
                          <span className="font-body text-sm text-[#1A0A12]">{inq.preferredDate}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#C4A0B0]" />
                          <span className="font-body text-sm text-[#1A0A12]">{inq.groupSize}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 text-xs font-body font-semibold rounded-full border ${STATUS_COLORS[inq.status]}`}>
                          {STATUS_LABELS[inq.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedInquiry(inq as BirthdayInquiry)}
                          className="px-3 py-1.5 text-xs font-body font-semibold text-[#8B2252] border border-[#8B2252] rounded-full hover:bg-[#8B2252] hover:text-white transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      {selectedInquiry && (
        <Dialog open={!!selectedInquiry} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
          <DialogContent className="max-w-lg bg-[#FEFAF4] border-[#F0D0DC]">
            <DialogHeader>
              <DialogTitle className="font-display font-bold text-xl text-[#1A0A12] flex items-center gap-2">
                <Cake className="w-5 h-5 text-[#8B2252]" />
                Birthday Inquiry — {selectedInquiry.name}
              </DialogTitle>
              <DialogDescription className="font-body text-sm text-[#8B6070]">
                Submitted {new Date(selectedInquiry.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Contact info */}
              <div className="bg-white rounded-xl border border-[#F0D0DC] p-4 space-y-2">
                <p className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-wider mb-3">Contact</p>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#C4A0B0]" />
                  <a href={`mailto:${selectedInquiry.email}`} className="font-body text-sm text-[#1A0A12] hover:underline">{selectedInquiry.email}</a>
                </div>
                {selectedInquiry.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#C4A0B0]" />
                    <span className="font-body text-sm text-[#1A0A12]">{selectedInquiry.phone}</span>
                  </div>
                )}
              </div>

              {/* Event details */}
              <div className="bg-white rounded-xl border border-[#F0D0DC] p-4 space-y-2">
                <p className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-wider mb-3">Event Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-body text-xs text-[#8B6070]">Package Tier</p>
                    <span className={`px-2 py-0.5 text-xs font-body font-semibold rounded-full border ${TIER_COLORS[selectedInquiry.tier]}`}>
                      {selectedInquiry.tier}
                    </span>
                  </div>
                  <div>
                    <p className="font-body text-xs text-[#8B6070]">Location</p>
                    <p className="font-body text-sm font-semibold text-[#1A0A12]">{selectedInquiry.location === "KW" ? "Kitchener-Waterloo" : "Hamilton"}</p>
                  </div>
                  <div>
                    <p className="font-body text-xs text-[#8B6070]">Preferred Date</p>
                    <p className="font-body text-sm font-semibold text-[#1A0A12]">{selectedInquiry.preferredDate}</p>
                  </div>
                  <div>
                    <p className="font-body text-xs text-[#8B6070]">Group Size</p>
                    <p className="font-body text-sm font-semibold text-[#1A0A12]">{selectedInquiry.groupSize} guests</p>
                  </div>
                </div>
              </div>

              {/* Message */}
              {selectedInquiry.message && (
                <div className="bg-white rounded-xl border border-[#F0D0DC] p-4">
                  <p className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-wider mb-2">Additional Notes</p>
                  <p className="font-body text-sm text-[#1A0A12] whitespace-pre-wrap">{selectedInquiry.message}</p>
                </div>
              )}

              {/* Status update */}
              <div className="bg-white rounded-xl border border-[#F0D0DC] p-4">
                <p className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-wider mb-3">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {(["new", "contacted", "confirmed", "cancelled"] as InquiryStatus[]).map((s) => (
                    <button
                      key={s}
                      disabled={updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ id: selectedInquiry.id, status: s })}
                      className={`px-3 py-1.5 text-xs font-body font-semibold rounded-full border transition-colors ${
                        selectedInquiry.status === s
                          ? STATUS_COLORS[s] + " opacity-100"
                          : "bg-white text-[#8B6070] border-[#E0C0CC] hover:bg-[#FFF5F8]"
                      }`}
                    >
                      {updateStatusMutation.isPending && updateStatusMutation.variables?.status === s ? (
                        <Loader2 className="w-3 h-3 animate-spin inline" />
                      ) : (
                        STATUS_LABELS[s]
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
