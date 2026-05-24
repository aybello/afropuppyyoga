/* ============================================================
   Private Events Inquiries Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   Features: View all inquiries, update status, add admin notes, filter by status/package
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Mail,
  Phone,
  MapPin,
  Users,
  Calendar,
  Inbox,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import AdminNav from "@/components/AdminNav";

type InquiryStatus = "new" | "contacted" | "confirmed" | "cancelled";

type PrivateEventInquiry = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  eventType: string;
  guests: number;
  location: string;
  packageType: string;
  preferredDate: string | null;
  notes: string | null;
  estimatedMin: number;
  estimatedMax: number;
  status: InquiryStatus;
  adminNotes: string | null;
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

const PACKAGE_COLORS: Record<string, string> = {
  classic: "bg-[#8B2252]/10 text-[#8B2252] border-[#8B2252]/20",
  signature: "bg-[#F2A0B8]/20 text-[#8B2252] border-[#F2A0B8]/40",
  luxury: "bg-[#1A0A12]/10 text-[#1A0A12] border-[#1A0A12]/20",
};

const PACKAGE_LABELS: Record<string, string> = {
  classic: "Classic Experience",
  signature: "Signature Experience",
  luxury: "Luxury Experience",
};

export default function PrivateEventsDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [selectedInquiry, setSelectedInquiry] = useState<PrivateEventInquiry | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPackage, setFilterPackage] = useState<string>("all");
  const [newStatus, setNewStatus] = useState<InquiryStatus>("new");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const utils = trpc.useUtils();
  const { data: inquiries, isLoading } = trpc.privateEvents.listInquiries.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const updateStatus = trpc.privateEvents.updateStatus.useMutation({
    onSuccess: () => {
      utils.privateEvents.listInquiries.invalidate();
      toast.success("Inquiry updated successfully");
      setSelectedInquiry(null);
      setIsSaving(false);
    },
    onError: () => {
      toast.error("Failed to update inquiry");
      setIsSaving(false);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "staff")) {
    window.location.href = getLoginUrl("/admin/private-events");
    return null;
  }

  const filtered = (inquiries ?? []).filter((inq) => {
    const statusMatch = filterStatus === "all" || inq.status === filterStatus;
    const packageMatch = filterPackage === "all" || inq.packageType === filterPackage;
    return statusMatch && packageMatch;
  });

  const newCount = (inquiries ?? []).filter((i) => i.status === "new").length;

  function openInquiry(inq: PrivateEventInquiry) {
    setSelectedInquiry(inq);
    setNewStatus(inq.status);
    setAdminNotes(inq.adminNotes ?? "");
  }

  function handleSave() {
    if (!selectedInquiry) return;
    setIsSaving(true);
    updateStatus.mutate({
      id: selectedInquiry.id,
      status: newStatus,
      adminNotes,
    });
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      <div className="container py-10 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-[#F2A0B8]" />
              <span className="text-[#8B2252] font-body text-xs font-semibold tracking-widest uppercase">
                Admin Portal
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold text-[#1A0A12]">
              Private Event Inquiries
            </h1>
            <p className="font-body text-[#3D1A2E]/55 text-sm mt-1">
              All inquiries submitted through the quote form — never miss a booking.
            </p>
          </div>
          {newCount > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-body text-sm font-semibold text-blue-700">
                {newCount} new {newCount === 1 ? "inquiry" : "inquiries"}
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 border-[#F2A0B8]/40 font-body text-sm">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPackage} onValueChange={setFilterPackage}>
            <SelectTrigger className="w-52 border-[#F2A0B8]/40 font-body text-sm">
              <SelectValue placeholder="Filter by package" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              <SelectItem value="classic">Classic Experience</SelectItem>
              <SelectItem value="signature">Signature Experience</SelectItem>
              <SelectItem value="luxury">Luxury Experience</SelectItem>
            </SelectContent>
          </Select>

          <span className="ml-auto font-body text-sm text-[#3D1A2E]/50 self-center">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </span>
        </div>

        {/* Inquiry list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F2A0B8]/20 flex items-center justify-center mb-4">
              <Inbox size={28} className="text-[#8B2252]" />
            </div>
            <p className="font-display text-lg font-bold text-[#1A0A12] mb-1">No inquiries yet</p>
            <p className="font-body text-[#3D1A2E]/50 text-sm">
              Inquiries submitted through the quote form will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inq) => (
              <button
                key={inq.id}
                onClick={() => openInquiry(inq as PrivateEventInquiry)}
                className="w-full text-left bg-white rounded-2xl border border-[#F2A0B8]/20 p-5 hover:border-[#F2A0B8]/60 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-body font-semibold border ${STATUS_COLORS[inq.status as InquiryStatus]}`}>
                        {STATUS_LABELS[inq.status as InquiryStatus]}
                      </span>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-body font-semibold border ${PACKAGE_COLORS[inq.packageType] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
                        {PACKAGE_LABELS[inq.packageType] ?? inq.packageType}
                      </span>
                      <span className="font-body text-xs text-[#3D1A2E]/40">
                        {new Date(inq.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="font-display font-bold text-[#1A0A12]">{inq.name}</span>
                      <span className="flex items-center gap-1 font-body text-sm text-[#3D1A2E]/60">
                        <Users size={13} /> {inq.guests} guests
                      </span>
                      <span className="flex items-center gap-1 font-body text-sm text-[#3D1A2E]/60">
                        <MapPin size={13} /> {inq.location}
                      </span>
                      {inq.preferredDate && (
                        <span className="flex items-center gap-1 font-body text-sm text-[#3D1A2E]/60">
                          <Calendar size={13} /> {inq.preferredDate}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 font-body text-sm text-[#3D1A2E]/50">
                        <Mail size={13} /> {inq.email}
                      </span>
                      {inq.phone && (
                        <span className="flex items-center gap-1 font-body text-sm text-[#3D1A2E]/50">
                          <Phone size={13} /> {inq.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-display font-bold text-[#1A0A12] text-lg">
                      ${inq.estimatedMin.toLocaleString()}
                      {inq.estimatedMax > inq.estimatedMin ? `–$${inq.estimatedMax.toLocaleString()}` : "+"}
                    </span>
                    <ChevronRight size={16} className="text-[#F2A0B8] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedInquiry} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              {selectedInquiry?.name}
            </DialogTitle>
            <DialogDescription className="font-body text-[#3D1A2E]/55 text-sm">
              {selectedInquiry?.eventType} &bull; {selectedInquiry?.location} &bull; {selectedInquiry?.guests} guests
            </DialogDescription>
          </DialogHeader>

          {selectedInquiry && (
            <div className="space-y-5 mt-2">
              {/* Contact info */}
              <div className="space-y-2">
                <p className="font-body text-xs font-semibold text-[#3D1A2E]/50 uppercase tracking-wider">Contact</p>
                <div className="flex items-center gap-2 font-body text-sm text-[#1A0A12]">
                  <Mail size={14} className="text-[#F2A0B8]" />
                  <a href={`mailto:${selectedInquiry.email}`} className="text-[#8B2252] hover:underline">{selectedInquiry.email}</a>
                </div>
                {selectedInquiry.phone && (
                  <div className="flex items-center gap-2 font-body text-sm text-[#1A0A12]">
                    <Phone size={14} className="text-[#F2A0B8]" />
                    <a href={`tel:${selectedInquiry.phone}`} className="hover:underline">{selectedInquiry.phone}</a>
                  </div>
                )}
              </div>

              {/* Event details */}
              <div className="bg-[#FFF5F8] rounded-xl p-4 space-y-2">
                <p className="font-body text-xs font-semibold text-[#3D1A2E]/50 uppercase tracking-wider mb-3">Event Details</p>
                {[
                  ["Package", PACKAGE_LABELS[selectedInquiry.packageType] ?? selectedInquiry.packageType],
                  ["Guests", String(selectedInquiry.guests)],
                  ["Location", selectedInquiry.location],
                  ["Preferred Date", selectedInquiry.preferredDate || "Not specified"],
                  ["Estimated Quote", `$${selectedInquiry.estimatedMin.toLocaleString()}–$${selectedInquiry.estimatedMax.toLocaleString()} CAD`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm font-body">
                    <span className="text-[#3D1A2E]/55 font-medium">{label}</span>
                    <span className="text-[#1A0A12] font-semibold text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
              </div>

              {/* Notes from client */}
              {selectedInquiry.notes && (
                <div>
                  <p className="font-body text-xs font-semibold text-[#3D1A2E]/50 uppercase tracking-wider mb-2">Client Notes</p>
                  <p className="font-body text-sm text-[#3D1A2E]/70 bg-white border border-[#F2A0B8]/20 rounded-xl p-3">
                    {selectedInquiry.notes}
                  </p>
                </div>
              )}

              {/* Status update */}
              <div>
                <p className="font-body text-xs font-semibold text-[#3D1A2E]/50 uppercase tracking-wider mb-2">Update Status</p>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as InquiryStatus)}>
                  <SelectTrigger className="border-[#F2A0B8]/40 font-body text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Admin notes */}
              <div>
                <p className="font-body text-xs font-semibold text-[#3D1A2E]/50 uppercase tracking-wider mb-2">Admin Notes</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes (e.g. 'Called back May 23, confirmed for June 14')"
                  className="border-[#F2A0B8]/40 focus:border-[#8B2252] font-body text-sm min-h-[80px] resize-none"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-[#8B2252] hover:bg-[#6B1A3F] text-white font-body font-bold rounded-full"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
