/* ============================================================
   Partnerships Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   Features: View partnership inquiries, update status, filter by type
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Handshake,
  Loader2,
  Globe,
  Mail,
  Phone,
  Building2,
  User,
  Inbox,
  ExternalLink,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import AdminNav from "@/components/AdminNav";

type PartnerStatus = "new" | "reviewing" | "active" | "declined";

type PartnershipInquiry = {
  id: number;
  partnershipType: string;
  organizationName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  proposal: string;
  status: PartnerStatus;
  createdAt: Date;
};

const STATUS_LABELS: Record<PartnerStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  active: "Active",
  declined: "Declined",
};

const STATUS_COLORS: Record<PartnerStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200",
  active: "bg-green-50 text-green-700 border-green-200",
  declined: "bg-red-50 text-red-700 border-red-200",
};

const TYPE_COLORS: Record<string, string> = {
  "Corporate Wellness": "bg-purple-50 text-purple-700 border-purple-200",
  "Brand Collaboration": "bg-pink-50 text-pink-700 border-pink-200",
  "Media & Production": "bg-orange-50 text-orange-700 border-orange-200",
  "Local Business": "bg-teal-50 text-teal-700 border-teal-200",
  "Breeder Partnership": "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function PartnershipsDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [selectedInquiry, setSelectedInquiry] = useState<PartnershipInquiry | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: inquiries, isLoading, refetch } = trpc.partnership.getAll.useQuery();

  const updateStatusMutation = trpc.partnership.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
      if (selectedInquiry) {
        setSelectedInquiry((prev) =>
          prev ? { ...prev, status: updateStatusMutation.variables?.status as PartnerStatus } : null
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
          <p className="font-body text-sm text-[#3D1A2E] mb-4">Please sign in to access the Partnerships Dashboard.</p>
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
          <p className="font-body text-sm text-[#3D1A2E]">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const filtered = (inquiries ?? []).filter((inq) => {
    const typeMatch = filterType === "all" || inq.partnershipType === filterType;
    const statusMatch = filterStatus === "all" || inq.status === filterStatus;
    return typeMatch && statusMatch;
  });

  const counts = {
    total: inquiries?.length ?? 0,
    new: inquiries?.filter((i) => i.status === "new").length ?? 0,
    reviewing: inquiries?.filter((i) => i.status === "reviewing").length ?? 0,
    active: inquiries?.filter((i) => i.status === "active").length ?? 0,
    declined: inquiries?.filter((i) => i.status === "declined").length ?? 0,
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
            <Handshake className="w-7 h-7 text-[#8B2252]" />
            <h1 className="font-display font-bold text-3xl text-[#1A0A12]">Partnership Inquiries</h1>
          </div>
          <p className="font-body text-sm text-[#3D1A2E]">
            Review and manage all incoming partnership inquiries.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "New", value: counts.new, color: "text-blue-600" },
            { label: "Reviewing", value: counts.reviewing, color: "text-amber-600" },
            { label: "Active", value: counts.active, color: "text-green-600" },
            { label: "Declined", value: counts.declined, color: "text-red-500" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-[#F0D0DC] rounded-2xl p-4">
              <p className="font-body text-xs text-[#3D1A2E] mb-1">{stat.label}</p>
              <p className={`font-display font-bold text-2xl ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48 font-body text-sm border-[#F0D0DC]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Corporate Wellness">Corporate Wellness</SelectItem>
              <SelectItem value="Brand Collaboration">Brand Collaboration</SelectItem>
              <SelectItem value="Media & Production">Media & Production</SelectItem>
              <SelectItem value="Local Business">Local Business</SelectItem>
              <SelectItem value="Breeder Partnership">Breeder Partnership</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 font-body text-sm border-[#F0D0DC]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
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
            <p className="font-body text-sm text-[#3D1A2E]">
              {counts.total === 0 ? "No partnership inquiries have been submitted yet." : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#F0D0DC] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0D0DC] bg-[#FFF5F8]">
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Organization</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Contact</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 font-body font-semibold text-xs text-[#8B2252] uppercase tracking-wider">Date</th>
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
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#C4A0B0] shrink-0" />
                          <span className="font-body font-semibold text-sm text-[#1A0A12]">{inq.organizationName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 text-xs font-body font-semibold rounded-full border ${TYPE_COLORS[inq.partnershipType] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {inq.partnershipType}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-body text-sm text-[#1A0A12]">{inq.contactName}</p>
                        <p className="font-body text-xs text-[#3D1A2E]">{inq.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 text-xs font-body font-semibold rounded-full border ${STATUS_COLORS[inq.status]}`}>
                          {STATUS_LABELS[inq.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-body text-xs text-[#3D1A2E]">
                        {new Date(inq.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-body text-xs border-[#F0D0DC] text-[#8B2252] hover:bg-[#FFF5F8]"
                          onClick={() => setSelectedInquiry(inq as PartnershipInquiry)}
                        >
                          View
                        </Button>
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
        <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display font-bold text-xl text-[#1A0A12]">
                {selectedInquiry.organizationName}
              </DialogTitle>
              <DialogDescription className="font-body text-sm text-[#3D1A2E]">
                {selectedInquiry.partnershipType} inquiry
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-[#C4A0B0] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body text-xs text-[#3D1A2E]">Contact</p>
                    <p className="font-body text-sm font-semibold text-[#1A0A12]">{selectedInquiry.contactName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-[#C4A0B0] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body text-xs text-[#3D1A2E]">Email</p>
                    <a href={`mailto:${selectedInquiry.email}`} className="font-body text-sm font-semibold text-[#8B2252] hover:underline">
                      {selectedInquiry.email}
                    </a>
                  </div>
                </div>
                {selectedInquiry.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-[#C4A0B0] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-body text-xs text-[#3D1A2E]">Phone</p>
                      <p className="font-body text-sm font-semibold text-[#1A0A12]">{selectedInquiry.phone}</p>
                    </div>
                  </div>
                )}
                {selectedInquiry.website && (
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-[#C4A0B0] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-body text-xs text-[#3D1A2E]">Website</p>
                      <a
                        href={selectedInquiry.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-sm font-semibold text-[#8B2252] hover:underline flex items-center gap-1"
                      >
                        Visit <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Proposal */}
              <div>
                <p className="font-body text-xs font-semibold text-[#3D1A2E] uppercase tracking-wider mb-2">Proposal</p>
                <div className="bg-[#FFF5F8] border border-[#F0D0DC] rounded-xl p-4">
                  <p className="font-body text-sm text-[#1A0A12] leading-relaxed whitespace-pre-wrap">{selectedInquiry.proposal}</p>
                </div>
              </div>

              {/* Status update */}
              <div>
                <p className="font-body text-xs font-semibold text-[#3D1A2E] uppercase tracking-wider mb-2">Update Status</p>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedInquiry.status}
                    onValueChange={(val) => {
                      updateStatusMutation.mutate({ id: selectedInquiry.id, status: val as PartnerStatus });
                      setSelectedInquiry((prev) => prev ? { ...prev, status: val as PartnerStatus } : null);
                    }}
                  >
                    <SelectTrigger className="w-44 font-body text-sm border-[#F0D0DC]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewing">Reviewing</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                  {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-[#8B2252]" />}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
