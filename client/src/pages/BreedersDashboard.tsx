/* ============================================================
   BreedersDashboard — Admin page for managing the breeder database
   Features: Search, filter, add/edit/delete, send confirmation emails,
             monthly availability blast, per-breeder availability history
   ============================================================ */
import { useState, useMemo } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PawPrint, Plus, Search, Pencil, Trash2, Phone, Mail, Instagram,
  ChevronDown, ChevronUp, Send, Eye, History, MapPin, X, Clock,
  CalendarCheck, CheckCircle2, AlertCircle, Loader2, CalendarDays, Dog
} from "lucide-react";

type ContractStatus = "No contract yet" | "Contract sent" | "Contract completed";

const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  "No contract yet": "bg-gray-100 text-gray-700 border-gray-200",
  "Contract sent": "bg-amber-50 text-amber-700 border-amber-200",
  "Contract completed": "bg-green-50 text-green-700 border-green-200",
};

const EMPTY_FORM = {
  name: "", contactName: "", phone: "", email: "", instagram: "",
  breed: "", litterTimeline: "", typicalRate: "", transport: "",
  contractStatus: "No contract yet" as ContractStatus, notes: "", isActive: 1,
};

const EMPTY_EVENT = {
  city: "", date: "", location: "", isPrivateEvent: false, apyTransport: false,
  dropOffTime: "", pickUpTime: "", pickupTime: "", returnTime: "", compensation: "",
};

// Fixed studio locations
const STUDIO_LOCATIONS = [
  { city: "Kitchener", label: "Kitchener — TenC Dance Studio", address: "TenC Dance Studio, 329 King Street East, Kitchener, Ontario" },
  { city: "Oakville", label: "Oakville — 1670 North Service Road", address: "1670 North Service Road, Oakville, Ontario" },
  { city: "Hamilton", label: "Hamilton — Colibri Studio", address: "Colibri Studio, 2751 Barton Street East, Hamilton, Ontario" },
];

// Time options in 30-min increments from 6:00 AM to 11:00 PM
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  TIME_OPTIONS.push(`${hour}:00 ${ampm}`);
  if (h < 23) TIME_OPTIONS.push(`${hour}:30 ${ampm}`);
}

function TimeSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {TIME_OPTIONS.map(t => (
          <SelectItem key={t} value={t}>{t}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Generate upcoming months for the blast selector (current + next 5)
function getUpcomingMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label, key });
  }
  return months;
}

// ─── Schedule constants ──────────────────────────────────────────────────────
const SCHED_LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
type SchedLocation = typeof SCHED_LOCATIONS[number];
const SCHED_LOCATION_COLORS: Record<SchedLocation, string> = {
  Kitchener: "bg-pink-50 text-pink-700 border-pink-200",
  Hamilton: "bg-purple-50 text-purple-700 border-purple-200",
  Oakville: "bg-amber-50 text-amber-700 border-amber-200",
};
const SCHED_DAY_COLORS: Record<string, string> = {
  Saturday: "bg-blue-50 text-blue-700 border-blue-200",
  Sunday: "bg-green-50 text-green-700 border-green-200",
};
const EMPTY_SCHED_FORM = {
  classDate: "",
  dayOfWeek: "" as "Saturday" | "Sunday" | "",
  location: "" as SchedLocation | "",
  breed: "",
  breederId: 0,
  breederName: "",
  notes: "",
};
function getUpcomingWeekends(): { date: string; label: string; day: "Saturday" | "Sunday" }[] {
  const results: { date: string; label: string; day: "Saturday" | "Sunday" }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 84; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (dow === 6 || dow === 0) {
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      results.push({ date: iso, label, day: dow === 6 ? "Saturday" : "Sunday" });
    }
  }
  return results;
}

