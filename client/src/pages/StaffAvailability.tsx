import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link, Redirect, useSearch } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Mail, MessageSquare, Send, X } from "lucide-react";
import { individualScheduleDeliveryFeedback } from "@shared/individualNotification";
import { legacyEmployeeTreeUrl } from "@shared/employeeDirectoryNavigation";

const LOCATIONS = ["KW", "OAK", "HAM"] as const;
const LOCATION_LABELS: Record<string, string> = { KW: "Kitchener", OAK: "Oakville", HAM: "Hamilton", CENTRAL: "APY-wide" };
const LEAVE_COLORS: Record<string, string> = { vacation: "#F59E0B", sick: "#EF4444", personal: "#8B5CF6", leave: "#6B7280", unavailable: "#374151" };
const LEAVE_LABELS: Record<string, string> = { vacation: "🌴 Vacation", sick: "🤒 Sick", personal: "🏠 Personal", leave: "📋 Leave", unavailable: "⛔ Unavailable" };

type StaffMember = { id: number; name: string; email: string; phone: string | null; role: string; location: string; appStatus: string; archivedAt: Date | null };
type WeekendShift = { date: string; dayLabel: string; shortLabel: string; location: "KW" | "OAK" | "HAM"; role: "Operations Manager" | "Yoga Instructor"; primary: Pick<StaffMember, "id" | "name" | "role" | "location"> | null; primaryLeave: { leaveType: string } | null; coverage: { coverageStaffId: number | null; coverageStaffName: string | null; notes: string | null } | null; candidates: Pick<StaffMember, "id" | "name" | "role" | "location">[]; status: "available" | "away" | "covered" | "unassigned" };
type ScheduledClassStaffing = { id: number; classDate: string; location: "Kitchener" | "Hamilton" | "Oakville"; breed: string; breederName: string; startTime: string; endTime: string; staffing: { operationsManager: { id: number; name: string } | null; yogaInstructor: { id: number; name: string } | null; eligibleOperationsManagers: { id: number; name: string }[]; eligibleYogaInstructors: { id: number; name: string }[]; assignedPuppyMonitors: { id: number; staffId: number; name: string }[]; eligiblePuppyMonitors: { id: number; name: string }[]; gaps: { operationsManager: boolean; yogaInstructor: boolean; puppyMonitors: number }; fullyStaffed: boolean } };

