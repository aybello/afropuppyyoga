/* ============================================================
   ScheduleCalendarPanel — Embeddable month-view calendar for
   APY class scheduling. Designed to be dropped into any admin
   page (e.g. BreedersDashboard) without its own AdminNav.
   ============================================================ */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  CalendarDays,
  Clock,
  Lock,
  Mail,
  AlertTriangle,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
type Location = (typeof LOCATIONS)[number];

type DayOfWeek =
  | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday"
  | "Saturday" | "Sunday";

const DOW_FROM_JS: DayOfWeek[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const LOCATION_COLORS: Record<Location, { bg: string; text: string; dot: string; border: string }> = {
  Kitchener: { bg: "bg-pink-50",   text: "text-pink-800",   dot: "bg-pink-400",   border: "border-pink-200"   },
  Hamilton:  { bg: "bg-purple-50", text: "text-purple-800", dot: "bg-purple-400", border: "border-purple-200" },
  Oakville:  { bg: "bg-teal-50",   text: "text-teal-800",   dot: "bg-teal-400",   border: "border-teal-200"   },
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

function fmt12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function buildCalendarGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
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
  repeatWeekly: false,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleCalendarPanel() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId]         = useState<number | null>(null);
  const [deleteId, setDeleteId]     = useState<number | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [weekendOnly, setWeekendOnly] = useState(false);

  const utils = trpc.useUtils();

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: slots = [], isLoading } = trpc.puppySchedule.listByMonth.useQuery({ year, month });
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
    onSuccess: () => { invalidate(); toast.success("Class slot added!"); setShowDialog(false); setForm({ ...EMPTY_FORM }); },
    onError: (e) => toast.error(e.message),
  });
  const recurringMutation = trpc.puppySchedule.createRecurringSlots.useMutation({
    onSuccess: (data) => {
      invalidate();
      toast.success(`${data.created} slot${data.created !== 1 ? "s" : ""} created${data.skipped > 0 ? ` (${data.skipped} skipped — already booked)` : ""}!`);
      setShowDialog(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.puppySchedule.updateSlot.useMutation({
    onSuccess: () => { invalidate(); toast.success("Slot updated!"); setShowDialog(false); setEditId(null); setForm({ ...EMPTY_FORM }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.puppySchedule.deleteSlot.useMutation({
    onSuccess: () => { invalidate(); toast.success("Slot removed."); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });
  const notifyMutation = trpc.puppySchedule.notifyBreeder.useMutation({
    onSuccess: (data) => {
      toast.success(`Confirmation email sent to ${data.sentTo}!`);
      setNotifyingId(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setNotifyingId(null);
    },
  });

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  // ─── Dialog helpers ─────────────────────────────────────────────────────────

  function openAdd(dateStr?: string) {
    const f = { ...EMPTY_FORM };
    if (dateStr) {
      const d = new Date(dateStr + "T12:00:00");
      f.classDate = dateStr;
      f.dayOfWeek = DOW_FROM_JS[d.getDay()];
    }
    setForm(f); setEditId(null); setShowDialog(true);
  }

  function openEdit(slot: (typeof slots)[0]) {
    setForm({
      classDate: slot.classDate, dayOfWeek: slot.dayOfWeek as DayOfWeek,
      location: slot.location as Location, breed: slot.breed,
      breederId: slot.breederId, breederName: slot.breederName,
      startTime: slot.startTime, endTime: slot.endTime,
      classType: slot.classType as "regular" | "private", notes: slot.notes ?? "",
      repeatWeekly: false,
    });
    setEditId(slot.id); setShowDialog(true);
  }

  function handleDateChange(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    setForm(f => ({ ...f, classDate: dateStr, dayOfWeek: DOW_FROM_JS[d.getDay()] }));
  }

  function handleBreederChange(breederId: string) {
    const b = activeBreeders.find((b: any) => b.id === Number(breederId));
    setForm(f => ({ ...f, breederId: Number(breederId), breederName: b?.name ?? "", breed: f.breed || b?.breed || "" }));
  }

  function handleSubmit() {
    if (!form.classDate || !form.dayOfWeek || !form.location || !form.breed || !form.breederId) {
      toast.error("Please fill in all required fields."); return;
    }
    const payload = {
      classDate: form.classDate, dayOfWeek: form.dayOfWeek as DayOfWeek,
      location: form.location as Location, breed: form.breed,
      breederId: form.breederId, breederName: form.breederName,
      startTime: form.startTime, endTime: form.endTime,
      classType: form.classType, notes: form.notes || undefined,
    };
    if (editId !== null) {
      updateMutation.mutate({ id: editId, ...payload });
    } else if (form.repeatWeekly) {
      recurringMutation.mutate({ ...payload, year, month });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleNotify(e: React.MouseEvent, slotId: number) {
    e.stopPropagation();
    setNotifyingId(slotId);
    notifyMutation.mutate({ slotId });
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const slotsByDate = useMemo(() => {
    const map: Record<string, typeof slots> = {};
    for (const s of slots) { if (!map[s.classDate]) map[s.classDate] = []; map[s.classDate].push(s); }
    return map;
  }, [slots]);

  /**
   * Conflict detection: a conflict exists when two or more slots on the same date
   * share the same location. Returns a Set of slot IDs that are in conflict.
   */
  const conflictSlotIds = useMemo(() => {
    const ids = new Set<number>();
    for (const dateSlots of Object.values(slotsByDate)) {
      const locCounts: Record<string, number[]> = {};
      for (const s of dateSlots) {
        if (!locCounts[s.location]) locCounts[s.location] = [];
        locCounts[s.location].push(s.id);
      }
      for (const group of Object.values(locCounts)) {
        if (group.length > 1) group.forEach(id => ids.add(id));
      }
    }
    return ids;
  }, [slotsByDate]);

  const calendarGrid = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const todayIsWeekend = today.getDay() === 0 || today.getDay() === 6;

  const stats = useMemo(() => ({
    total: slots.length,
    kitchener: slots.filter(s => s.location === "Kitchener").length,
    hamilton:  slots.filter(s => s.location === "Hamilton").length,
    oakville:  slots.filter(s => s.location === "Oakville").length,
    private:   slots.filter(s => s.classType === "private").length,
    conflicts: conflictSlotIds.size > 0 ? Math.floor(conflictSlotIds.size / 2) : 0,
  }), [slots, conflictSlotIds]);

  const isPending = createMutation.isPending || updateMutation.isPending || recurringMutation.isPending;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="font-body text-sm text-[#6B4C3B]">
            Assign breeds and breeders to class slots. Weekends are highlighted.
          </p>
          {stats.conflicts > 0 && (
            <p className="flex items-center gap-1.5 font-body text-xs text-red-600 font-semibold mt-1">
              <AlertTriangle size={12} />
              {stats.conflicts} double-booking{stats.conflicts !== 1 ? "s" : ""} detected — same location booked twice on the same day
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Weekend-only toggle */}
          <label className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full border transition-colors font-body text-xs font-semibold select-none ${
            weekendOnly
              ? "bg-[#FFF0F6] border-[#F0D0DC] text-[#C2185B]"
              : "bg-white border-[#E8D0D8] text-[#9E7B6B] hover:border-[#F0D0DC]"
          }`}>
            <Switch
              checked={weekendOnly}
              onCheckedChange={setWeekendOnly}
              className="data-[state=checked]:bg-[#C2185B] scale-75 origin-left"
            />
            Weekends only
          </label>
          <Button
            onClick={() => openAdd()}
            className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-5 gap-2"
          >
            <Plus size={16} /> Add Slot
          </Button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        {[
          { label: "Total Slots",    value: stats.total,     color: "text-[#C2185B]"  },
          { label: "Kitchener",      value: stats.kitchener, color: "text-pink-600"   },
          { label: "Hamilton",       value: stats.hamilton,  color: "text-purple-600" },
          { label: "Oakville",       value: stats.oakville,  color: "text-teal-600"   },
          { label: "Private Events", value: stats.private,   color: "text-amber-600"  },
          { label: "Conflicts",      value: stats.conflicts, color: stats.conflicts > 0 ? "text-red-600" : "text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-white rounded-xl border p-4 ${label === "Conflicts" && stats.conflicts > 0 ? "border-red-200 bg-red-50" : "border-[#F0D0DC]"}`}>
            <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
            <div className="font-body text-xs text-[#6B4C3B] mt-0.5 flex items-center gap-1">
              {label === "Conflicts" && stats.conflicts > 0 && <AlertTriangle size={10} className="text-red-500" />}
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Month navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[#F0D0DC] text-[#6B4C3B] hover:text-[#C2185B] transition-all" aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <CalendarDays size={20} className="text-[#C2185B]" />
          <h3 className="font-display text-xl font-bold text-[#1A0A12]">
            {MONTH_NAMES[month - 1]} {year}
          </h3>
          {isLoading && <Loader2 size={16} className="animate-spin text-[#C2185B]" />}
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[#F0D0DC] text-[#6B4C3B] hover:text-[#C2185B] transition-all" aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* ── Calendar grid ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden shadow-sm">
        {/* Day-of-week header — asymmetric widths; weekday cols hidden in weekendOnly mode */}
        <div
          className="border-b border-[#F0D0DC]"
          style={{ display: "grid", gridTemplateColumns: weekendOnly ? "1fr 1fr" : "2fr 1fr 1fr 1fr 1fr 1fr 2fr" }}
        >
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => {
            const isWknd = i === 0 || i === 6;
            if (weekendOnly && !isWknd) return null;
            return (
              <div
                key={d}
                className={`py-2.5 text-center font-body text-xs font-bold tracking-wider uppercase border-r border-[#F0D0DC] last:border-r-0 ${
                  isWknd
                    ? "text-[#C2185B] bg-[#FFF0F6]"
                    : "text-[#B0907A] bg-[#FAFAFA]"
                }`}
              >
                {isWknd ? (
                  <span className="flex flex-col items-center gap-0.5">
                    <span>{d}</span>
                    <span className="text-[9px] font-normal text-[#C2185B] opacity-80 tracking-normal normal-case">class day</span>
                  </span>
                ) : d}
              </div>
            );
          })}
        </div>

        {/* Calendar rows */}
        {calendarGrid.map((row, ri) => (
          <div
            key={ri}
            className="border-b border-[#F0D0DC] last:border-b-0"
            style={{ display: "grid", gridTemplateColumns: weekendOnly ? "1fr 1fr" : "2fr 1fr 1fr 1fr 1fr 1fr 2fr" }}
          >
            {row.map((dateStr, ci) => {
              if (weekendOnly && ci !== 0 && ci !== 6) return null;
              const isWeekend = ci === 0 || ci === 6;
              const isToday   = dateStr === todayStr;
              const isTodayWeekend = isToday && todayIsWeekend;
              const daySlots  = dateStr ? (slotsByDate[dateStr] ?? []) : [];
              const dayNum    = dateStr ? parseInt(dateStr.split("-")[2], 10) : null;
              const hasConflict = daySlots.some(s => conflictSlotIds.has(s.id));
              return (
                <div
                  key={ci}
                  className={`border-r border-[#F0D0DC] last:border-r-0 flex flex-col transition-colors ${
                    !dateStr
                      ? "bg-[#FAFAFA]"
                      : hasConflict
                        ? "bg-red-50 hover:bg-red-100 cursor-pointer group"
                        : isTodayWeekend
                          ? "bg-[#FFE0EF] hover:bg-[#FFD0E8] cursor-pointer group ring-2 ring-[#C2185B] ring-inset"
                          : isWeekend
                            ? "bg-[#FFF5F9] hover:bg-[#FFE8F2] cursor-pointer group"
                            : "bg-white hover:bg-[#FEFAF4] cursor-pointer group"
                  }`}
                  style={{ minHeight: isWeekend ? "120px" : "88px", padding: isWeekend ? "8px" : "5px" }}
                  onClick={() => dateStr && openAdd(dateStr)}
                >
                  {dayNum !== null && (
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-body font-semibold flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-[#C2185B] text-white"
                            : hasConflict
                              ? "text-red-600 font-bold"
                              : isWeekend
                              ? isTodayWeekend ? "text-white" : "text-[#C2185B] font-bold"
                              : "text-[#B0907A]"
                        }`}
                        style={{
                          width: isWeekend ? "26px" : "20px",
                          height: isWeekend ? "26px" : "20px",
                          fontSize: isWeekend ? "13px" : "11px",
                        }}
                      >
                        {dayNum}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {hasConflict && (
                          <span title="Double-booking: same location booked twice">
                            <AlertTriangle size={11} className="text-red-500" />
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); if (dateStr) openAdd(dateStr); }}
                          className={`opacity-0 group-hover:opacity-100 rounded-full bg-[#C2185B] text-white flex items-center justify-center transition-opacity hover:bg-[#AD1457] ${
                            isWeekend ? "w-5 h-5" : "w-4 h-4"
                          }`}
                          aria-label="Add slot"
                        >
                          <Plus size={isWeekend ? 10 : 8} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Slot chips — full on weekends, compact dots on weekdays */}
                  <div className="flex flex-col gap-0.5 flex-1">
                    {daySlots.map(slot => {
                      const loc = slot.location as Location;
                      const c = LOCATION_COLORS[loc];
                      const isConflict = conflictSlotIds.has(slot.id);
                      if (isWeekend) {
                        // Full chip: location + time + notify button + conflict indicator
                        return (
                          <div
                            key={slot.id}
                            onClick={(e) => { e.stopPropagation(); openEdit(slot); }}
                            className={`rounded-md px-2 py-1 text-[11px] font-body font-semibold border cursor-pointer hover:brightness-95 transition-all flex items-start gap-1.5 ${
                              isConflict
                                ? "bg-red-50 text-red-800 border-red-300"
                                : `${c.bg} ${c.text} ${c.border}`
                            }`}
                            title={`${slot.location} · ${slot.breederName} · ${fmt12(slot.startTime)}–${fmt12(slot.endTime)}${isConflict ? " ⚠ Double-booking!" : ""}`}
                          >
                            <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isConflict ? "bg-red-400" : c.dot}`} />
                            <span className="leading-tight min-w-0 flex-1">
                              <span className="block truncate">
                                {slot.location}
                                {slot.classType === "private" && <Lock size={9} className="inline ml-0.5 mb-0.5 opacity-70" />}
                                {isConflict && <AlertTriangle size={9} className="inline ml-0.5 mb-0.5 text-red-500" />}
                              </span>
                              <span className="block opacity-70 text-[10px]">{fmt12(slot.startTime)}–{fmt12(slot.endTime)}</span>
                              {slot.breed && <span className="block opacity-60 text-[9px] truncate">{slot.breed}</span>}
                              {slot.breederName && (
                                <span className="block text-[9px] font-semibold opacity-80 truncate">
                                  {slot.breederName.split(" ")[0]}
                                </span>
                              )}
                            </span>
                            {/* Notify Breeder button */}
                            <button
                              onClick={(e) => handleNotify(e, slot.id)}
                              disabled={notifyingId === slot.id}
                              className={`shrink-0 mt-0.5 rounded p-0.5 transition-colors ${
                                isConflict
                                  ? "text-red-400 hover:bg-red-100"
                                  : "text-current opacity-50 hover:opacity-100 hover:bg-white/60"
                              }`}
                              title="Send confirmation email to breeder"
                              aria-label="Notify breeder"
                            >
                              {notifyingId === slot.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <Mail size={11} />
                              }
                            </button>
                          </div>
                        );
                      } else {
                        // Compact dot: colored dot + location abbreviation only
                        const abbr = loc === "Kitchener" ? "KW" : loc === "Hamilton" ? "HAM" : "OAK";
                        return (
                          <div
                            key={slot.id}
                            onClick={(e) => { e.stopPropagation(); openEdit(slot); }}
                            className={`rounded px-1 py-0.5 text-[9px] font-body font-medium border cursor-pointer hover:brightness-95 transition-all flex items-center gap-1 ${
                              isConflict
                                ? "bg-red-50 text-red-700 border-red-300"
                                : `${c.bg} ${c.text} ${c.border}`
                            }`}
                            title={`${slot.location} · ${slot.breederName} · ${fmt12(slot.startTime)}–${fmt12(slot.endTime)}${isConflict ? " ⚠ Double-booking!" : ""}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConflict ? "bg-red-400" : c.dot}`} />
                            <span className="truncate">
                              {abbr}
                              {slot.classType === "private" && <Lock size={7} className="inline ml-0.5 opacity-70" />}
                              {isConflict && <AlertTriangle size={7} className="inline ml-0.5 text-red-500" />}
                            </span>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mt-4 items-center">
        <span className="font-body text-xs text-[#9E7B6B] font-semibold uppercase tracking-wider">Legend:</span>
        {LOCATIONS.map(loc => {
          const c = LOCATION_COLORS[loc];
          return (
            <span key={loc} className={`flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />{loc}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
          <Lock size={10} /> Private Event
        </span>
        <span className="flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border bg-[#FFF5F8] text-[#C2185B] border-[#F0D0DC]">
          Weekend
        </span>
        <span className="flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200">
          <AlertTriangle size={10} /> Conflict
        </span>
        <span className="flex items-center gap-1.5 font-body text-xs font-semibold px-2.5 py-1 rounded-full border bg-white text-[#6B4C3B] border-[#F0D0DC]">
          <Mail size={10} /> Notify Breeder
        </span>
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
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Date <span className="text-red-500">*</span></Label>
              <Input type="date" className="mt-1 border-[#F0D0DC] font-body text-sm" value={form.classDate} onChange={e => handleDateChange(e.target.value)} />
              {form.dayOfWeek && (
                <p className="text-xs text-[#6B4C3B] mt-1 font-body">
                  Day: <span className="font-semibold">{form.dayOfWeek}</span>
                  {(form.dayOfWeek === "Saturday" || form.dayOfWeek === "Sunday") && <span className="ml-1 text-[#C2185B]">· Weekend class</span>}
                </p>
              )}
            </div>

            {/* Repeat Weekly toggle — only show when adding (not editing) */}
            {editId === null && (
              <div className={`rounded-xl border p-3 transition-colors ${form.repeatWeekly ? "bg-[#FFF0F6] border-[#F0D0DC]" : "bg-white border-[#F0D0DC]"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-body text-sm text-[#1A0A12] font-semibold flex items-center gap-2 cursor-pointer">
                      <Repeat size={14} className="text-[#C2185B]" />
                      Repeat Weekly
                    </Label>
                    <p className="font-body text-xs text-[#6B4C3B] mt-0.5">
                      {form.repeatWeekly
                        ? `Creates a slot on every ${form.dayOfWeek || "selected weekday"} in ${MONTH_NAMES[month - 1]} ${year}`
                        : "Create this slot once, or toggle to fill the whole month"}
                    </p>
                  </div>
                  <Switch
                    checked={form.repeatWeekly}
                    onCheckedChange={v => setForm(f => ({ ...f, repeatWeekly: v }))}
                    className="data-[state=checked]:bg-[#C2185B]"
                  />
                </div>
                {form.repeatWeekly && form.dayOfWeek && (
                  <p className="font-body text-xs text-[#C2185B] font-semibold mt-2 flex items-center gap-1">
                    <Repeat size={11} />
                    Will create slots for all {form.dayOfWeek}s in {MONTH_NAMES[month - 1]} — existing bookings at the same location will be skipped automatically.
                  </p>
                )}
              </div>
            )}

            {/* Class Type */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Class Type</Label>
              <Select value={form.classType} onValueChange={v => setForm(f => ({ ...f, classType: v as "regular" | "private" }))}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular (weekend class)</SelectItem>
                  <SelectItem value="private">Private Event (any day)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Location */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Location <span className="text-red-500">*</span></Label>
              <Select value={form.location} onValueChange={v => setForm(f => ({ ...f, location: v as Location }))}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map(loc => (
                    <SelectItem key={loc} value={loc}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${LOCATION_COLORS[loc].dot}`} />{loc}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Start / End time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold flex items-center gap-1"><Clock size={13} /> Start Time</Label>
                <Input type="time" className="mt-1 border-[#F0D0DC] font-body text-sm" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold flex items-center gap-1"><Clock size={13} /> End Time</Label>
                <Input type="time" className="mt-1 border-[#F0D0DC] font-body text-sm" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-[#9E7B6B] font-body -mt-2">3 classes: 9 AM–3 PM · 4 classes: 9 AM–4:30 PM</p>
            {/* Breeder */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breeder <span className="text-red-500">*</span></Label>
              <Select value={form.breederId ? String(form.breederId) : ""} onValueChange={handleBreederChange}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm"><SelectValue placeholder="Select breeder" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {activeBreeders.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.breed ? ` — ${b.breed}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Breed */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breed <span className="text-red-500">*</span></Label>
              <Input className="mt-1 border-[#F0D0DC] font-body text-sm" placeholder="e.g. Golden Retriever, Cavapoo" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} />
              <p className="text-xs text-[#9E7B6B] mt-1 font-body">Auto-filled from breeder profile — edit if different.</p>
            </div>
            {/* Notes */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Notes <span className="text-[#9E7B6B] font-normal">(optional)</span></Label>
              <Textarea className="mt-1 border-[#F0D0DC] font-body text-sm resize-none" placeholder="e.g. 4 puppies, drop-off at 9:30 AM" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {/* Delete button when editing */}
            {editId !== null && (
              <div className="pt-2 border-t border-[#F0D0DC]">
                <Button variant="outline" onClick={() => { setShowDialog(false); setDeleteId(editId); }} className="w-full border-red-200 text-red-600 hover:bg-red-50 font-body">
                  <Trash2 size={14} className="mr-2" /> Remove this slot
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditId(null); setForm({ ...EMPTY_FORM }); }} className="font-body border-[#F0D0DC]">Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-6">
              {isPending && <Loader2 size={14} className="animate-spin mr-2" />}
              {editId !== null ? "Save Changes" : form.repeatWeekly ? "Create All Slots" : "Add Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#FEFAF4] border-[#F0D0DC]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[#1A0A12]">Remove this slot?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-[#6B4C3B]">This will permanently remove the class slot. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body border-[#F0D0DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })} className="bg-red-600 hover:bg-red-700 text-white font-body">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
