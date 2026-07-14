/* ============================================================
   ScheduleCalendar — Month-view calendar for APY class scheduling.
   Admin-only internal tool. Shows all days; weekends highlighted.
   Multiple slots per day supported. Color-coded by location.
   Private events can appear on any weekday.
   ============================================================ */
import { useState, useMemo, useCallback } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Loader2,
  CalendarDays,
  Clock,
  Dog,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
type Location = (typeof LOCATIONS)[number];

type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

const DOW_FROM_JS: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const LOCATION_COLORS: Record<Location, { bg: string; text: string; dot: string; border: string }> = {
  Kitchener: {
    bg: "bg-pink-50",
    text: "text-pink-800",
    dot: "bg-pink-400",
    border: "border-pink-200",
  },
  Hamilton: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    dot: "bg-purple-400",
    border: "border-purple-200",
  },
  Oakville: {
    bg: "bg-teal-50",
    text: "text-teal-800",
    dot: "bg-teal-400",
    border: "border-teal-200",
  },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Format "09:00" → "9:00 AM", "13:30" → "1:30 PM" */
function fmt12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

/** Build a calendar grid: array of 6 rows × 7 cols, each cell is ISO date string or null (padding) */
function buildCalendarGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const cells: (string | null)[] = [];
  // Pad start (Sun=0 means no padding if month starts on Sunday)
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${year}-${pad(month)}-${pad(d)}`);
  }
  // Pad end to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  classDate: "",
  dayOfWeek: "" as DayOfWeek | "",
  location: "" as Location | "",
  breed: "",
  breederId: 0,
  breederName: "",
  startTime: "09:00",
  endTime: "15:00",
  classType: "regular" as "regular" | "private",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const utils = trpc.useUtils();

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: slots = [], isLoading } = trpc.puppySchedule.listByMonth.useQuery(
    { year, month }
  );

  const { data: breeders = [] } = trpc.breeders.list.useQuery();
  const activeBreeders = useMemo(
    () => (breeders as any[]).filter((b) => b.isActive === 1),
    [breeders]
  );

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    utils.puppySchedule.listByMonth.invalidate({ year, month });
  }, [utils, year, month]);

  const createMutation = trpc.puppySchedule.createSlot.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Class slot added!");
      setShowDialog(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.puppySchedule.updateSlot.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Slot updated!");
      setShowDialog(false);
      setEditId(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.puppySchedule.deleteSlot.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Slot removed.");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // ─── Dialog helpers ─────────────────────────────────────────────────────────

  function openAdd(dateStr?: string) {
    const f = { ...EMPTY_FORM };
    if (dateStr) {
      const d = new Date(dateStr + "T12:00:00");
      f.classDate = dateStr;
      f.dayOfWeek = DOW_FROM_JS[d.getDay()];
    }
    setForm(f);
    setEditId(null);
    setShowDialog(true);
  }

  function openEdit(slot: (typeof slots)[0]) {
    setForm({
      classDate: slot.classDate,
      dayOfWeek: slot.dayOfWeek as DayOfWeek,
      location: slot.location as Location,
      breed: slot.breed,
      breederId: slot.breederId,
      breederName: slot.breederName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      classType: slot.classType as "regular" | "private",
      notes: slot.notes ?? "",
    });
    setEditId(slot.id);
    setShowDialog(true);
  }

  function handleDateChange(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    setForm((f) => ({
      ...f,
      classDate: dateStr,
      dayOfWeek: DOW_FROM_JS[d.getDay()],
    }));
  }

  function handleBreederChange(breederId: string) {
    const b = activeBreeders.find((b: any) => b.id === Number(breederId));
    setForm((f) => ({
      ...f,
      breederId: Number(breederId),
      breederName: b?.name ?? "",
      breed: f.breed || b?.breed || "",
    }));
  }

  function handleSubmit() {
    if (!form.classDate || !form.dayOfWeek || !form.location || !form.breed || !form.breederId) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const payload = {
      classDate: form.classDate,
      dayOfWeek: form.dayOfWeek as DayOfWeek,
      location: form.location as Location,
      breed: form.breed,
      breederId: form.breederId,
      breederName: form.breederName,
      startTime: form.startTime,
      endTime: form.endTime,
      classType: form.classType,
      notes: form.notes || undefined,
    };
    if (editId !== null) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const slotsByDate = useMemo(() => {
    const map: Record<string, typeof slots> = {};
    for (const s of slots) {
      if (!map[s.classDate]) map[s.classDate] = [];
      map[s.classDate].push(s);
    }
    return map;
  }, [slots]);

  const calendarGrid = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Stats for the current month
  const stats = useMemo(() => ({
    total: slots.length,
    kitchener: slots.filter((s) => s.location === "Kitchener").length,
    hamilton: slots.filter((s) => s.location === "Hamilton").length,
    oakville: slots.filter((s) => s.location === "Oakville").length,
    private: slots.filter((s) => s.classType === "private").length,
  }), [slots]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-[#C2185B] rounded-full" />
              <span className="text-[#C2185B] font-body text-xs font-bold tracking-widest uppercase">Admin</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-[#1A0A12]">Schedule Calendar</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">
              Assign breeds and breeders to class slots. Weekends are highlighted.
            </p>
          </div>
          <Button
            onClick={() => openAdd()}
            className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-5 gap-2"
          >
            <Plus size={16} /> Add Slot
          </Button>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total Slots", value: stats.total, color: "text-[#C2185B]" },
            { label: "Kitchener", value: stats.kitchener, color: "text-pink-600" },
            { label: "Hamilton", value: stats.hamilton, color: "text-purple-600" },
            { label: "Oakville", value: stats.oakville, color: "text-teal-600" },
            { label: "Private Events", value: stats.private, color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#F0D0DC] p-4">
              <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
              <div className="font-body text-xs text-[#6B4C3B] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Month navigation ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[#F0D0DC] text-[#6B4C3B] hover:text-[#C2185B] transition-all"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <CalendarDays size={20} className="text-[#C2185B]" />
            <h2 className="font-display text-xl font-bold text-[#1A0A12]">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            {isLoading && <Loader2 size={16} className="animate-spin text-[#C2185B]" />}
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[#F0D0DC] text-[#6B4C3B] hover:text-[#C2185B] transition-all"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* ── Calendar grid ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden shadow-sm">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-[#F0D0DC]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <div
                key={d}
                className={`py-2 text-center font-body text-xs font-bold tracking-wider uppercase ${
                  i === 0 || i === 6
                    ? "text-[#C2185B] bg-[#FFF5F8]"
                    : "text-[#6B4C3B]"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar rows */}
          {calendarGrid.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 border-b border-[#F0D0DC] last:border-b-0">
              {row.map((dateStr, ci) => {
                const isWeekend = ci === 0 || ci === 6; // Sun or Sat column
                const isToday = dateStr === todayStr;
                const daySlots = dateStr ? (slotsByDate[dateStr] ?? []) : [];
                const dayNum = dateStr ? parseInt(dateStr.split("-")[2], 10) : null;

                return (
                  <div
                    key={ci}
                    className={`min-h-[110px] border-r border-[#F0D0DC] last:border-r-0 p-1.5 flex flex-col transition-colors ${
                      !dateStr
                        ? "bg-[#FAFAFA]"
                        : isWeekend
                        ? "bg-[#FFF8FB] hover:bg-[#FFF0F6]"
                        : "bg-white hover:bg-[#FEFAF4]"
                    } ${dateStr ? "cursor-pointer group" : ""}`}
                    onClick={() => dateStr && openAdd(dateStr)}
                  >
                    {/* Day number */}
                    {dayNum !== null && (
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-body text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? "bg-[#C2185B] text-white"
                              : isWeekend
                              ? "text-[#C2185B]"
                              : "text-[#6B4C3B]"
                          }`}
                        >
                          {dayNum}
                        </span>
                        {/* Add button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dateStr) openAdd(dateStr);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-[#C2185B] text-white flex items-center justify-center transition-opacity hover:bg-[#AD1457]"
                          aria-label="Add slot"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    )}

                    {/* Slots */}
                    <div className="flex flex-col gap-0.5 flex-1">
                      {daySlots.map((slot) => {
                        const loc = slot.location as Location;
                        const colors = LOCATION_COLORS[loc];
                        return (
                          <div
                            key={slot.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(slot);
                            }}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-body font-medium border cursor-pointer hover:brightness-95 transition-all ${colors.bg} ${colors.text} ${colors.border} flex items-start gap-1`}
                            title={`${slot.location} · ${slot.breederName} · ${fmt12(slot.startTime)}–${fmt12(slot.endTime)}`}
                          >
                            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                            <span className="leading-tight truncate">
                              {slot.location}
                              {slot.classType === "private" && (
                                <Lock size={8} className="inline ml-0.5 mb-0.5 opacity-70" />
                              )}
                              <br />
                              <span className="opacity-70">{fmt12(slot.startTime)}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Legend ────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 mt-4 items-center">
          <span className="font-body text-xs text-[#9E7B6B] font-semibold uppercase tracking-wider">Legend:</span>
          {LOCATIONS.map((loc) => {
            const c = LOCATION_COLORS[loc];
            return (
              <span key={loc} className={`flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {loc}
              </span>
            );
          })}
          <span className="flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
            <Lock size={10} /> Private Event
          </span>
          <span className="flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border bg-[#FFF5F8] text-[#C2185B] border-[#F0D0DC]">
            Weekend
          </span>
        </div>
      </div>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditId(null); setForm({ ...EMPTY_FORM }); } }}>
        <DialogContent className="max-w-md bg-[#FEFAF4] border-[#F0D0DC] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              {editId !== null ? "Edit Class Slot" : "Add Class Slot"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                className="mt-1 border-[#F0D0DC] font-body text-sm"
                value={form.classDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
              {form.dayOfWeek && (
                <p className="text-xs text-[#6B4C3B] mt-1 font-body">
                  Day: <span className="font-semibold">{form.dayOfWeek}</span>
                  {(form.dayOfWeek === "Saturday" || form.dayOfWeek === "Sunday") && (
                    <span className="ml-1 text-[#C2185B]">· Weekend class</span>
                  )}
                </p>
              )}
            </div>

            {/* Class Type */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Class Type</Label>
              <Select
                value={form.classType}
                onValueChange={(v) => setForm((f) => ({ ...f, classType: v as "regular" | "private" }))}
              >
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular (weekend class)</SelectItem>
                  <SelectItem value="private">Private Event (any day)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">
                Location <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.location}
                onValueChange={(v) => setForm((f) => ({ ...f, location: v as Location }))}
              >
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${LOCATION_COLORS[loc].dot}`} />
                        {loc}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start / End time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold flex items-center gap-1">
                  <Clock size={13} /> Start Time
                </Label>
                <Input
                  type="time"
                  className="mt-1 border-[#F0D0DC] font-body text-sm"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold flex items-center gap-1">
                  <Clock size={13} /> End Time
                </Label>
                <Input
                  type="time"
                  className="mt-1 border-[#F0D0DC] font-body text-sm"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-[#9E7B6B] font-body -mt-2">
              3 classes: 9 AM–3 PM · 4 classes: 9 AM–4:30 PM
            </p>

            {/* Breeder */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">
                Breeder <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.breederId ? String(form.breederId) : ""}
                onValueChange={handleBreederChange}
              >
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                  <SelectValue placeholder="Select breeder" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {activeBreeders.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}{b.breed ? ` — ${b.breed}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Breed */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">
                Breed <span className="text-red-500">*</span>
              </Label>
              <Input
                className="mt-1 border-[#F0D0DC] font-body text-sm"
                placeholder="e.g. Golden Retriever, Cavapoo"
                value={form.breed}
                onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))}
              />
              <p className="text-xs text-[#9E7B6B] mt-1 font-body">
                Auto-filled from breeder profile — edit if different.
              </p>
            </div>

            {/* Notes */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">
                Notes <span className="text-[#9E7B6B] font-normal">(optional)</span>
              </Label>
              <Textarea
                className="mt-1 border-[#F0D0DC] font-body text-sm resize-none"
                placeholder="e.g. 4 puppies, drop-off at 9:30 AM"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Delete button when editing */}
            {editId !== null && (
              <div className="pt-2 border-t border-[#F0D0DC]">
                <Button
                  variant="outline"
                  onClick={() => { setShowDialog(false); setDeleteId(editId); }}
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 font-body"
                >
                  <Trash2 size={14} className="mr-2" /> Remove this slot
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowDialog(false); setEditId(null); setForm({ ...EMPTY_FORM }); }}
              className="font-body border-[#F0D0DC]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-6"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 size={14} className="animate-spin mr-2" />
              )}
              {editId !== null ? "Save Changes" : "Add Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent className="bg-[#FEFAF4] border-[#F0D0DC]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[#1A0A12]">
              Remove this slot?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-[#6B4C3B]">
              This will permanently remove the class slot from the schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body border-[#F0D0DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              className="bg-red-600 hover:bg-red-700 text-white font-body"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
