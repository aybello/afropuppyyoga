/* ============================================================
   Private Events Inquiries Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   Features: View all inquiries, update status, add admin notes, filter by status/package,
             Generate Luma booking link, send quote email
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
import { Input } from "@/components/ui/input";
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
  Link2,
  Send,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Trash2,
  Clock,
  Building2,
  PawPrint,
  StickyNote,
  Zap,
  UserCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import AdminNav from "@/components/AdminNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InquiryStatus = "new" | "contacted" | "confirmed" | "cancelled" | "quote_sent" | "booked";

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
  finalPriceCents: number | null;
  hstCents: number | null;
  pricingType: string | null;
  sessions: number | null;
  puppyBreed: string | null;
  organization: string | null;
  lumaEventUrl: string | null;
  lumaEventId: string | null;
  ownerApproved: boolean | null;
  quoteSentAt: Date | null;
  createdAt: Date;
};

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  quote_sent: "Quote Sent",
  booked: "Booked",
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  quote_sent: "bg-purple-50 text-purple-700 border-purple-200",
  booked: "bg-emerald-50 text-emerald-700 border-emerald-200",
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

  // Page-level tab state (support ?tab=quick-link URL param)
  const [activeTab, setActiveTab] = useState<"inquiries" | "quick-link">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "quick-link" ? "quick-link" : "inquiries";
  });

  // Booking link generator state
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    finalPrice: "",
    pricingType: "plus_hst" as "plus_hst" | "all_in",
    sessions: "1",
    puppyBreed: "",
    organization: "",
    eventDate: "",
    startTime: "14:00",
    endTime: "15:30",
    customLocation: "",
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Quick Booking Link standalone state
  const [quickForm, setQuickForm] = useState({
    clientName: "",
    organization: "",
    eventType: "Team Building",
    eventDate: "",
    sessions: "1",
    maxCapacity: "20",
    finalPrice: "",
    pricingType: "plus_hst" as "plus_hst" | "all_in",
    puppyBreed: "",
    location: "hamilton",
    customLocation: "",
    notes: "",
    sessionSchedule: [{ startTime: "11:00", endTime: "12:00" }] as Array<{ startTime: string; endTime: string }>,
  });
  const [quickGeneratedLink, setQuickGeneratedLink] = useState<string | null>(null);
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);

  // Quote email state
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

  const generateBooking = trpc.privateEvents.generateBookingLink.useMutation({
    onSuccess: (data) => {
      utils.privateEvents.listInquiries.invalidate();
      setGeneratedLink(data.eventUrl);
      setIsGenerating(false);
      if (data.needsApproval) {
        toast.info("Booking link generated — Owner approval recommended (discount or large event)");
      } else {
        toast.success("Booking link generated successfully!");
      }
    },
    onError: (err) => {
      toast.error(`Failed to generate link: ${err.message}`);
      setIsGenerating(false);
    },
  });

  const sendQuoteEmail = trpc.privateEvents.sendQuoteEmail.useMutation({
    onSuccess: () => {
      utils.privateEvents.listInquiries.invalidate();
      toast.success("Quote email sent successfully!");
      setShowEmailPanel(false);
      setIsSendingEmail(false);
      setSelectedInquiry(null);
    },
    onError: (err) => {
      toast.error(`Failed to send email: ${err.message}`);
      setIsSendingEmail(false);
    },
  });

  const generateQuickLink = trpc.privateEvents.generateQuickBookingLink.useMutation({
    onSuccess: (data) => {
      setQuickGeneratedLink(data.eventUrl);
      setIsQuickGenerating(false);
      toast.success("Booking link generated!");
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
      setIsQuickGenerating(false);
    },
  });

  const deleteLumaEvent = trpc.privateEvents.deleteLumaEvent.useMutation({
    onSuccess: () => {
      utils.privateEvents.listInquiries.invalidate();
      toast.success("Luma event deleted. Link removed.");
      setGeneratedLink(null);
      setShowBookingPanel(false);
    },
    onError: (err) => {
      toast.error(`Failed to delete: ${err.message}`);
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
    setShowBookingPanel(false);
    setShowEmailPanel(false);
    setGeneratedLink(inq.lumaEventUrl || null);
    // Pre-fill booking form from inquiry data
    setBookingForm({
      finalPrice: inq.finalPriceCents ? String(inq.finalPriceCents / 100) : String(inq.estimatedMin),
      pricingType: (inq.pricingType as "plus_hst" | "all_in") || "plus_hst",
      sessions: String(inq.sessions || 1),
      puppyBreed: inq.puppyBreed || "",
      organization: inq.organization || "",
      eventDate: inq.preferredDate || "",
      startTime: "14:00",
      endTime: "15:30",
      customLocation: "",
    });
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

  function handleGenerateLink() {
    if (!selectedInquiry) return;
    const price = parseFloat(bookingForm.finalPrice);
    if (!price || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (!bookingForm.eventDate) {
      toast.error("Please enter the event date");
      return;
    }
    setIsGenerating(true);
    generateBooking.mutate({
      inquiryId: selectedInquiry.id,
      finalPrice: price,
      pricingType: bookingForm.pricingType,
      sessions: parseInt(bookingForm.sessions) || 1,
      puppyBreed: bookingForm.puppyBreed || undefined,
      organization: bookingForm.organization || undefined,
      eventDate: bookingForm.eventDate,
      startTime: bookingForm.startTime,
      endTime: bookingForm.endTime,
      customLocation: bookingForm.customLocation.startsWith("__custom__")
        ? bookingForm.customLocation.replace("__custom__", "") || undefined
        : bookingForm.customLocation || undefined,
    });
  }

  function handleSendEmail() {
    if (!selectedInquiry) return;
    setIsSendingEmail(true);
    sendQuoteEmail.mutate({
      inquiryId: selectedInquiry.id,
      customMessage: customMessage || undefined,
    });
  }

  function copyLink() {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard");
    }
  }

  // Quick link handler
  function handleQuickGenerate() {
    if (!quickForm.clientName.trim()) { toast.error("Please enter the client name"); return; }
    if (!quickForm.eventDate) { toast.error("Please enter the event date"); return; }
    const price = parseFloat(quickForm.finalPrice);
    if (!price || price <= 0) { toast.error("Please enter a valid price"); return; }
    setIsQuickGenerating(true);
    generateQuickLink.mutate({
      clientName: quickForm.clientName,
      organization: quickForm.organization || undefined,
      eventType: quickForm.eventType,
      eventDate: quickForm.eventDate,
      sessions: parseInt(quickForm.sessions) || 1,
      sessionSchedule: quickForm.sessionSchedule,
      location: quickForm.location,
      customLocation: quickForm.customLocation.startsWith("__custom__")
        ? quickForm.customLocation.replace("__custom__", "") || undefined
        : quickForm.customLocation || undefined,
      maxCapacity: parseInt(quickForm.maxCapacity) || 20,
      finalPrice: price,
      pricingType: quickForm.pricingType,
      puppyBreed: quickForm.puppyBreed || undefined,
      notes: quickForm.notes || undefined,
    });
  }

  function addSession() {
    const last = quickForm.sessionSchedule[quickForm.sessionSchedule.length - 1];
    // Default: 30 min break after last session end
    const [h, m] = last.endTime.split(":").map(Number);
    const breakEnd = `${String(h).padStart(2, "0")}:${String(m + 30).padStart(2, "0")}`;
    const newEnd = `${String(h + 1).padStart(2, "0")}:${String(m + 30).padStart(2, "0")}`;
    setQuickForm({
      ...quickForm,
      sessions: String(quickForm.sessionSchedule.length + 1),
      sessionSchedule: [...quickForm.sessionSchedule, { startTime: breakEnd, endTime: newEnd }],
    });
  }

  function removeSession(idx: number) {
    const updated = quickForm.sessionSchedule.filter((_, i) => i !== idx);
    setQuickForm({ ...quickForm, sessions: String(updated.length), sessionSchedule: updated });
  }

  function updateSession(idx: number, field: "startTime" | "endTime", value: string) {
    const updated = [...quickForm.sessionSchedule];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuickForm({ ...quickForm, sessionSchedule: updated });
  }

  // Calculate HST preview
  const priceNum = parseFloat(bookingForm.finalPrice) || 0;
  const hstPreview = bookingForm.pricingType === "plus_hst"
    ? Math.round(priceNum * 13) / 100
    : Math.round((priceNum - priceNum / 1.13) * 100) / 100;
  const totalPreview = bookingForm.pricingType === "plus_hst"
    ? priceNum + hstPreview
    : priceNum;

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
              All inquiries submitted through the quote form — manage, generate booking links, and send quotes.
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "inquiries" | "quick-link")} className="mb-6">
          <TabsList className="bg-[#F2A0B8]/10 border border-[#F2A0B8]/20">
            <TabsTrigger value="inquiries" className="font-body text-sm data-[state=active]:bg-[#8B2252] data-[state=active]:text-white">
              Inquiries
            </TabsTrigger>
            <TabsTrigger value="quick-link" className="font-body text-sm data-[state=active]:bg-[#8B2252] data-[state=active]:text-white">
              Quick Booking Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inquiries">

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
              <SelectItem value="quote_sent">Quote Sent</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
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
                      {inq.lumaEventUrl && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-body font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Luma Link Ready
                        </span>
                      )}
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
                      {inq.finalPriceCents
                        ? `$${(inq.finalPriceCents / 100).toLocaleString()}`
                        : `$${inq.estimatedMin.toLocaleString()}${inq.estimatedMax > inq.estimatedMin ? `–$${inq.estimatedMax.toLocaleString()}` : "+"}`
                      }
                    </span>
                    <ChevronRight size={16} className="text-[#F2A0B8] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

          </TabsContent>

          <TabsContent value="quick-link">
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-br from-[#8B2252]/5 via-white to-[#D4708A]/5 rounded-2xl border border-[#F2A0B8]/25 p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B2252] to-[#D4708A] flex items-center justify-center shadow-sm">
                    <Zap size={16} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#1A0A12]">Quick Booking Link</h2>
                    <p className="font-body text-xs text-[#3D1A2E]/50">Generate a private Luma event for deals via email, DMs, or phone</p>
                  </div>
                </div>
              </div>

              {quickGeneratedLink ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-body font-bold text-emerald-800">Booking Link Ready!</p>
                        <p className="font-body text-xs text-emerald-600/70">Share this with the client to complete their booking</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-xl border border-emerald-200/60 p-3 shadow-sm">
                      <a href={quickGeneratedLink} target="_blank" rel="noopener noreferrer" className="flex-1 font-body text-sm text-[#8B2252] underline truncate">
                        {quickGeneratedLink}
                      </a>
                      <Button size="sm" variant="outline" className="shrink-0 border-emerald-200 hover:bg-emerald-50" onClick={() => { navigator.clipboard.writeText(quickGeneratedLink); toast.success("Copied!"); }}>
                        <Copy size={14} className="mr-1" /> Copy
                      </Button>
                      <Button size="sm" variant="outline" className="shrink-0 border-emerald-200 hover:bg-emerald-50" asChild>
                        <a href={quickGeneratedLink} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a>
                      </Button>
                    </div>
                  </div>

                  {/* Email Template */}
                  <div className="bg-white rounded-2xl border border-[#F2A0B8]/20 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-[#8B2252]" />
                        <h3 className="font-display text-sm font-bold text-[#1A0A12]">Email Template</h3>
                      </div>
                      <Button size="sm" variant="outline" className="border-[#F2A0B8]/40 hover:bg-[#FFF5F8] font-body text-xs" onClick={() => {
                        const firstName = quickForm.clientName.split(" ")[0] || "[Name]";
                        const locationAddresses: Record<string, { street: string; city: string }> = {
                          kitchener: { street: "329 King Street East", city: "Kitchener, ON" },
                          hamilton: { street: "2751 Barton Street East", city: "Hamilton, ON" },
                          oakville: { street: "1670 North Service Road East", city: "Oakville, ON" },
                        };
                        const locationStudioNames: Record<string, string> = { kitchener: "Kitchener", hamilton: "Hamilton", oakville: "Oakville" };
                        const locAddr = quickForm.location !== "__custom__" ? locationAddresses[quickForm.location] : null;
                        const date = quickForm.eventDate ? new Date(quickForm.eventDate + "T00:00:00") : null;
                        const formattedDate = date ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "[DATE]";
                        const startTime = quickForm.sessionSchedule[0]?.startTime || "11:00";
                        const [h, m] = startTime.split(":").map(Number);
                        const ampm = h >= 12 ? "PM" : "AM";
                        const h12 = h % 12 || 12;
                        const formattedTime = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                        const guests = quickForm.maxCapacity || "20";
                        const sessions = quickForm.sessionSchedule.length;
                        const breed = quickForm.puppyBreed ? `${quickForm.puppyBreed} puppies` : "Puppies";

                        const subject = `Private AfroPuppyYoga Experience | ${date ? date.toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "[DATE]"} at ${formattedTime} \uD83D\uDC36`;

                        let locationBlock = "";
                        if (locAddr) {
                          locationBlock = `\n\nThe event will take place at our ${locationStudioNames[quickForm.location]} studio:\n\n${locAddr.street}\n${locAddr.city}`;
                        } else if (quickForm.customLocation) {
                          locationBlock = `\n\nThe event will take place at:\n\n${quickForm.customLocation}`;
                        }

                        const body = `Hi ${firstName},\n\nThank you for reaching out! We would love to host your group for a private AfroPuppyYoga experience on ${formattedDate} at ${formattedTime}.${locationBlock}\n\nThe Classic Experience for your group of ${guests} guests includes:\n\n\uD83D\uDC36 ${sessions > 1 ? `${sessions} private puppy yoga sessions` : "A private one-hour puppy yoga experience"}\n\uD83E\uDDD8 Beginner-friendly guided yoga instruction\n\uD83D\uDC3E ${breed} and dedicated puppy handlers\n\uD83D\uDC9B Supervised puppy interaction and playtime\n\uD83E\uDDD8 Yoga mats for participants\n\uD83C\uDFB6 Curated music\n\uD83E\uDDF4 Venue, setup and cleanup\n\nYou can secure the event using the private booking link below:\n\n${quickGeneratedLink}\n\nThe booking will be confirmed once payment is complete.\n\nWarmly,`;

                        const fullEmail = `Subject: ${subject}\n\n${body}`;
                        navigator.clipboard.writeText(fullEmail);
                        toast.success("Email template copied to clipboard!");
                      }}>
                        <Copy size={12} className="mr-1" /> Copy Email
                      </Button>
                    </div>
                    <div className="bg-[#FAFAFA] rounded-xl border border-[#F2A0B8]/10 p-4 font-body text-xs text-[#3D1A2E]/70 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {(() => {
                        const firstName = quickForm.clientName.split(" ")[0] || "[Name]";
                        const locationAddresses: Record<string, { street: string; city: string }> = {
                          kitchener: { street: "329 King Street East", city: "Kitchener, ON" },
                          hamilton: { street: "2751 Barton Street East", city: "Hamilton, ON" },
                          oakville: { street: "1670 North Service Road East", city: "Oakville, ON" },
                        };
                        const locationStudioNames: Record<string, string> = { kitchener: "Kitchener", hamilton: "Hamilton", oakville: "Oakville" };
                        const locAddr = quickForm.location !== "__custom__" ? locationAddresses[quickForm.location] : null;
                        const date = quickForm.eventDate ? new Date(quickForm.eventDate + "T00:00:00") : null;
                        const formattedDate = date ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "[DATE]";
                        const startTime = quickForm.sessionSchedule[0]?.startTime || "11:00";
                        const [h, m] = startTime.split(":").map(Number);
                        const ampm = h >= 12 ? "PM" : "AM";
                        const h12 = h % 12 || 12;
                        const formattedTime = `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                        const guests = quickForm.maxCapacity || "20";
                        const sessions = quickForm.sessionSchedule.length;
                        const breed = quickForm.puppyBreed ? `${quickForm.puppyBreed} puppies` : "Puppies";

                        let locationBlock = "";
                        if (locAddr) {
                          locationBlock = `\n\nThe event will take place at our ${locationStudioNames[quickForm.location]} studio:\n\n${locAddr.street}\n${locAddr.city}`;
                        } else if (quickForm.customLocation) {
                          locationBlock = `\n\nThe event will take place at:\n\n${quickForm.customLocation}`;
                        }

                        return `Subject: Private AfroPuppyYoga Experience | ${date ? date.toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "[DATE]"} at ${formattedTime} \uD83D\uDC36\n\nHi ${firstName},\n\nThank you for reaching out! We would love to host your group for a private AfroPuppyYoga experience on ${formattedDate} at ${formattedTime}.${locationBlock}\n\nThe Classic Experience for your group of ${guests} guests includes:\n\n\uD83D\uDC36 ${sessions > 1 ? `${sessions} private puppy yoga sessions` : "A private one-hour puppy yoga experience"}\n\uD83E\uDDD8 Beginner-friendly guided yoga instruction\n\uD83D\uDC3E ${breed} and dedicated puppy handlers\n\uD83D\uDC9B Supervised puppy interaction and playtime\n\uD83E\uDDD8 Yoga mats for participants\n\uD83C\uDFB6 Curated music\n\uD83E\uDDF4 Venue, setup and cleanup\n\nYou can secure the event using the private booking link below:\n\n${quickGeneratedLink}\n\nThe booking will be confirmed once payment is complete.\n\nWarmly,`;
                      })()}
                    </div>
                  </div>

                  <Button variant="outline" className="font-body border-[#F2A0B8]/40 hover:bg-[#FFF5F8]" onClick={() => { setQuickGeneratedLink(null); setQuickForm({ clientName: "", organization: "", eventType: "Team Building", eventDate: "", sessions: "1", maxCapacity: "20", finalPrice: "", pricingType: "plus_hst", puppyBreed: "", location: "hamilton", customLocation: "", notes: "", sessionSchedule: [{ startTime: "11:00", endTime: "12:00" }] }); }}>
                    <Sparkles size={14} className="mr-2" /> Generate Another Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Section 1: Client + Event */}
                  <div className="bg-white rounded-2xl border border-[#F2A0B8]/20 p-5 shadow-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Client Name *</label>
                        <Input value={quickForm.clientName} onChange={(e) => setQuickForm({ ...quickForm, clientName: e.target.value })} placeholder="e.g. Sidney Thompson" className="border-[#F2A0B8]/30 font-body bg-[#FAFAFA] focus:bg-white transition-colors" />
                      </div>
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Organization</label>
                        <Input value={quickForm.organization} onChange={(e) => setQuickForm({ ...quickForm, organization: e.target.value })} placeholder="e.g. Hamilton Girls Flag Football" className="border-[#F2A0B8]/30 font-body bg-[#FAFAFA] focus:bg-white transition-colors" />
                      </div>
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Event Type</label>
                        <Select value={quickForm.eventType} onValueChange={(v) => setQuickForm({ ...quickForm, eventType: v })}>
                          <SelectTrigger className="border-[#F2A0B8]/30 font-body text-sm bg-[#FAFAFA]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Team Building">Team Building</SelectItem>
                            <SelectItem value="Birthday">Birthday</SelectItem>
                            <SelectItem value="Bachelorette">Bachelorette</SelectItem>
                            <SelectItem value="Corporate">Corporate</SelectItem>
                            <SelectItem value="Baby Shower">Baby Shower</SelectItem>
                            <SelectItem value="School/Youth Group">School/Youth Group</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Event Date *</label>
                        <Input type="date" value={quickForm.eventDate} onChange={(e) => setQuickForm({ ...quickForm, eventDate: e.target.value })} className="border-[#F2A0B8]/30 font-body text-sm bg-[#FAFAFA] focus:bg-white transition-colors" />
                      </div>
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Max Guests</label>
                        <Input type="number" min="1" value={quickForm.maxCapacity} onChange={(e) => setQuickForm({ ...quickForm, maxCapacity: e.target.value })} className="border-[#F2A0B8]/30 font-body text-sm bg-[#FAFAFA] focus:bg-white transition-colors" />
                      </div>
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Puppy Breed</label>
                        <Input value={quickForm.puppyBreed} onChange={(e) => setQuickForm({ ...quickForm, puppyBreed: e.target.value })} placeholder="e.g. French Bulldog" className="border-[#F2A0B8]/30 font-body bg-[#FAFAFA] focus:bg-white transition-colors" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Schedule + Location */}
                  <div className="bg-white rounded-2xl border border-[#F2A0B8]/20 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-[#8B2252]" />
                        <h3 className="font-display text-sm font-bold text-[#1A0A12]">Schedule & Location</h3>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="text-[#8B2252] font-body text-xs hover:bg-[#FFF5F8] rounded-full px-3 h-7" onClick={addSession}>
                        + Add Session
                      </Button>
                    </div>
                    <div className="space-y-2 mb-4">
                      {quickForm.sessionSchedule.map((session, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-[#FAFAFA] rounded-lg p-2 border border-[#F2A0B8]/10">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#8B2252] to-[#D4708A] flex items-center justify-center shrink-0 text-white text-[9px] font-bold">{idx + 1}</span>
                          <Input type="time" value={session.startTime} onChange={(e) => updateSession(idx, "startTime", e.target.value)} className="border-[#F2A0B8]/30 font-body text-sm w-32 bg-white h-8" />
                          <span className="font-body text-xs text-[#3D1A2E]/40">to</span>
                          <Input type="time" value={session.endTime} onChange={(e) => updateSession(idx, "endTime", e.target.value)} className="border-[#F2A0B8]/30 font-body text-sm w-32 bg-white h-8" />
                          {quickForm.sessionSchedule.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" className="text-red-400 hover:text-red-600 text-xs px-2 h-7 ml-auto" onClick={() => removeSession(idx)}>Remove</Button>
                          )}
                        </div>
                      ))}
                      {quickForm.sessionSchedule.length > 1 && (
                        <p className="font-body text-[11px] text-[#3D1A2E]/40 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D4708A]/40"></span>
                          30-min puppy rest break between sessions
                        </p>
                      )}
                    </div>
                    <div className="border-t border-[#F2A0B8]/15 pt-3">
                      <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-2 block">Location</label>
                      <div className="grid grid-cols-4 gap-2">
                        {["kitchener", "hamilton", "oakville", "__custom__"].map((loc) => {
                          const labels: Record<string, string> = { kitchener: "Kitchener", hamilton: "Hamilton", oakville: "Oakville", __custom__: "Custom" };
                          const isSelected = quickForm.location === loc;
                          return (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => setQuickForm({ ...quickForm, location: loc, customLocation: loc === "__custom__" ? "" : "" })}
                              className={`text-center rounded-lg py-2 px-2 border text-xs font-body font-medium transition-all ${
                                isSelected
                                  ? "border-[#8B2252]/40 bg-[#FFF5F8] text-[#8B2252] shadow-sm"
                                  : "border-[#F2A0B8]/15 bg-[#FAFAFA] text-[#3D1A2E]/60 hover:border-[#F2A0B8]/40"
                              }`}
                            >
                              {labels[loc]}
                            </button>
                          );
                        })}
                      </div>
                      {quickForm.location === "__custom__" && (
                        <Input
                          value={quickForm.customLocation}
                          onChange={(e) => setQuickForm({ ...quickForm, customLocation: e.target.value })}
                          placeholder="e.g. 2751 Barton Street East, Hamilton, ON"
                          className="mt-2 border-[#F2A0B8]/30 font-body text-sm bg-[#FAFAFA] focus:bg-white transition-colors"
                        />
                      )}
                    </div>
                  </div>

                  {/* Section 3: Pricing + Notes + CTA */}
                  <div className="bg-white rounded-2xl border border-[#F2A0B8]/20 p-5 shadow-sm">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Base Price (CAD) *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-[#3D1A2E]/40">$</span>
                          <Input type="number" value={quickForm.finalPrice} onChange={(e) => setQuickForm({ ...quickForm, finalPrice: e.target.value })} placeholder="3000" className="border-[#F2A0B8]/30 font-body pl-7 bg-[#FAFAFA] focus:bg-white transition-colors" />
                        </div>
                      </div>
                      <div>
                        <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Pricing Type</label>
                        <Select value={quickForm.pricingType} onValueChange={(v) => setQuickForm({ ...quickForm, pricingType: v as "plus_hst" | "all_in" })}>
                          <SelectTrigger className="border-[#F2A0B8]/30 font-body text-sm bg-[#FAFAFA]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plus_hst">+ HST (13%)</SelectItem>
                            <SelectItem value="all_in">All-in (HST included)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {parseFloat(quickForm.finalPrice) > 0 && (
                      <div className="bg-[#FFF5F8] rounded-lg p-3 border border-[#F2A0B8]/15 mb-3">
                        <div className="flex justify-between text-xs font-body">
                          <span className="text-[#3D1A2E]/50">Base</span>
                          <span className="font-medium">${quickForm.pricingType === "plus_hst" ? parseFloat(quickForm.finalPrice).toLocaleString() : (parseFloat(quickForm.finalPrice) / 1.13).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-body mt-1">
                          <span className="text-[#3D1A2E]/50">HST (13%)</span>
                          <span className="font-medium">${quickForm.pricingType === "plus_hst" ? (parseFloat(quickForm.finalPrice) * 0.13).toFixed(2) : (parseFloat(quickForm.finalPrice) - parseFloat(quickForm.finalPrice) / 1.13).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-body font-bold border-t border-[#D4708A]/15 pt-2 mt-2">
                          <span className="text-[#1A0A12]">Total</span>
                          <span className="text-[#8B2252]">${quickForm.pricingType === "plus_hst" ? (parseFloat(quickForm.finalPrice) * 1.13).toFixed(2) : parseFloat(quickForm.finalPrice).toFixed(2)} CAD</span>
                        </div>
                      </div>
                    )}
                    <div className="mb-4">
                      <label className="font-body text-xs font-medium text-[#3D1A2E]/50 mb-1 block">Internal Notes <span className="text-[#3D1A2E]/30">(optional)</span></label>
                      <Textarea value={quickForm.notes} onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })} placeholder="Any extra details — not shown to the client..." className="border-[#F2A0B8]/30 font-body text-sm bg-[#FAFAFA] focus:bg-white transition-colors resize-none" rows={2} />
                    </div>
                    <Button
                      onClick={handleQuickGenerate}
                      disabled={isQuickGenerating}
                      className="w-full bg-gradient-to-r from-[#8B2252] to-[#D4708A] hover:from-[#6B1A40] hover:to-[#B85A74] text-white font-body font-bold rounded-full py-5 text-sm shadow-lg shadow-[#8B2252]/20 transition-all hover:shadow-xl hover:shadow-[#8B2252]/25 active:scale-[0.98]"
                    >
                      {isQuickGenerating ? (
                        <><Loader2 size={16} className="animate-spin mr-2" /> Creating Luma Event...</>
                      ) : (
                        <><Link2 size={16} className="mr-2" /> Generate Private Luma Link</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedInquiry} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

              {/* Existing Luma Link */}
              {generatedLink && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <p className="font-body text-sm font-semibold text-emerald-700">Booking Link Generated</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={generatedLink}
                      readOnly
                      className="text-xs font-mono bg-white"
                    />
                    <Button size="sm" variant="outline" onClick={copyLink}>
                      <Copy size={14} />
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={generatedLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} />
                      </a>
                    </Button>
                  </div>
                  {!showEmailPanel && (
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        className="bg-[#8B2252] hover:bg-[#6B1A40] text-white font-body font-semibold rounded-full text-sm"
                        onClick={() => setShowEmailPanel(true)}
                      >
                        <Send size={14} className="mr-2" />
                        Send Quote Email
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 rounded-full text-sm"
                          >
                            <Trash2 size={14} className="mr-1" />
                            Delete Event
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Luma Event?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the private event on Luma and remove the booking link. The client will no longer be able to pay. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => deleteLumaEvent.mutate({ inquiryId: selectedInquiry.id })}
                            >
                              {deleteLumaEvent.isPending ? "Deleting..." : "Yes, Delete Event"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              )}

              {/* Send Quote Email Panel */}
              {showEmailPanel && generatedLink && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                  <p className="font-body text-xs font-semibold text-purple-700 uppercase tracking-wider">Send Quote Email</p>
                  <p className="font-body text-sm text-purple-600">
                    This will send a branded email to <strong>{selectedInquiry.email}</strong> with the booking link and pricing details.
                  </p>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal message (optional) — e.g. 'It was great chatting with you! Here's your booking link...'"
                    className="border-purple-200 focus:border-purple-400 font-body text-sm min-h-[60px] resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendEmail}
                      disabled={isSendingEmail}
                      className="bg-[#8B2252] hover:bg-[#6B1A40] text-white font-body font-semibold rounded-full text-sm"
                    >
                      {isSendingEmail ? <Loader2 size={14} className="animate-spin mr-2" /> : <Send size={14} className="mr-2" />}
                      Send Email Now
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowEmailPanel(false)}
                      className="font-body text-sm rounded-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Generate Booking Link Panel */}
              {!generatedLink && !showBookingPanel && (
                <Button
                  className="w-full bg-gradient-to-r from-[#8B2252] to-[#D4708A] hover:from-[#6B1A40] hover:to-[#B85A74] text-white font-body font-bold rounded-full py-3"
                  onClick={() => setShowBookingPanel(true)}
                >
                  <Link2 size={16} className="mr-2" />
                  Generate Booking Link
                </Button>
              )}

              {showBookingPanel && !generatedLink && (
                <div className="bg-[#FFF5F8] border border-[#F2A0B8]/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={16} className="text-[#8B2252]" />
                    <p className="font-body text-sm font-bold text-[#1A0A12]">Quote & Booking Details</p>
                  </div>

                  {/* Price + HST */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Final Price (CAD)</label>
                      <Input
                        type="number"
                        value={bookingForm.finalPrice}
                        onChange={(e) => setBookingForm({ ...bookingForm, finalPrice: e.target.value })}
                        placeholder="e.g. 2250"
                        className="border-[#F2A0B8]/40 font-body"
                      />
                    </div>
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Pricing Type</label>
                      <Select
                        value={bookingForm.pricingType}
                        onValueChange={(v) => setBookingForm({ ...bookingForm, pricingType: v as "plus_hst" | "all_in" })}
                      >
                        <SelectTrigger className="border-[#F2A0B8]/40 font-body text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plus_hst">+ HST (13%)</SelectItem>
                          <SelectItem value="all_in">All-in (HST included)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Price preview */}
                  {priceNum > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-[#F2A0B8]/20">
                      <div className="flex justify-between text-sm font-body">
                        <span className="text-[#3D1A2E]/55">Base price</span>
                        <span className="font-semibold">${bookingForm.pricingType === "plus_hst" ? priceNum.toLocaleString() : (priceNum - hstPreview).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-body">
                        <span className="text-[#3D1A2E]/55">HST (13%)</span>
                        <span className="font-semibold">${hstPreview.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-body font-bold border-t border-[#F2A0B8]/20 pt-2 mt-2">
                        <span className="text-[#1A0A12]">Total charged</span>
                        <span className="text-[#8B2252]">${totalPreview.toFixed(2)} CAD</span>
                      </div>
                    </div>
                  )}

                  {/* Approval warning */}
                  {priceNum > 0 && (priceNum < selectedInquiry.estimatedMin || priceNum > 3000) && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="font-body text-xs text-amber-700">
                        {priceNum < selectedInquiry.estimatedMin
                          ? "Price is below the estimated minimum — owner approval recommended."
                          : "Large event (over $3,000) — owner approval recommended."}
                      </p>
                    </div>
                  )}

                  {/* Event date/time */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Event Date</label>
                      <Input
                        type="date"
                        value={bookingForm.eventDate}
                        onChange={(e) => setBookingForm({ ...bookingForm, eventDate: e.target.value })}
                        className="border-[#F2A0B8]/40 font-body text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Start Time</label>
                      <Input
                        type="time"
                        value={bookingForm.startTime}
                        onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                        className="border-[#F2A0B8]/40 font-body text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">End Time</label>
                      <Input
                        type="time"
                        value={bookingForm.endTime}
                        onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
                        className="border-[#F2A0B8]/40 font-body text-sm"
                      />
                    </div>
                  </div>

                  {/* Sessions + Breed + Org */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Sessions</label>
                      <Input
                        type="number"
                        min="1"
                        value={bookingForm.sessions}
                        onChange={(e) => setBookingForm({ ...bookingForm, sessions: e.target.value })}
                        className="border-[#F2A0B8]/40 font-body text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Puppy Breed</label>
                      <Input
                        value={bookingForm.puppyBreed}
                        onChange={(e) => setBookingForm({ ...bookingForm, puppyBreed: e.target.value })}
                        placeholder="e.g. French Bulldog"
                        className="border-[#F2A0B8]/40 font-body text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Organization</label>
                      <Input
                        value={bookingForm.organization}
                        onChange={(e) => setBookingForm({ ...bookingForm, organization: e.target.value })}
                        placeholder="e.g. Laurier Women's Soccer"
                        className="border-[#F2A0B8]/40 font-body text-sm"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="font-body text-xs font-semibold text-[#3D1A2E]/60 mb-1 block">Event Location</label>
                    <select
                      value={bookingForm.customLocation.startsWith("__custom__") ? "__custom__" : bookingForm.customLocation}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setBookingForm({ ...bookingForm, customLocation: "__custom__" });
                        } else {
                          setBookingForm({ ...bookingForm, customLocation: e.target.value });
                        }
                      }}
                      className="w-full rounded-md border border-[#F2A0B8]/40 bg-white px-3 py-2 font-body text-sm text-[#3D1A2E]"
                    >
                      <option value="">Use inquiry location ({selectedInquiry?.location || "Kitchener"})</option>
                      <option value="kitchener">APY Kitchener — 329 King St E</option>
                      <option value="hamilton">APY Hamilton — 2751 Barton St E</option>
                      <option value="oakville">APY Oakville — 1670 North Service Rd E</option>
                      <option value="__custom__">Client&apos;s Location (enter below)</option>
                    </select>
                    {bookingForm.customLocation.startsWith("__custom__") && (
                      <Input
                        value={bookingForm.customLocation.replace("__custom__", "")}
                        onChange={(e) => setBookingForm({ ...bookingForm, customLocation: "__custom__" + e.target.value })}
                        placeholder="e.g. 123 Main St, Waterloo, ON"
                        className="mt-2 border-[#F2A0B8]/40 font-body text-sm"
                      />
                    )}
                  </div>

                  {/* Generate button */}
                  <Button
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="w-full bg-[#8B2252] hover:bg-[#6B1A40] text-white font-body font-bold rounded-full py-3"
                  >
                    {isGenerating ? (
                      <><Loader2 size={16} className="animate-spin mr-2" /> Creating Luma Event...</>
                    ) : (
                      <><Link2 size={16} className="mr-2" /> Generate Private Luma Link</>
                    )}
                  </Button>
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
                    <SelectItem value="quote_sent">Quote Sent</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
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
                className="w-full bg-[#8B2252] hover:bg-[#6B1A40] text-white font-body font-bold rounded-full"
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