export default function BreedersDashboard() {
  const utils = trpc.useUtils();

  // Tab state
  const [activeView, setActiveView] = useState<"breeders" | "schedule">("breeders");

  // Schedule state
  const weekends = useMemo(() => getUpcomingWeekends(), []);
  const [schedForm, setSchedForm] = useState({ ...EMPTY_SCHED_FORM });
  const [schedEditId, setSchedEditId] = useState<number | null>(null);
  const [showSchedDialog, setShowSchedDialog] = useState(false);
  const [schedDeleteId, setSchedDeleteId] = useState<number | null>(null);
  const [filterSchedLocation, setFilterSchedLocation] = useState<string>("all");

  // Breeder list state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editBreeder, setEditBreeder] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Confirmation state
  const [confirmBreeder, setConfirmBreeder] = useState<any>(null);
  const [events, setEvents] = useState([{ ...EMPTY_EVENT }]);
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);

  // Availability blast state
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [blastMonth, setBlastMonth] = useState(() => getUpcomingMonths()[1]); // default next month
  const [blastCustomMessage, setBlastCustomMessage] = useState("");
  const [blastResult, setBlastResult] = useState<{ sent: number; failed: number } | null>(null);

  // Availability per-breeder state (request + log)
  const [showAvailability, setShowAvailability] = useState<any | null>(null); // stores the full breeder object
  const [reqMonth, setReqMonth] = useState(() => getUpcomingMonths()[1]);
  const [reqMessage, setReqMessage] = useState("");
  const [reqSent, setReqSent] = useState(false);

  // Location presets state
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [newPreset, setNewPreset] = useState({ label: "", city: "", address: "" });

  // Queries
  const { data: breeders = [], isLoading } = trpc.breeders.list.useQuery({
    search: search || undefined,
    contractStatus: filterStatus as any,
  });

  const { data: presets = [] } = trpc.breeders.listPresets.useQuery();

  const { data: confirmHistory = [], isLoading: historyLoading } = trpc.breeders.getConfirmations.useQuery(
    { breederId: showHistory! },
    { enabled: showHistory !== null }
  );

  const { data: breederAvailability = [], isLoading: availLoading, refetch: refetchAvail } = trpc.breeders.getBreederResponses.useQuery(
    { breederId: showAvailability?.id ?? 0 },
    { enabled: showAvailability !== null }
  );

  // Schedule queries & mutations
  const { data: schedules = [], isLoading: schedLoading } = trpc.puppySchedule.list.useQuery();
  const schedCreateMutation = trpc.puppySchedule.create.useMutation({
    onSuccess: () => { utils.puppySchedule.list.invalidate(); setShowSchedDialog(false); setSchedForm({ ...EMPTY_SCHED_FORM }); },
    onError: (e: any) => alert(e.message),
  });
  const schedUpdateMutation = trpc.puppySchedule.update.useMutation({
    onSuccess: () => { utils.puppySchedule.list.invalidate(); setShowSchedDialog(false); setSchedEditId(null); setSchedForm({ ...EMPTY_SCHED_FORM }); },
    onError: (e: any) => alert(e.message),
  });
  const schedDeleteMutation = trpc.puppySchedule.delete.useMutation({
    onSuccess: () => { utils.puppySchedule.list.invalidate(); setSchedDeleteId(null); },
    onError: (e: any) => alert(e.message),
  });

  function openSchedAdd() { setSchedForm({ ...EMPTY_SCHED_FORM }); setSchedEditId(null); setShowSchedDialog(true); }
  function openSchedEdit(s: any) {
    setSchedForm({ classDate: s.classDate, dayOfWeek: s.dayOfWeek, location: s.location, breed: s.breed, breederId: s.breederId, breederName: s.breederName, notes: s.notes ?? "" });
    setSchedEditId(s.id); setShowSchedDialog(true);
  }
  function handleSchedDateChange(dateStr: string) {
    const w = weekends.find(w => w.date === dateStr);
    setSchedForm(f => ({ ...f, classDate: dateStr, dayOfWeek: w?.day ?? "" }));
  }
  function handleSchedBreederChange(breederId: string) {
    const b = (breeders as any[]).find(b => b.id === Number(breederId));
    setSchedForm(f => ({ ...f, breederId: Number(breederId), breederName: b?.name ?? "", breed: f.breed || b?.breed || "" }));
  }
  function handleSchedSubmit() {
    if (!schedForm.classDate || !schedForm.dayOfWeek || !schedForm.location || !schedForm.breed || !schedForm.breederId) {
      alert("Please fill in all required fields."); return;
    }
    const payload = { classDate: schedForm.classDate, dayOfWeek: schedForm.dayOfWeek as "Saturday" | "Sunday", location: schedForm.location as SchedLocation, breed: schedForm.breed, breederId: schedForm.breederId, breederName: schedForm.breederName, notes: schedForm.notes || undefined };
    if (schedEditId !== null) schedUpdateMutation.mutate({ id: schedEditId, ...payload });
    else schedCreateMutation.mutate(payload);
  }

  // Mutations
  const addMutation = trpc.breeders.add.useMutation({
    onSuccess: () => { utils.breeders.list.invalidate(); setShowAddModal(false); setForm({ ...EMPTY_FORM }); },
  });
  const updateMutation = trpc.breeders.update.useMutation({
    onSuccess: () => { utils.breeders.list.invalidate(); setEditBreeder(null); },
  });
  const deleteMutation = trpc.breeders.delete.useMutation({
    onSuccess: () => { utils.breeders.list.invalidate(); setDeleteConfirm(null); },
  });
  const previewMutation = trpc.breeders.previewConfirmation.useMutation({
    onSuccess: (data) => setPreviewHtml(data.html),
  });
  const sendMutation = trpc.breeders.sendConfirmation.useMutation({
    onSuccess: () => {
      utils.breeders.getConfirmations.invalidate({ breederId: confirmBreeder?.id });
      setConfirmBreeder(null);
      setEvents([{ ...EMPTY_EVENT }]);
      setAvailabilityNote("");
      setPreviewHtml(null);
      alert("Confirmation email sent successfully!");
    },
    onError: (e) => alert(`Error sending email: ${e.message}`),
  });
  const addPresetMutation = trpc.breeders.addPreset.useMutation({
    onSuccess: () => { utils.breeders.listPresets.invalidate(); setNewPreset({ label: "", city: "", address: "" }); },
  });
  const deletePresetMutation = trpc.breeders.deletePreset.useMutation({
    onSuccess: () => utils.breeders.listPresets.invalidate(),
  });
  const blastMutation = trpc.breeders.sendAvailabilityBlast.useMutation({
    onSuccess: (data) => {
      setBlastResult({ sent: data.sent, failed: data.failed });
    },
    onError: (e) => alert(`Error sending blast: ${e.message}`),
  });
  const reqAvailMutation = trpc.breeders.sendAvailabilityRequest.useMutation({
    onSuccess: () => {
      setReqSent(true);
      refetchAvail();
    },
    onError: (e) => alert(`Error: ${e.message}`),
  });

  // Helpers
  function openEdit(b: any) {
    setForm({
      name: b.name ?? "", contactName: b.contactName ?? "", phone: b.phone ?? "",
      email: b.email ?? "", instagram: b.instagram ?? "", breed: b.breed ?? "",
      litterTimeline: b.litterTimeline ?? "", typicalRate: b.typicalRate ?? "",
      transport: b.transport ?? "", contractStatus: b.contractStatus ?? "No contract yet",
      notes: b.notes ?? "", isActive: b.isActive ?? 1,
    });
    setEditBreeder(b);
  }

  function handleSubmit() {
    if (!form.name.trim()) { alert("Breeder name is required"); return; }
    if (editBreeder) updateMutation.mutate({ id: editBreeder.id, ...form });
    else addMutation.mutate(form);
  }

  function openConfirm(b: any) {
    setConfirmBreeder(b);
    setEvents([{
      ...EMPTY_EVENT,
      compensation: b.typicalRate ? `$${b.typicalRate}` : "",
    }]);
    setAvailabilityNote("");
    setPreviewHtml(null);
  }

  function updateEvent(idx: number, field: string, value: any) {
    setEvents(ev => ev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function applyStudio(idx: number, studioLabel: string) {
    if (studioLabel === "private") {
      setEvents(ev => ev.map((e, i) => i === idx ? { ...e, city: "", location: "", isPrivateEvent: true } : e));
    } else {
      const studio = STUDIO_LOCATIONS.find(s => s.label === studioLabel);
      if (studio) {
        setEvents(ev => ev.map((e, i) => i === idx ? { ...e, city: studio.city, location: studio.address, isPrivateEvent: false } : e));
      }
    }
  }

  function formatDateForDisplay(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
  }

  function handlePreview() {
    if (!confirmBreeder) return;
    const firstName = (confirmBreeder.contactName || confirmBreeder.name).split(" ")[0];
    previewMutation.mutate({ breederFirstName: firstName, events, availabilityNote: availabilityNote || undefined });
  }

  function handleSend() {
    if (!confirmBreeder?.email) { alert("This breeder has no email address on file. Please add one first."); return; }
    const firstName = (confirmBreeder.contactName || confirmBreeder.name).split(" ")[0];
    sendMutation.mutate({
      breederId: confirmBreeder.id,
      breederFirstName: firstName,
      toEmail: confirmBreeder.email,
      events,
      availabilityNote: availabilityNote || undefined,
    });
  }

  function handleBlast() {
    blastMutation.mutate({
      monthLabel: blastMonth.label,
      monthKey: blastMonth.key,
      customMessage: blastCustomMessage || undefined,
      origin: window.location.origin,
    });
  }

  const contractCounts = {
    all: breeders.length,
    "No contract yet": breeders.filter((b: any) => b.contractStatus === "No contract yet").length,
    "Contract sent": breeders.filter((b: any) => b.contractStatus === "Contract sent").length,
    "Contract completed": breeders.filter((b: any) => b.contractStatus === "Contract completed").length,
  };

  const upcomingMonths = getUpcomingMonths();

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-[#C2185B] rounded-full" />
              <span className="font-body text-xs font-semibold text-[#C2185B] uppercase tracking-widest">Admin</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-[#1A0A12]">Breeder Database</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">Manage breeders, send confirmations, and check availability</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              onClick={() => setShowPresetsModal(true)}
              className="border-[#F0D0DC] text-[#C2185B] hover:bg-[#FFF0F4] font-body gap-2"
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Locations</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => { setBlastResult(null); setBlastCustomMessage(""); setShowBlastModal(true); }}
              className="border-[#C2185B] text-[#C2185B] hover:bg-[#FFF0F4] font-body gap-2"
            >
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Availability Blast</span>
            </Button>
            <Button
              onClick={() => { setForm({ ...EMPTY_FORM }); setShowAddModal(true); }}
              className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body font-semibold gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Breeder
            </Button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 bg-white border border-[#F0D0DC] rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveView("breeders")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-semibold transition-all ${
              activeView === "breeders"
                ? "bg-[#C2185B] text-white shadow-sm"
                : "text-[#6B4C3B] hover:text-[#C2185B]"
            }`}
          >
            <PawPrint size={15} /> Breeders
          </button>
          <button
            onClick={() => setActiveView("schedule")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-semibold transition-all ${
              activeView === "schedule"
                ? "bg-[#C2185B] text-white shadow-sm"
                : "text-[#6B4C3B] hover:text-[#C2185B]"
            }`}
          >
            <CalendarDays size={15} /> Puppy Schedule
          </button>
        </div>

        {activeView === "breeders" && (
        <>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total", value: contractCounts.all, color: "text-[#1A0A12]" },
            { label: "No Contract", value: contractCounts["No contract yet"], color: "text-gray-600" },
            { label: "Contract Sent", value: contractCounts["Contract sent"], color: "text-amber-600" },
            { label: "Contracted", value: contractCounts["Contract completed"], color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#F0D0DC] p-4">
              <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wider mb-1">{label}</p>
              <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B2252]" />
            <Input
              placeholder="Search by name, breed, contact, email, or Instagram..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-[#F0D0DC] bg-white font-body focus-visible:ring-[#C2185B]"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-52 border-[#F0D0DC] bg-white font-body">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="No contract yet">No Contract Yet</SelectItem>
              <SelectItem value="Contract sent">Contract Sent</SelectItem>
              <SelectItem value="Contract completed">Contract Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Breeder List */}
        {isLoading ? (
          <div className="text-center py-16 text-[#6B4C3B] font-body">Loading breeders...</div>
        ) : breeders.length === 0 ? (
          <div className="text-center py-16">
            <PawPrint className="w-12 h-12 text-[#F0D0DC] mx-auto mb-3" />
            <p className="font-body text-[#6B4C3B]">No breeders found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {breeders.map((b: any) => {
              const isExpanded = expandedId === b.id;
              return (
                <div key={b.id} className="bg-white rounded-xl border border-[#F0D0DC] overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#FFF5F8] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#FFF0F4] flex items-center justify-center shrink-0">
                      <PawPrint className="w-4 h-4 text-[#C2185B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-semibold text-[#1A0A12] text-sm">{b.name}</span>
                        {b.breed && (
                          <span className="font-body text-xs text-[#6B4C3B] bg-[#FFF5F8] px-2 py-0.5 rounded-full border border-[#F0D0DC]">{b.breed}</span>
                        )}
                      </div>
                      <p className="font-body text-xs text-[#8B6B5A] truncate mt-0.5">{b.contactName || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-body text-xs font-medium px-2.5 py-1 rounded-full border ${CONTRACT_STATUS_COLORS[b.contractStatus as ContractStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {b.contractStatus}
                      </span>
                      {b.typicalRate && (
                        <span className="font-body text-xs text-[#6B4C3B] hidden sm:inline">${b.typicalRate}</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8B2252]" /> : <ChevronDown className="w-4 h-4 text-[#8B2252]" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#F0D0DC] px-4 py-4 bg-[#FEFAF4]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        {b.phone && (
                          <div className="flex items-start gap-2">
                            <Phone className="w-3.5 h-3.5 text-[#C2185B] mt-0.5 shrink-0" />
                            <div>
                              <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Phone</p>
                              <p className="font-body text-sm text-[#1A0A12]">{b.phone}</p>
                            </div>
                          </div>
                        )}
                        {b.email && (
                          <div className="flex items-start gap-2">
                            <Mail className="w-3.5 h-3.5 text-[#C2185B] mt-0.5 shrink-0" />
                            <div>
                              <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Email</p>
                              <a href={`mailto:${b.email}`} className="font-body text-sm text-[#C2185B] hover:underline">{b.email}</a>
                            </div>
                          </div>
                        )}
                        {b.instagram && (
                          <div className="flex items-start gap-2">
                            <Instagram className="w-3.5 h-3.5 text-[#C2185B] mt-0.5 shrink-0" />
                            <div>
                              <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Instagram</p>
                              <p className="font-body text-sm text-[#1A0A12]">{b.instagram}</p>
                            </div>
                          </div>
                        )}
                        {b.litterTimeline && (
                          <div>
                            <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Litter Timeline</p>
                            <p className="font-body text-sm text-[#1A0A12]">{b.litterTimeline}</p>
                          </div>
                        )}
                        {b.typicalRate && (
                          <div>
                            <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Typical Rate</p>
                            <p className="font-body text-sm text-[#1A0A12]">{b.typicalRate.startsWith("$") ? b.typicalRate : `$${b.typicalRate}`}</p>
                          </div>
                        )}
                        {b.transport && (
                          <div>
                            <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Transport</p>
                            <p className="font-body text-sm text-[#1A0A12]">{b.transport}</p>
                          </div>
                        )}
                      </div>
                      {b.notes && (
                        <div className="mb-4">
                          <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider mb-1">Notes</p>
                          <p className="font-body text-sm text-[#1A0A12] bg-white rounded-lg p-3 border border-[#F0D0DC]">{b.notes}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openConfirm(b); }}
                          className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send Confirmation
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#C2185B] text-[#C2185B] hover:bg-[#FFF0F4] font-body gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setShowAvailability(b); setReqSent(false); setReqMonth(getUpcomingMonths()[1]); setReqMessage(""); }}
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                          Availability
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#F0D0DC] text-[#8B2252] hover:bg-[#FFF0F4] font-body gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setShowHistory(b.id); }}
                        >
                          <History className="w-3.5 h-3.5" />
                          History
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#F0D0DC] text-[#C2185B] hover:bg-[#FFF0F4] font-body gap-1.5"
                          onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 font-body gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(b.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>
        )}

        {/* ── Schedule View ──────────────────────────────────────────────────────── */}
        {activeView === "schedule" && (
        <>
          {/* Schedule action button */}
          <div className="flex items-center justify-between mb-4">
            <p className="font-body text-sm text-[#6B4C3B]">Assign breeds and breeders to Saturday &amp; Sunday classes.</p>
            <Button onClick={openSchedAdd} className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-5 gap-2">
              <Plus size={15} /> Schedule Class
            </Button>
          </div>
          {/* Schedule stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Scheduled", value: schedules.length },
              { label: "Kitchener", value: schedules.filter((s: any) => s.location === "Kitchener").length },
              { label: "Hamilton", value: schedules.filter((s: any) => s.location === "Hamilton").length },
              { label: "Oakville", value: schedules.filter((s: any) => s.location === "Oakville").length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-[#F0D0DC] p-4">
                <div className="font-display text-2xl font-bold text-[#C2185B]">{value}</div>
                <div className="font-body text-xs text-[#6B4C3B] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {/* Location filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {["all", ...SCHED_LOCATIONS].map(loc => (
              <button key={loc} onClick={() => setFilterSchedLocation(loc)}
                className={`px-4 py-1.5 rounded-full font-body text-sm font-semibold border transition-all ${
                  filterSchedLocation === loc ? "bg-[#C2185B] text-white border-[#C2185B]" : "bg-white text-[#6B4C3B] border-[#F0D0DC] hover:border-[#C2185B]"
                }`}>
                {loc === "all" ? "All Locations" : loc}
              </button>
            ))}
          </div>
          {/* Schedule list */}
          {schedLoading ? (
            <div className="flex items-center justify-center py-20 text-[#6B4C3B]"><Loader2 className="animate-spin mr-2" size={20} /> Loading schedule...</div>
          ) : (() => {
            const filtered = filterSchedLocation === "all" ? schedules : schedules.filter((s: any) => s.location === filterSchedLocation);
            const grouped = (filtered as any[]).reduce<Record<string, any[]>>((acc, s) => { if (!acc[s.classDate]) acc[s.classDate] = []; acc[s.classDate].push(s); return acc; }, {});
            const sortedDates = Object.keys(grouped).sort();
            return sortedDates.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-[#F0D0DC]">
                <Dog size={48} className="mx-auto text-[#F0D0DC] mb-3" />
                <p className="font-display text-lg text-[#1A0A12] font-semibold">No classes scheduled yet</p>
                <p className="font-body text-sm text-[#6B4C3B] mt-1">Click "Schedule Class" to add your first entry.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDates.map(date => {
                  const entries = grouped[date];
                  const d = new Date(date + "T12:00:00");
                  const dateLabel = d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                  const dayOfWeek = entries[0].dayOfWeek;
                  return (
                    <div key={date} className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 bg-[#FFF5F8] border-b border-[#F0D0DC]">
                        <CalendarDays size={18} className="text-[#C2185B]" />
                        <span className="font-display font-bold text-[#1A0A12] text-base">{dateLabel}</span>
                        <Badge className={`text-xs font-body border ${SCHED_DAY_COLORS[dayOfWeek]}`}>{dayOfWeek}</Badge>
                      </div>
                      <div className="divide-y divide-[#F0D0DC]">
                        {entries.map((s: any) => (
                          <div key={s.id} className="flex items-start gap-4 px-5 py-4">
                            <div className="w-9 h-9 rounded-full bg-[#FFF0F4] flex items-center justify-center shrink-0 mt-0.5">
                              <PawPrint size={18} className="text-[#C2185B]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-body font-semibold text-[#1A0A12]">{s.breed}</span>
                                <Badge className={`text-xs font-body border ${SCHED_LOCATION_COLORS[s.location as SchedLocation]}`}>
                                  <MapPin size={10} className="mr-1" />{s.location}
                                </Badge>
                              </div>
                              <div className="font-body text-sm text-[#6B4C3B]">Breeder: <span className="font-semibold text-[#1A0A12]">{s.breederName}</span></div>
                              {s.notes && <div className="font-body text-xs text-[#9E7B6B] mt-1 italic">{s.notes}</div>}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => openSchedEdit(s)} className="p-1.5 rounded-lg hover:bg-[#FFF0F4] text-[#6B4C3B] hover:text-[#C2185B] transition-colors"><Pencil size={15} /></button>
                              <button onClick={() => setSchedDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B4C3B] hover:text-red-600 transition-colors"><Trash2 size={15} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
        )}
      </div>

      {/* ── Schedule Add/Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={showSchedDialog} onOpenChange={setShowSchedDialog}>
        <DialogContent className="max-w-md bg-[#FEFAF4] border-[#F0D0DC]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">{schedEditId !== null ? "Edit Scheduled Class" : "Schedule a Class"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Class Date <span className="text-red-500">*</span></Label>
              <Select value={schedForm.classDate} onValueChange={handleSchedDateChange}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm"><SelectValue placeholder="Select a Saturday or Sunday" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {weekends.map(w => (
                    <SelectItem key={w.date} value={w.date}>
                      <span className={`inline-block w-20 text-xs font-semibold mr-2 ${w.day === "Saturday" ? "text-blue-600" : "text-green-600"}`}>{w.day}</span>{w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {schedForm.dayOfWeek && <p className="text-xs text-[#6B4C3B] mt-1 font-body">Day: <span className="font-semibold">{schedForm.dayOfWeek}</span></p>}
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Location <span className="text-red-500">*</span></Label>
              <Select value={schedForm.location} onValueChange={v => setSchedForm(f => ({ ...f, location: v as SchedLocation }))}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{SCHED_LOCATIONS.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breeder <span className="text-red-500">*</span></Label>
              <Select value={schedForm.breederId ? String(schedForm.breederId) : ""} onValueChange={handleSchedBreederChange}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm"><SelectValue placeholder="Select breeder" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {(breeders as any[]).filter(b => b.isActive === 1).map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.breed ? ` — ${b.breed}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breed <span className="text-red-500">*</span></Label>
              <Input className="mt-1 border-[#F0D0DC] font-body text-sm" placeholder="e.g. Golden Retriever, Cavapoo" value={schedForm.breed} onChange={e => setSchedForm(f => ({ ...f, breed: e.target.value }))} />
              <p className="text-xs text-[#9E7B6B] mt-1 font-body">Auto-filled from breeder profile — edit if different.</p>
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Notes <span className="text-[#9E7B6B] font-normal">(optional)</span></Label>
              <Textarea className="mt-1 border-[#F0D0DC] font-body text-sm resize-none" placeholder="e.g. 4 puppies, drop-off at 9:30 AM" rows={2} value={schedForm.notes} onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSchedDialog(false)} className="font-body border-[#F0D0DC]">Cancel</Button>
            <Button onClick={handleSchedSubmit} disabled={schedCreateMutation.isPending || schedUpdateMutation.isPending} className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-6">
              {(schedCreateMutation.isPending || schedUpdateMutation.isPending) && <Loader2 size={14} className="animate-spin mr-2" />}
              {schedEditId !== null ? "Save Changes" : "Schedule Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Schedule Delete Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={schedDeleteId !== null} onOpenChange={open => !open && setSchedDeleteId(null)}>
        <AlertDialogContent className="bg-[#FEFAF4] border-[#F0D0DC]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[#1A0A12]">Remove from schedule?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-[#6B4C3B]">This will remove this class entry. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body border-[#F0D0DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => schedDeleteId !== null && schedDeleteMutation.mutate({ id: schedDeleteId })} className="bg-red-600 hover:bg-red-700 text-white font-body">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Availability Blast Modal ──────────────────────────────────────────── */}
      <Dialog open={showBlastModal} onOpenChange={(open) => { if (!open) { setShowBlastModal(false); setBlastResult(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">Send Availability Blast</DialogTitle>
          </DialogHeader>
          {blastResult ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="font-display text-lg text-[#1A0A12] font-semibold">Blast Sent!</p>
                <p className="font-body text-sm text-[#6B4C3B] mt-1">
                  {blastResult.sent} email{blastResult.sent !== 1 ? "s" : ""} sent successfully.
                  {blastResult.failed > 0 && <span className="text-red-600"> {blastResult.failed} failed.</span>}
                </p>
                <p className="font-body text-xs text-[#8B6B5A] mt-2">Each breeder received a unique link to submit their availability for {blastMonth.label}. Responses will appear in each breeder's Availability tab.</p>
              </div>
              <Button onClick={() => { setShowBlastModal(false); setBlastResult(null); }} className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body w-full">Done</Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Month to Check Availability For *</Label>
                <Select
                  value={blastMonth.key}
                  onValueChange={(key) => {
                    const m = upcomingMonths.find(m => m.key === key);
                    if (m) setBlastMonth(m);
                  }}
                >
                  <SelectTrigger className="mt-1 border-[#F0D0DC] font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {upcomingMonths.map(m => (
                      <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Custom Message (optional)</Label>
                <Textarea
                  value={blastCustomMessage}
                  onChange={(e) => setBlastCustomMessage(e.target.value)}
                  className="mt-1 border-[#F0D0DC] font-body resize-none"
                  rows={3}
                  placeholder="e.g. We are looking for 2-3 puppies per class, ideally small breeds..."
                />
              </div>
              <div className="p-3 bg-[#FFF5F8] border border-[#F0D0DC] rounded-lg">
                <p className="font-body text-xs text-[#6B4C3B]">
                  This will email <strong>all active breeders with an email address</strong> asking for their availability in <strong>{blastMonth.label}</strong>. Each breeder gets a unique link to submit their dates.
                </p>
              </div>
              {blastMutation.error && (
                <div className="flex items-center gap-2 text-red-600 text-sm font-body bg-red-50 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {blastMutation.error.message}
                </div>
              )}
            </div>
          )}
          {!blastResult && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBlastModal(false)} className="font-body border-[#F0D0DC]">Cancel</Button>
              <Button
                onClick={handleBlast}
                disabled={blastMutation.isPending}
                className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body gap-2"
              >
                {blastMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                ) : (
                  <><Send className="w-4 h-4" />Send Blast</>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Per-Breeder Availability Modal (Request + Log) ─────────────────────── */}
      <Dialog open={showAvailability !== null} onOpenChange={(open) => { if (!open) { setShowAvailability(null); setReqSent(false); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              Availability — {showAvailability?.contactName || showAvailability?.name}
            </DialogTitle>
            {showAvailability?.email && (
              <p className="font-body text-xs text-[#8B6B5A] mt-1">{showAvailability.email}</p>
            )}
          </DialogHeader>

          {/* ── Request Section ── */}
          <div className="border border-[#F0D0DC] rounded-xl p-4 bg-[#FFF5F8] mb-4">
            <p className="font-body text-sm font-semibold text-[#8B2252] mb-3">Request Availability</p>
            {reqSent ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="font-body text-sm">Request sent to {showAvailability?.email}!</p>
              </div>
            ) : !showAvailability?.email ? (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="font-body text-sm">No email on file. Edit this breeder to add their email first.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="font-body text-xs text-[#1A0A12] font-semibold">Month *</Label>
                  <Select value={reqMonth.key} onValueChange={(k) => { const m = getUpcomingMonths().find(x => x.key === k); if (m) setReqMonth(m); }}>
                    <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getUpcomingMonths().map(m => (
                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-body text-xs text-[#1A0A12] font-semibold">Custom Message (optional)</Label>
                  <Textarea
                    className="mt-1 border-[#F0D0DC] font-body text-sm resize-none"
                    rows={2}
                    placeholder="Any extra context for this breeder..."
                    value={reqMessage}
                    onChange={e => setReqMessage(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body gap-1.5 w-full"
                  disabled={reqAvailMutation.isPending}
                  onClick={() => reqAvailMutation.mutate({
                    breederId: showAvailability.id,
                    monthLabel: reqMonth.label,
                    monthKey: reqMonth.key,
                    customMessage: reqMessage || undefined,
                    origin: window.location.origin,
                  })}
                >
                  {reqAvailMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Availability Request
                </Button>
              </div>
            )}
          </div>

          {/* ── Response Log ── */}
          <div>
            <p className="font-body text-sm font-semibold text-[#1A0A12] mb-3">Response Log</p>
            {availLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#C2185B]" />
              </div>
            ) : breederAvailability.length === 0 ? (
              <div className="text-center py-6">
                <CalendarCheck className="w-8 h-8 text-[#F0D0DC] mx-auto mb-2" />
                <p className="font-body text-sm text-[#6B4C3B]">No requests sent yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {breederAvailability.map((r: any) => (
                  <div key={r.id} className="border border-[#F0D0DC] rounded-xl p-4 bg-[#FEFAF4]">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {r.responded ? (
                          <span className="inline-flex items-center gap-1 text-xs font-body font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Responded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-body font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        <span className="font-body text-xs text-[#8B6B5A] font-medium">{r.monthLabel ?? ""}</span>
                      </div>
                      <span className="font-body text-xs text-[#8B6B5A]">
                        {new Date(r.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    {r.responded ? (
                      <div className="space-y-2">
                        <div>
                          <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider mb-1">Available Dates</p>
                          <p className="font-body text-sm text-[#1A0A12] bg-white rounded-lg p-3 border border-[#F0D0DC] whitespace-pre-wrap">{r.availabilityText}</p>
                        </div>
                        {r.responseNotes && (
                          <div>
                            <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider mb-1">Notes</p>
                            <p className="font-body text-sm text-[#1A0A12] bg-white rounded-lg p-3 border border-[#F0D0DC]">{r.responseNotes}</p>
                          </div>
                        )}
                        {r.respondedAt && (
                          <p className="font-body text-xs text-[#8B6B5A]">
                            Responded {new Date(r.respondedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="font-body text-xs text-[#8B6B5A] italic">Awaiting response from breeder...</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Send Confirmation Modal ─────────────────────────────────────────── */}
      <Dialog open={!!confirmBreeder} onOpenChange={(open) => { if (!open) { setConfirmBreeder(null); setPreviewHtml(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              Send Booking Confirmation — {confirmBreeder?.name}
            </DialogTitle>
          </DialogHeader>

          {previewHtml ? (
            <div>
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-body text-sm text-amber-800">
                  Preview below. Email will be sent to <strong>{confirmBreeder?.email}</strong>.
                </p>
              </div>
              <div
                className="border border-[#F0D0DC] rounded-xl overflow-hidden"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setPreviewHtml(null)} className="font-body border-[#F0D0DC]">
                  Back to Edit
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                  className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sendMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {events.map((ev, idx) => (
                <div key={idx} className="border border-[#F0D0DC] rounded-xl p-4 bg-[#FEFAF4] relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-body text-sm font-semibold text-[#8B2252]">Event {idx + 1}</span>
                    {events.length > 1 && (
                      <button
                        onClick={() => setEvents(ev => ev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Studio / Location selector */}
                  <div className="mb-3">
                    <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Location *</Label>
                    <Select
                      value={ev.isPrivateEvent ? "private" : (STUDIO_LOCATIONS.find(s => s.address === ev.location)?.label ?? "")}
                      onValueChange={(val) => applyStudio(idx, val)}
                    >
                      <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                        <SelectValue placeholder="Select a studio..." />
                      </SelectTrigger>
                      <SelectContent>
                        {STUDIO_LOCATIONS.map(s => (
                          <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                        ))}
                        <SelectItem value="private">Private Event (enter address)</SelectItem>
                      </SelectContent>
                    </Select>
                    {ev.isPrivateEvent && (
                      <Input
                        value={ev.location}
                        onChange={(e) => updateEvent(idx, "location", e.target.value)}
                        className="mt-2 border-[#F0D0DC] font-body text-sm"
                        placeholder="Enter full address for private event"
                      />
                    )}
                    {!ev.isPrivateEvent && ev.city && (
                      <p className="text-xs text-[#8B2252] mt-1 font-body">📍 {ev.city} · {ev.location}</p>
                    )}
                  </div>

                  {/* Date picker */}
                  <div className="mb-3">
                    <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Date *</Label>
                    <input
                      type="date"
                      value={ev.date}
                      onChange={(e) => updateEvent(idx, "date", e.target.value)}
                      className="mt-1 w-full border border-[#F0D0DC] rounded-md px-3 py-2 font-body text-sm bg-white text-[#1A0A12] focus:outline-none focus:ring-2 focus:ring-[#C2185B]/30"
                    />
                    {ev.date && (
                      <p className="text-xs text-[#8B2252] mt-1 font-body">{formatDateForDisplay(ev.date)}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <Switch
                      checked={ev.apyTransport}
                      onCheckedChange={(v) => updateEvent(idx, "apyTransport", v)}
                    />
                    <Label className="font-body text-sm text-[#1A0A12]">APY handles transportation</Label>
                  </div>

                  {ev.apyTransport ? (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Pickup Time</Label>
                        <TimeSelect value={ev.pickupTime} onChange={(v) => updateEvent(idx, "pickupTime", v)} placeholder="Select time..." />
                      </div>
                      <div>
                        <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Return Time</Label>
                        <TimeSelect value={ev.returnTime} onChange={(v) => updateEvent(idx, "returnTime", v)} placeholder="Select time..." />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Drop-off Time</Label>
                        <TimeSelect value={ev.dropOffTime} onChange={(v) => updateEvent(idx, "dropOffTime", v)} placeholder="Select time..." />
                      </div>
                      <div>
                        <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Pick-up Time</Label>
                        <TimeSelect value={ev.pickUpTime} onChange={(v) => updateEvent(idx, "pickUpTime", v)} placeholder="Select time..." />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Compensation *</Label>
                    <Input value={ev.compensation} onChange={(e) => updateEvent(idx, "compensation", e.target.value)} className="mt-1 border-[#F0D0DC] font-body text-sm" placeholder="$450" />
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => setEvents(ev => [...ev, { ...EMPTY_EVENT, compensation: confirmBreeder?.typicalRate ? `$${confirmBreeder.typicalRate}` : "" }])}
                className="w-full border-dashed border-[#F0D0DC] text-[#C2185B] hover:bg-[#FFF0F4] font-body gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Event
              </Button>

              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Checking Availability For (optional)</Label>
                <Input
                  value={availabilityNote}
                  onChange={(e) => setAvailabilityNote(e.target.value)}
                  className="mt-1 border-[#F0D0DC] font-body"
                  placeholder="e.g. Saturday, July 11"
                />
                <p className="font-body text-xs text-[#8B6B5A] mt-1">This adds a line asking if they're available for an additional date.</p>
              </div>

              <div className="p-3 bg-[#FFF5F8] border border-[#F0D0DC] rounded-lg">
                <p className="font-body text-xs text-[#6B4C3B]">
                  Email will be sent from <strong>afropuppyyogaofficial@gmail.com</strong> to <strong>{confirmBreeder?.email || "no email on file"}</strong>
                </p>
              </div>
            </div>
          )}

          {!previewHtml && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmBreeder(null)} className="font-body border-[#F0D0DC]">Cancel</Button>
              <Button
                onClick={handlePreview}
                disabled={previewMutation.isPending}
                variant="outline"
                className="border-[#C2185B] text-[#C2185B] hover:bg-[#FFF0F4] font-body gap-2"
              >
                <Eye className="w-4 h-4" />
                {previewMutation.isPending ? "Generating..." : "Preview Email"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmation History Modal ──────────────────────────────────────── */}
      <Dialog open={showHistory !== null} onOpenChange={(open) => { if (!open) setShowHistory(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">Confirmation History</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="font-body text-sm text-[#6B4C3B] py-4">Loading...</p>
          ) : confirmHistory.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 text-[#F0D0DC] mx-auto mb-2" />
              <p className="font-body text-sm text-[#6B4C3B]">No confirmations sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {confirmHistory.map((c: any) => {
                const evts = JSON.parse(c.events || "[]");
                return (
                  <div key={c.id} className="border border-[#F0D0DC] rounded-xl p-4 bg-[#FEFAF4]">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-body text-sm font-semibold text-[#1A0A12]">
                          {evts.length} event{evts.length !== 1 ? "s" : ""} confirmed
                        </p>
                        <p className="font-body text-xs text-[#8B6B5A]">Sent to {c.sentToEmail}</p>
                      </div>
                      <span className="font-body text-xs text-[#8B6B5A]">
                        {new Date(c.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {evts.map((ev: any, i: number) => (
                        <p key={i} className="font-body text-xs text-[#6B4C3B]">📍 {ev.city} — {ev.date} — {ev.compensation}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Location Presets Modal ──────────────────────────────────────────── */}
      <Dialog open={showPresetsModal} onOpenChange={setShowPresetsModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">Saved Locations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="font-body text-sm text-[#6B4C3B]">Save frequently used venues so you can quickly fill them in when creating confirmations.</p>

            <div className="border border-[#F0D0DC] rounded-xl p-4 bg-[#FEFAF4] space-y-3">
              <p className="font-body text-sm font-semibold text-[#1A0A12]">Add New Location</p>
              <div>
                <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Label</Label>
                <Input value={newPreset.label} onChange={(e) => setNewPreset(p => ({ ...p, label: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body text-sm" placeholder="e.g. TenC Dance Studio - Kitchener" />
              </div>
              <div>
                <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">City</Label>
                <Input value={newPreset.city} onChange={(e) => setNewPreset(p => ({ ...p, city: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body text-sm" placeholder="Kitchener" />
              </div>
              <div>
                <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">Full Address</Label>
                <Input value={newPreset.address} onChange={(e) => setNewPreset(p => ({ ...p, address: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body text-sm" placeholder="329 King Street East, Kitchener, Ontario" />
              </div>
              <Button
                onClick={() => { if (!newPreset.label || !newPreset.city || !newPreset.address) { alert("All fields required"); return; } addPresetMutation.mutate(newPreset); }}
                disabled={addPresetMutation.isPending}
                className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body text-sm w-full"
              >
                {addPresetMutation.isPending ? "Saving..." : "Save Location"}
              </Button>
            </div>

            {presets.length > 0 && (
              <div className="space-y-2">
                {presets.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between bg-white border border-[#F0D0DC] rounded-lg p-3">
                    <div>
                      <p className="font-body text-sm font-semibold text-[#1A0A12]">{p.label}</p>
                      <p className="font-body text-xs text-[#6B4C3B]">{p.city} — {p.address}</p>
                    </div>
                    <button
                      onClick={() => deletePresetMutation.mutate({ id: p.id })}
                      className="text-red-400 hover:text-red-600 ml-2 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Modal ────────────────────────────────────────────────── */}
      <Dialog open={showAddModal || !!editBreeder} onOpenChange={(open) => { if (!open) { setShowAddModal(false); setEditBreeder(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              {editBreeder ? "Edit Breeder" : "Add New Breeder"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breeder / Kennel Name *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Taco Yorkies" />
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Contact Name</Label>
              <Input value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="First and last name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="647-000-0000" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Email</Label>
                <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="breeder@email.com" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm(f => ({ ...f, instagram: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="@handle" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breed(s)</Label>
                <Input value={form.breed} onChange={(e) => setForm(f => ({ ...f, breed: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Goldendoodles" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Litter Timeline</Label>
                <Input value={form.litterTimeline} onChange={(e) => setForm(f => ({ ...f, litterTimeline: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Spring 2026" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Typical Rate</Label>
                <Input value={form.typicalRate} onChange={(e) => setForm(f => ({ ...f, typicalRate: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. 500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Transport</Label>
                <Input value={form.transport} onChange={(e) => setForm(f => ({ ...f, transport: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Breeder" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Contract Status</Label>
                <Select value={form.contractStatus} onValueChange={(v) => setForm(f => ({ ...f, contractStatus: v as ContractStatus }))}>
                  <SelectTrigger className="mt-1 border-[#F0D0DC] font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No contract yet">No Contract Yet</SelectItem>
                    <SelectItem value="Contract sent">Contract Sent</SelectItem>
                    <SelectItem value="Contract completed">Contract Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body resize-none" rows={3} placeholder="Any additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setEditBreeder(null); }} className="font-body border-[#F0D0DC]">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={addMutation.isPending || updateMutation.isPending}
              className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body"
            >
              {addMutation.isPending || updateMutation.isPending ? "Saving..." : editBreeder ? "Save Changes" : "Add Breeder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-[#1A0A12]">Remove Breeder?</DialogTitle>
          </DialogHeader>
          <p className="font-body text-sm text-[#6B4C3B]">This will permanently remove this breeder from the database. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="font-body border-[#F0D0DC]">Cancel</Button>
            <Button
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-body"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