// ─── Weekend day card ─────────────────────────────────────────────────
function WeekendDayCard({ date, dayLabel, shortLabel, location, shifts, classes, onShiftClick, onClassClick }: {
  date: string; dayLabel: string; shortLabel: string; location: string;
  shifts: { role: string; shift: WeekendShift | undefined }[];
  classes: ScheduledClassStaffing[];
  onShiftClick: (s: WeekendShift) => void;
  onClassClick: (c: ScheduledClassStaffing) => void;
}) {
  const statusIcon = (s: WeekendShift | undefined) => {
    if (!s) return <span className="text-rose-500 text-sm">✗</span>;
    if (s.status === "available" || s.status === "covered") return <span className="text-emerald-600 text-sm">✓</span>;
    if (s.status === "away") return <span className="text-amber-500 text-sm">!</span>;
    return <span className="text-rose-500 text-sm">✗</span>;
  };
  return (
    <div className="rounded-2xl border border-[#EADBE2] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B2252]">{dayLabel}</p>
          <p className="text-lg font-bold text-[#1A0A12]">{shortLabel}</p>
        </div>
        <span className="rounded-full bg-[#8B2252]/10 px-2.5 py-1 text-[10px] font-bold text-[#8B2252]">{LOCATION_LABELS[location] ?? location}</span>
      </div>
      <div className="space-y-2">
        {shifts.map(({ role, shift }) => (
          <button key={role} type="button" onClick={() => shift && onShiftClick(shift)} className="flex w-full items-center gap-2 rounded-lg border border-[#F1E7E2] px-3 py-2 text-left transition-colors hover:bg-[#FAF5F2]">
            {statusIcon(shift)}
            <span className="text-xs font-bold text-[#1A0A12]">{role}</span>
            <span className="ml-auto truncate text-[11px] text-[#7A5A6A]">{shift?.coverage?.coverageStaffName ?? shift?.primary?.name ?? "Unassigned"}</span>
          </button>
        ))}
        {classes.map((cls) => {
          const count = cls.staffing.assignedPuppyMonitors.length;
          const full = count >= 2;
          return (
            <button key={cls.id} type="button" onClick={() => onClassClick(cls)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:brightness-95 ${full ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <span className={`text-sm ${full ? "text-emerald-600" : "text-amber-500"}`}>{full ? "✓" : "!"}</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#1A0A12]">{cls.breed}</p>
                <p className="text-[10px] text-[#7A5A6A]">PMs: {count}/2</p>
              </div>
              <span className="ml-auto text-[10px] font-medium text-[#7A5A6A]">{full ? cls.staffing.assignedPuppyMonitors.map((m) => m.name).join(", ") : "Assign →"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function StaffAvailabilityPage() {
  const redirect = legacyEmployeeTreeUrl(useSearch());
  return redirect ? <Redirect to={redirect} replace /> : <WeekendAvailabilityPage />;
}

function WeekendAvailabilityPage() {
  const [weekendIndex, setWeekendIndex] = useState(0);

  const { data } = trpc.staffAvailability.getOrgChart.useQuery();
  const [weekendCoverageInput] = useState(() => ({ weekends: 6 }));
  const weekendCoverage = trpc.staffAvailability.getWeekendCoverage.useQuery(weekendCoverageInput);
  const classStaffing = trpc.puppySchedule.listWithStaffing.useQuery();

  const [selectedWeekendShift, setSelectedWeekendShift] = useState<WeekendShift | null>(null);
  const [coverageDraft, setCoverageDraft] = useState({ coverageStaffId: "", notes: "" });
  const [selectedClassStaffing, setSelectedClassStaffing] = useState<ScheduledClassStaffing | null>(null);
  const [selectedPuppyMonitor, setSelectedPuppyMonitor] = useState("");
  const [selectedOperationsManager, setSelectedOperationsManager] = useState("");
  const [selectedYogaInstructor, setSelectedYogaInstructor] = useState("");
  const notificationPreview = trpc.puppySchedule.eventNotificationPreview.useQuery({ scheduleId: selectedClassStaffing?.id ?? 0 }, { enabled: Boolean(selectedClassStaffing) });

  const utils = trpc.useUtils();
  const refreshAvailability = () => {
    void utils.staffAvailability.listEmployees.invalidate();
    void utils.staffAvailability.getOrgChart.invalidate();
    void utils.staffAvailability.getWeekendCoverage.invalidate();
    void utils.puppySchedule.listWithStaffing.invalidate();
    void utils.staff.listStaff.invalidate();
  };
  const deleteLeave = trpc.staffAvailability.deleteLeave.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Leave removed"); } });
  const markWeekendAway = trpc.staffAvailability.addLeave.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Saved"); setSelectedWeekendShift(null); } });
  const assignWeekendCoverage = trpc.staffAvailability.assignWeekendCoverage.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Coverage updated"); setSelectedWeekendShift(null); }, onError: (e) => toast.error(e.message) });
  const assignPuppyMonitor = trpc.puppySchedule.assignPuppyMonitor.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("PM assigned"); setSelectedClassStaffing(null); setSelectedPuppyMonitor(""); }, onError: (e) => toast.error(e.message) });
  const removePuppyMonitor = trpc.puppySchedule.removePuppyMonitorAssignment.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("PM removed"); setSelectedClassStaffing(null); }, onError: (e) => toast.error(e.message) });
  const assignLeadership = trpc.puppySchedule.assignLeadership.useMutation({ onSuccess: () => { refreshAvailability(); notificationPreview.refetch(); toast.success("Class leadership updated"); setSelectedClassStaffing(null); setSelectedOperationsManager(""); setSelectedYogaInstructor(""); }, onError: (e) => toast.error(e.message) });
  const notifyEventTeam = trpc.puppySchedule.notifyEventTeam.useMutation({ onSuccess: (result) => { notificationPreview.refetch(); const delivered = result.results.filter((item) => item.emailStatus === "sent" || item.smsStatus === "sent").length; toast.success(`Schedule sent to ${delivered} team members`); }, onError: (e) => toast.error(e.message) });
  const notifyIndividualEventStaff = trpc.puppySchedule.notifyIndividualEventStaff.useMutation({ onSuccess: (result) => { notificationPreview.refetch(); const feedback = individualScheduleDeliveryFeedback({ deliveryStatus: result.deliveryStatus, name: result.result.name, errors: result.result.errors }); if (feedback.kind === "success") toast.success(feedback.message); else if (feedback.kind === "warning") toast.warning(feedback.message); else toast.error(feedback.message); }, onError: (e) => toast.error(e.message) });

  const leaves = data?.leaves ?? [];
  const openWeekendShift = (s: WeekendShift) => { setSelectedWeekendShift(s); setCoverageDraft({ coverageStaffId: s.coverage?.coverageStaffId ? String(s.coverage.coverageStaffId) : "", notes: s.coverage?.notes ?? "" }); };
  const openClassStaffing = (c: ScheduledClassStaffing) => { setSelectedClassStaffing(c); setSelectedPuppyMonitor(""); setSelectedOperationsManager(""); setSelectedYogaInstructor(""); };

  const weekendDates = weekendCoverage.data?.weekends ?? [];
  const weekendShifts = (weekendCoverage.data?.shifts ?? []) as WeekendShift[];
  const scheduledClasses = (classStaffing.data ?? []) as ScheduledClassStaffing[];

  // Group weekends into pairs (Sat + Sun)
  const weekendPairs: { sat: typeof weekendDates[0]; sun: typeof weekendDates[0] }[] = [];
  for (let i = 0; i < weekendDates.length; i += 2) {
    if (weekendDates[i] && weekendDates[i + 1]) weekendPairs.push({ sat: weekendDates[i], sun: weekendDates[i + 1] });
    else if (weekendDates[i]) weekendPairs.push({ sat: weekendDates[i], sun: weekendDates[i] });
  }
  const currentPair = weekendPairs[weekendIndex] ?? weekendPairs[0];
  const findShift = (date: string, loc: string, role: string) => weekendShifts.find((s) => s.date === date && s.location === loc && s.role === role);
  const classesForDate = (date: string) => scheduledClasses.filter((c) => c.classDate === date);

  return (
    <div className="min-h-screen bg-[#F7F2EE]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EDE0D8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/staff" className="flex items-center gap-1.5 text-xs font-medium text-[#8B2252] hover:text-[#6B1A3E]"><ArrowLeft size={13} /> APY HQ</Link>
            <span className="text-[#D4B8C4]">/</span>
            <Link href="/admin/employees" className="text-sm font-bold text-[#8B2252] hover:underline">Employee Directory</Link><span className="text-[#D4B8C4]">/</span><p className="text-sm font-bold text-[#1A0A12]">Weekend Ops</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[#7A5A6A] lg:block">{new Date().toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</span>
            <Link href="/admin/employees?tab=tree" className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2252] px-3 py-2 text-xs font-bold text-white hover:bg-[#6B1A3E]">Team Tree</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-6">
        {/* ═══════════════════════ WEEKEND OPS TAB ═══════════════════════ */}
        {
          <div>
            {/* Weekend navigator */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#1A0A12]">This Weekend</h2>
                <p className="mt-0.5 text-xs text-[#7A5A6A]">All staffing for {currentPair?.sat?.shortLabel} – {currentPair?.sun?.shortLabel}. Tap any row to manage.</p>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={weekendIndex === 0} onClick={() => setWeekendIndex((i) => Math.max(0, i - 1))} className="rounded-lg border border-[#EDE0D8] p-2 text-[#7A5A6A] transition-colors hover:bg-[#FAF5F2] disabled:opacity-30"><ChevronLeft size={16} /></button>
                <span className="text-xs font-bold text-[#8B2252]">{weekendIndex + 1} / {weekendPairs.length || 1}</span>
                <button disabled={weekendIndex >= weekendPairs.length - 1} onClick={() => setWeekendIndex((i) => Math.min(weekendPairs.length - 1, i + 1))} className="rounded-lg border border-[#EDE0D8] p-2 text-[#7A5A6A] transition-colors hover:bg-[#FAF5F2] disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>

            {weekendCoverage.isLoading ? <div className="py-16 text-center text-sm text-[#8B2252]">Loading…</div> : currentPair ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {[currentPair.sat, currentPair.sun].filter(Boolean).map((day) => (
                  <div key={day.date} className="space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#8B2252]">{day.dayLabel} · {day.shortLabel}</p>
                    {LOCATIONS.map((loc) => {
                      const dayClasses = classesForDate(day.date).filter((c) => {
                        const code = c.location === "Kitchener" ? "KW" : c.location === "Hamilton" ? "HAM" : "OAK";
                        return code === loc;
                      });
                      const shifts = [
                        { role: "Ops Manager", shift: findShift(day.date, loc, "Operations Manager") },
                        { role: "Yoga Instructor", shift: findShift(day.date, loc, "Yoga Instructor") },
                      ];
                      // Only show location if it has a class or has assigned leadership
                      if (dayClasses.length === 0 && shifts.every((s) => !s.shift || s.shift.status === "unassigned")) return null;
                      return <WeekendDayCard key={loc} date={day.date} dayLabel={day.dayLabel} shortLabel={day.shortLabel} location={loc} shifts={shifts} classes={dayClasses} onShiftClick={openWeekendShift} onClassClick={openClassStaffing} />;
                    })}
                    {classesForDate(day.date).length === 0 && <p className="rounded-xl border border-dashed border-[#DCCAD3] px-4 py-6 text-center text-xs text-[#B39AA5]">No classes scheduled this day</p>}
                  </div>
                ))}
              </div>
            ) : <p className="py-16 text-center text-sm text-[#7A5A6A]">No upcoming weekends found.</p>}

            {/* Active leave summary */}
            {leaves.length > 0 && (
              <section className="mt-8">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#8B2252]">Active & Upcoming Leave</h3>
                <div className="space-y-2">
                  {leaves.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border border-[#F1E7E2] bg-white px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: LEAVE_COLORS[l.leaveType] }}>{LEAVE_LABELS[l.leaveType]}</span>
                        <span className="text-sm font-medium text-[#1A0A12]">{l.staffName}</span>
                        <span className="text-xs text-[#7A5A6A]">{l.startDate} → {l.endDate}</span>
                      </div>
                      <button onClick={() => deleteLeave.mutate({ id: l.id })} className="text-[#C4A0B0] hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        }

      </main>

      {/* ═══════════════════════ MODALS ═══════════════════════ */}

      {/* Weekend shift editor */}
      {selectedWeekendShift && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between"><div><h3 className="text-base font-bold text-[#1A0A12]">{LOCATION_LABELS[selectedWeekendShift.location]} · {selectedWeekendShift.role}</h3><p className="text-xs text-[#7A5A6A]">{selectedWeekendShift.dayLabel}, {selectedWeekendShift.shortLabel}</p></div><button onClick={() => setSelectedWeekendShift(null)} className="text-[#C4A0B0] hover:text-[#8B2252]"><X size={18} /></button></div>
        <div className="space-y-3">
          <div className={`rounded-lg border p-3 text-sm ${selectedWeekendShift.status === "available" ? "border-emerald-200 bg-emerald-50" : selectedWeekendShift.status === "away" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"}`}><p className="font-bold">{selectedWeekendShift.primary?.name ?? "No primary assigned"}</p><p className="text-xs">{selectedWeekendShift.status === "away" ? "Away" : selectedWeekendShift.status === "available" ? "Available" : "Unassigned"}</p></div>
          {selectedWeekendShift.primary && selectedWeekendShift.status !== "away" && <button onClick={() => markWeekendAway.mutate({ staffId: selectedWeekendShift.primary!.id, staffName: selectedWeekendShift.primary!.name, leaveType: "unavailable", startDate: selectedWeekendShift.date, endDate: selectedWeekendShift.date, notes: "Marked from coverage board" })} disabled={markWeekendAway.isPending} className="w-full rounded-lg border border-amber-200 bg-amber-50 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">{markWeekendAway.isPending ? "Saving…" : `Mark ${selectedWeekendShift.primary.name} away`}</button>}
          <select value={coverageDraft.coverageStaffId} onChange={(e) => setCoverageDraft((d) => ({ ...d, coverageStaffId: e.target.value }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm"><option value="">No cover selected</option>{selectedWeekendShift.candidates.map((c) => <option key={c.id} value={c.id}>{c.name} · {LOCATION_LABELS[c.location]}</option>)}</select>
          <textarea value={coverageDraft.notes} onChange={(e) => setCoverageDraft((d) => ({ ...d, notes: e.target.value }))} rows={2} placeholder="Coverage notes (optional)" className="w-full resize-none rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => assignWeekendCoverage.mutate({ coverageDate: selectedWeekendShift.date, location: selectedWeekendShift.location, role: selectedWeekendShift.role, coverageStaffId: coverageDraft.coverageStaffId ? Number(coverageDraft.coverageStaffId) : null, notes: coverageDraft.notes })} disabled={assignWeekendCoverage.isPending} className="rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white hover:bg-[#6B1A3E] disabled:opacity-50">{assignWeekendCoverage.isPending ? "Saving…" : "Save"}</button><button onClick={() => setSelectedWeekendShift(null)} className="rounded-xl border border-[#EDE0D8] py-2.5 text-sm text-[#7A5A6A] hover:bg-[#FAF5F2]">Close</button></div>
      </div></div>}

      {/* Class PM editor */}
      {selectedClassStaffing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between"><div><h3 className="text-base font-bold text-[#1A0A12]">{selectedClassStaffing.breed} · {selectedClassStaffing.location}</h3><p className="text-xs text-[#7A5A6A]">{selectedClassStaffing.classDate} · Breeder: {selectedClassStaffing.breederName}</p></div><button onClick={() => setSelectedClassStaffing(null)} className="text-[#C4A0B0] hover:text-[#8B2252]"><X size={18} /></button></div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-[#EDE0D8] bg-[#FFFDFC] p-2.5"><p className="text-xs font-bold text-[#1A0A12]">Operations Manager · {selectedClassStaffing.staffing.operationsManager?.name ?? "Coverage gap"}</p><div className="mt-2 flex gap-2"><select value={selectedOperationsManager} onChange={(e) => setSelectedOperationsManager(e.target.value)} className="min-w-0 flex-1 rounded-md border border-[#EDE0D8] px-2 py-1.5 text-xs"><option value="">Select Operations Manager</option>{selectedClassStaffing.staffing.eligibleOperationsManagers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button onClick={() => selectedOperationsManager && assignLeadership.mutate({ scheduleId: selectedClassStaffing.id, role: "Operations Manager", staffId: Number(selectedOperationsManager) })} disabled={!selectedOperationsManager || assignLeadership.isPending} className="rounded-md bg-[#8B2252] px-2 py-1 text-xs font-bold text-white disabled:opacity-50">Save</button></div></div><div className="rounded-lg border border-[#EDE0D8] bg-[#FFFDFC] p-2.5"><p className="text-xs font-bold text-[#1A0A12]">Yoga Instructor · {selectedClassStaffing.staffing.yogaInstructor?.name ?? "Coverage gap"}</p><div className="mt-2 flex gap-2"><select value={selectedYogaInstructor} onChange={(e) => setSelectedYogaInstructor(e.target.value)} className="min-w-0 flex-1 rounded-md border border-[#EDE0D8] px-2 py-1.5 text-xs"><option value="">Select Yoga Instructor</option>{selectedClassStaffing.staffing.eligibleYogaInstructors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button onClick={() => selectedYogaInstructor && assignLeadership.mutate({ scheduleId: selectedClassStaffing.id, role: "Yoga Instructor", staffId: Number(selectedYogaInstructor) })} disabled={!selectedYogaInstructor || assignLeadership.isPending} className="rounded-md bg-[#8B2252] px-2 py-1 text-xs font-bold text-white disabled:opacity-50">Save</button></div></div></div>
        <p className="mb-3 rounded-lg border border-[#E6D6F8] bg-[#FAF5FF] px-3 py-2 text-xs font-bold text-[#4C1D95]">Two Puppy Monitors required; a third can be added when needed.</p>
        <div className="space-y-2">
          {selectedClassStaffing.staffing.assignedPuppyMonitors.map((m) => <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#EDE0D8] px-3 py-2"><span className="text-sm font-bold">{m.name}</span><button onClick={() => removePuppyMonitor.mutate({ id: m.id })} className="text-[#C4A0B0] hover:text-red-500"><X size={14} /></button></div>)}
          {Array.from({ length: Math.max(0, 2 - selectedClassStaffing.staffing.assignedPuppyMonitors.length) }, (_, i) => <div key={i} className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">PM {selectedClassStaffing.staffing.assignedPuppyMonitors.length + i + 1} needed</div>)}
        </div>
        {selectedClassStaffing.staffing.assignedPuppyMonitors.length < 3 && <div className="mt-3 flex gap-2"><select value={selectedPuppyMonitor} onChange={(e) => setSelectedPuppyMonitor(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#E6D6F8] px-3 py-2 text-sm"><option value="">Select PM</option>{selectedClassStaffing.staffing.eligiblePuppyMonitors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><button onClick={() => selectedPuppyMonitor && assignPuppyMonitor.mutate({ scheduleId: selectedClassStaffing.id, staffId: Number(selectedPuppyMonitor) })} disabled={!selectedPuppyMonitor || assignPuppyMonitor.isPending} className="rounded-lg bg-[#7C3AED] px-3 py-2 text-xs font-bold text-white hover:bg-[#6D28D9] disabled:opacity-50">{selectedClassStaffing.staffing.assignedPuppyMonitors.length >= 2 ? "Add 3rd PM" : "Assign"}</button></div>}
        <div className="mt-5 border-t border-[#EDE0D8] pt-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-bold text-[#1A0A12]">Notify event team</p><p className="text-[11px] text-[#7A5A6A]">Preview recipients before sending email + text.</p></div><Send size={18} className="text-[#8B2252]"/></div>
          {notificationPreview.isLoading ? <p className="text-xs text-[#7A5A6A]">Preparing preview…</p> : <>
            <div className="space-y-1.5">{notificationPreview.data?.recipients.map((recipient) => {
              const canContact = Boolean(recipient.email || recipient.phone);
              const wasSent = Boolean(recipient.lastSentAt);
              return <div key={`${recipient.role}-${recipient.id}`} className="flex items-center gap-2 rounded-lg bg-[#F7F2EE] px-3 py-2"><span className="min-w-0 flex-1 truncate text-xs font-bold">{recipient.name} · {recipient.role}</span><Mail size={13} className={recipient.email ? "text-emerald-600" : "text-gray-300"}/><MessageSquare size={13} className={recipient.phone ? "text-emerald-600" : "text-gray-300"}/><button type="button" onClick={() => { if (canContact && confirm(`${wasSent ? "Resend" : "Send"} this class schedule to ${recipient.name} only?`)) notifyIndividualEventStaff.mutate({ scheduleId: selectedClassStaffing.id, staffId: recipient.id, resend: wasSent }); }} disabled={!canContact || notifyIndividualEventStaff.isPending} className="shrink-0 rounded-lg border border-[#8B2252]/30 bg-white px-2 py-1 text-[10px] font-bold text-[#8B2252] transition-colors hover:bg-[#8B2252] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={11} className="mr-1 inline"/>{wasSent ? "Resend" : "Message"}</button></div>;
            })}</div>
            {notificationPreview.data?.gapLabels.length ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-bold text-amber-800">Still needed: {notificationPreview.data.gapLabels.join(", ")}</p> : null}
            {notificationPreview.data?.canSend && <div className="mt-3 rounded-lg border border-[#EADBE2] bg-[#FFFCFA] p-3 text-[11px] leading-relaxed text-[#5D4350]">{notificationPreview.data.message}</div>}
            <button onClick={() => { if (confirm(`Send this schedule by email and text to ${notificationPreview.data?.recipients.length ?? 0} team members?`)) notifyEventTeam.mutate({ scheduleId: selectedClassStaffing.id, resend: Boolean(notificationPreview.data?.lastSentAt) }); }} disabled={!notificationPreview.data?.canSend || notifyEventTeam.isPending} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white hover:bg-[#6B1A3E] disabled:opacity-40"><Send size={14}/>{notifyEventTeam.isPending ? "Sending…" : notificationPreview.data?.lastSentAt ? "Resend to assigned team" : "Send to assigned team"}</button>
            {notificationPreview.data?.lastSentAt && <p className="mt-2 text-center text-[10px] font-medium text-emerald-700">Last sent {new Date(notificationPreview.data.lastSentAt).toLocaleString("en-CA")}</p>}
          </>}
        </div>
        <button onClick={() => setSelectedClassStaffing(null)} className="mt-3 w-full rounded-xl border border-[#EDE0D8] py-2 text-sm text-[#7A5A6A] hover:bg-[#FAF5F2]">Close</button>
      </div></div>}


    </div>
  );
}
