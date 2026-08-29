import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft, Calendar, CalendarCheck, ChevronLeft, ChevronRight, Plus, Trash2, Users, X } from "lucide-react";

const LOCATIONS = ["KW", "OAK", "HAM"] as const;
const LOCATION_LABELS: Record<string, string> = { KW: "Kitchener", OAK: "Oakville", HAM: "Hamilton", CENTRAL: "APY-wide" };
const CENTRAL_ROLES = ["BDR", "Social Media Specialist"] as const;
const ROLE_COLORS: Record<string, string> = {
  yoga_instructor: "#8B2252", "Yoga Instructor": "#8B2252",
  puppy_monitor: "#7C3AED", "Puppy Monitor": "#7C3AED",
  puppy_specialist: "#0891B2", "Puppy Specialist": "#0891B2",
  operations_manager: "#D97706", "Operations Manager": "#D97706",
  BDR: "#0F766E", "Social Media Specialist": "#DB2777",
};
const LEAVE_COLORS: Record<string, string> = { vacation: "#F59E0B", sick: "#EF4444", personal: "#8B5CF6", leave: "#6B7280", unavailable: "#374151" };
const LEAVE_LABELS: Record<string, string> = { vacation: "🌴 Vacation", sick: "🤒 Sick", personal: "🏠 Personal", leave: "📋 Leave", unavailable: "⛔ Unavailable" };

type TeamRole = "Yoga Instructor" | "Operations Manager" | "Puppy Monitor" | "Puppy Specialist" | "BDR" | "Social Media Specialist";
type TeamLocation = "KW" | "OAK" | "HAM" | "CENTRAL";
type StaffMember = { id: number; name: string; email: string; phone: string | null; role: string; location: string; appStatus: string };
type WeekendShift = { date: string; dayLabel: string; shortLabel: string; location: "KW" | "OAK" | "HAM"; role: "Operations Manager" | "Yoga Instructor"; primary: Pick<StaffMember, "id" | "name" | "role" | "location"> | null; primaryLeave: { leaveType: string } | null; coverage: { coverageStaffId: number | null; coverageStaffName: string | null; notes: string | null } | null; candidates: Pick<StaffMember, "id" | "name" | "role" | "location">[]; status: "available" | "away" | "covered" | "unassigned" };
type ScheduledClassStaffing = { id: number; classDate: string; location: "Kitchener" | "Hamilton" | "Oakville"; breed: string; breederName: string; staffing: { assignedPuppyMonitors: { id: number; staffId: number; name: string }[]; eligiblePuppyMonitors: { id: number; name: string }[]; fullyStaffed: boolean } };

function isOnLeave(staffId: number, leaves: any[], today: string) {
  return leaves.find((l) => l.staffId === staffId && l.startDate <= today && l.endDate >= today);
}

// ─── Compact person chip ──────────────────────────────────────────────
function PersonChip({ staff, role, status, onClick }: { staff: StaffMember; role: string; status?: { label: string; color: string } | null; onClick?: () => void }) {
  const color = ROLE_COLORS[role] ?? "#8B2252";
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:shadow-sm" style={{ borderColor: `${color}40`, background: `${color}08` }}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }}>{staff.name.charAt(0)}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#1A0A12]">{staff.name}</p>
        <p className="text-[10px]" style={{ color }}>{role}</p>
      </div>
      {status && <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold text-white" style={{ background: status.color }}>{status.label}</span>}
    </button>
  );
}

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
  const today = new Date().toISOString().split("T")[0];
  const [tab, setTab] = useState<"team" | "ops">("ops");
  const [weekendIndex, setWeekendIndex] = useState(0);

  const { data, isLoading, refetch } = trpc.staffAvailability.getOrgChart.useQuery();
  const [weekendCoverageInput] = useState(() => ({ weekends: 6 }));
  const weekendCoverage = trpc.staffAvailability.getWeekendCoverage.useQuery(weekendCoverageInput);
  const classStaffing = trpc.puppySchedule.listWithStaffing.useQuery();

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedWeekendShift, setSelectedWeekendShift] = useState<WeekendShift | null>(null);
  const [coverageDraft, setCoverageDraft] = useState({ coverageStaffId: "", notes: "" });
  const [selectedClassStaffing, setSelectedClassStaffing] = useState<ScheduledClassStaffing | null>(null);
  const [selectedPuppyMonitor, setSelectedPuppyMonitor] = useState("");
  const [leaveForm, setLeaveForm] = useState({ leaveType: "vacation" as "vacation" | "sick" | "personal" | "leave" | "unavailable", startDate: today, endDate: today, notes: "" });
  const [newMember, setNewMember] = useState<{ name: string; email: string; phone: string; role: TeamRole; location: TeamLocation }>({ name: "", email: "", phone: "", role: "Operations Manager", location: "KW" });

  const refreshAvailability = () => { refetch(); weekendCoverage.refetch(); classStaffing.refetch(); };
  const addLeave = trpc.staffAvailability.addLeave.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Leave added"); setShowLeaveModal(false); } });
  const deleteLeave = trpc.staffAvailability.deleteLeave.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Leave removed"); } });
  const createTeamMember = trpc.staffAvailability.createTeamMember.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Team member added"); setShowAddMember(false); setNewMember({ name: "", email: "", phone: "", role: "Operations Manager", location: "KW" }); }, onError: (e) => toast.error(e.message) });
  const removeTeamMember = trpc.staffAvailability.removeTeamMember.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Removed from APY HQ"); setShowLeaveModal(false); setSelectedStaff(null); }, onError: (e) => toast.error(e.message) });
  const markWeekendAway = trpc.staffAvailability.addLeave.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Saved"); setSelectedWeekendShift(null); } });
  const assignWeekendCoverage = trpc.staffAvailability.assignWeekendCoverage.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("Coverage updated"); setSelectedWeekendShift(null); }, onError: (e) => toast.error(e.message) });
  const assignPuppyMonitor = trpc.puppySchedule.assignPuppyMonitor.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("PM assigned"); setSelectedClassStaffing(null); setSelectedPuppyMonitor(""); }, onError: (e) => toast.error(e.message) });
  const removePuppyMonitor = trpc.puppySchedule.removePuppyMonitorAssignment.useMutation({ onSuccess: () => { refreshAvailability(); toast.success("PM removed"); setSelectedClassStaffing(null); }, onError: (e) => toast.error(e.message) });

  const staff = (data?.staff ?? []) as StaffMember[];
  const leaves = data?.leaves ?? [];
  const matchesRole = (s: StaffMember, role: string) => s.role === role || s.role === role.toLowerCase().replaceAll(" ", "_");
  const byLocationAndRole = (loc: string, role: string) => staff.filter((s) => s.location === loc && matchesRole(s, role));
  const centralStaff = staff.filter((s) => CENTRAL_ROLES.some((r) => matchesRole(s, r)) || s.location === "CENTRAL");
  const getStatus = (id: number) => { const l = isOnLeave(id, leaves, today); return l ? { label: LEAVE_LABELS[l.leaveType] ?? l.leaveType, color: LEAVE_COLORS[l.leaveType] ?? "#6B7280" } : null; };
  const openStaff = (s: StaffMember) => { setSelectedStaff(s); setShowLeaveModal(true); };
  const setRole = (role: TeamRole) => setNewMember((m) => ({ ...m, role, location: CENTRAL_ROLES.includes(role as any) ? "CENTRAL" : m.location === "CENTRAL" ? "KW" : m.location }));
  const openWeekendShift = (s: WeekendShift) => { setSelectedWeekendShift(s); setCoverageDraft({ coverageStaffId: s.coverage?.coverageStaffId ? String(s.coverage.coverageStaffId) : "", notes: s.coverage?.notes ?? "" }); };
  const openClassStaffing = (c: ScheduledClassStaffing) => { setSelectedClassStaffing(c); setSelectedPuppyMonitor(""); };

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

  // Team tab stats
  const totalStaff = staff.length;
  const onLeaveNow = staff.filter((s) => isOnLeave(s.id, leaves, today)).length;

  return (
    <div className="min-h-screen bg-[#F7F2EE]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EDE0D8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link href="/staff" className="flex items-center gap-1.5 text-xs font-medium text-[#8B2252] hover:text-[#6B1A3E]"><ArrowLeft size={13} /> APY HQ</Link>
            <span className="text-[#D4B8C4]">/</span>
            <p className="text-sm font-bold text-[#1A0A12]">Team & Availability</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[#7A5A6A] lg:block">{new Date().toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</span>
            <button onClick={() => setShowAddMember(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2252] px-3 py-2 text-xs font-bold text-white hover:bg-[#6B1A3E]"><Plus size={13} /> Add</button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-[#EDE0D8] bg-white">
        <div className="mx-auto flex max-w-[1200px] gap-1 px-5 pt-2">
          <button onClick={() => setTab("ops")} className={`rounded-t-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === "ops" ? "border-b-2 border-[#8B2252] text-[#8B2252]" : "text-[#7A5A6A] hover:text-[#1A0A12]"}`}><CalendarCheck size={14} className="mr-1.5 inline" />Weekend Ops</button>
          <button onClick={() => setTab("team")} className={`rounded-t-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === "team" ? "border-b-2 border-[#8B2252] text-[#8B2252]" : "text-[#7A5A6A] hover:text-[#1A0A12]"}`}><Users size={14} className="mr-1.5 inline" />Team ({totalStaff})</button>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-5 py-6">
        {/* ═══════════════════════ WEEKEND OPS TAB ═══════════════════════ */}
        {tab === "ops" && (
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
        )}

        {/* ═══════════════════════ TEAM TAB ═══════════════════════ */}
        {tab === "team" && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#1A0A12]">APY Team</h2>
                <p className="mt-0.5 text-xs text-[#7A5A6A]">{totalStaff} members · {onLeaveNow > 0 ? `${onLeaveNow} on leave today` : "All available today"}</p>
              </div>
            </div>

            {isLoading ? <div className="py-16 text-center text-sm text-[#8B2252]">Loading…</div> : (
              <div className="space-y-6">
                {/* Central roles */}
                <section className="rounded-2xl border border-[#EADBE2] bg-white p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#8B2252]">Central · APY-wide</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CENTRAL_ROLES.map((role) => {
                      const members = centralStaff.filter((s) => matchesRole(s, role));
                      return members.length ? members.map((s) => <PersonChip key={s.id} staff={s} role={role} status={getStatus(s.id)} onClick={() => openStaff(s)} />) : <div key={role} className="flex items-center justify-center rounded-lg border-2 border-dashed border-[#DCCAD3] px-3 py-4 text-xs text-[#B39AA5]">{role} · Open</div>;
                    })}
                  </div>
                </section>

                {/* Studio teams */}
                <div className="grid gap-5 lg:grid-cols-3">
                  {LOCATIONS.map((loc) => {
                    const ops = byLocationAndRole(loc, "Operations Manager");
                    const yoga = byLocationAndRole(loc, "Yoga Instructor");
                    const pms = byLocationAndRole(loc, "Puppy Monitor");
                    const openPMs = Math.max(0, 6 - pms.length);
                    return (
                      <section key={loc} className="rounded-2xl border border-[#EADBE2] bg-white p-4">
                        <div className="mb-3 rounded-lg bg-[#8B2252] px-3 py-2 text-center text-sm font-bold text-white">{LOCATION_LABELS[loc]}</div>
                        <div className="space-y-2">
                          {ops.length ? ops.map((s) => <PersonChip key={s.id} staff={s} role="Operations Manager" status={getStatus(s.id)} onClick={() => openStaff(s)} />) : <div className="rounded-lg border-2 border-dashed border-[#DCCAD3] px-3 py-3 text-center text-xs text-[#B39AA5]">Ops Manager · Open</div>}
                          {yoga.length ? yoga.map((s) => <PersonChip key={s.id} staff={s} role="Yoga Instructor" status={getStatus(s.id)} onClick={() => openStaff(s)} />) : <div className="rounded-lg border-2 border-dashed border-[#DCCAD3] px-3 py-3 text-center text-xs text-[#B39AA5]">Yoga Instructor · Open</div>}
                          <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-[#7C3AED]">Puppy Monitors · {pms.length}/6</p>
                          {pms.map((s) => <PersonChip key={s.id} staff={s} role="Puppy Monitor" status={getStatus(s.id)} onClick={() => openStaff(s)} />)}
                          {openPMs > 0 && <div className="rounded-lg border-2 border-dashed border-[#DCCAD3] px-3 py-2 text-center text-xs text-[#B39AA5]">+{openPMs} open</div>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════ MODALS ═══════════════════════ */}

      {/* Leave / Remove modal */}
      {showLeaveModal && selectedStaff && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><h3 className="text-lg font-bold text-[#1A0A12]">{selectedStaff.name}</h3><p className="text-xs text-[#7A5A6A]">{selectedStaff.role} · {LOCATION_LABELS[selectedStaff.location] ?? selectedStaff.location}</p></div><button onClick={() => setShowLeaveModal(false)} className="text-[#C4A0B0] hover:text-[#8B2252]"><X size={18} /></button></div>
        <div className="space-y-3">
          <select value={leaveForm.leaveType} onChange={(e) => setLeaveForm((f) => ({ ...f, leaveType: e.target.value as typeof f.leaveType }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm">{Object.entries(LEAVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <div className="grid grid-cols-2 gap-3"><input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} className="rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm" /><input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} className="rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm" /></div>
          <textarea value={leaveForm.notes} onChange={(e) => setLeaveForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes (optional)" className="w-full resize-none rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => addLeave.mutate({ staffId: selectedStaff.id, staffName: selectedStaff.name, ...leaveForm })} disabled={addLeave.isPending} className="rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white hover:bg-[#6B1A3E] disabled:opacity-50">{addLeave.isPending ? "Saving…" : "Save Leave"}</button><button onClick={() => { if (confirm(`Remove ${selectedStaff.name} from APY HQ? This clears their active staffing assignments and portal access. Their employee record is kept in the Employee Directory.`)) removeTeamMember.mutate({ id: selectedStaff.id }); }} disabled={removeTeamMember.isPending} className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash2 size={13} />Remove from APY HQ</button></div>
      </div></div>}

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
        <p className="mb-3 rounded-lg border border-[#E6D6F8] bg-[#FAF5FF] px-3 py-2 text-xs font-bold text-[#4C1D95]">Two Puppy Monitors required</p>
        <div className="space-y-2">
          {selectedClassStaffing.staffing.assignedPuppyMonitors.map((m) => <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#EDE0D8] px-3 py-2"><span className="text-sm font-bold">{m.name}</span><button onClick={() => removePuppyMonitor.mutate({ id: m.id })} className="text-[#C4A0B0] hover:text-red-500"><X size={14} /></button></div>)}
          {Array.from({ length: Math.max(0, 2 - selectedClassStaffing.staffing.assignedPuppyMonitors.length) }, (_, i) => <div key={i} className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">PM {selectedClassStaffing.staffing.assignedPuppyMonitors.length + i + 1} needed</div>)}
        </div>
        {selectedClassStaffing.staffing.assignedPuppyMonitors.length < 2 && <div className="mt-3 flex gap-2"><select value={selectedPuppyMonitor} onChange={(e) => setSelectedPuppyMonitor(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#E6D6F8] px-3 py-2 text-sm"><option value="">Select PM</option>{selectedClassStaffing.staffing.eligiblePuppyMonitors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><button onClick={() => selectedPuppyMonitor && assignPuppyMonitor.mutate({ scheduleId: selectedClassStaffing.id, staffId: Number(selectedPuppyMonitor) })} disabled={!selectedPuppyMonitor || assignPuppyMonitor.isPending} className="rounded-lg bg-[#7C3AED] px-3 py-2 text-xs font-bold text-white hover:bg-[#6D28D9] disabled:opacity-50">Assign</button></div>}
        <button onClick={() => setSelectedClassStaffing(null)} className="mt-4 w-full rounded-xl border border-[#EDE0D8] py-2 text-sm text-[#7A5A6A] hover:bg-[#FAF5F2]">Close</button>
      </div></div>}

      {/* Add member modal */}
      {showAddMember && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-start justify-between"><h3 className="text-lg font-bold text-[#1A0A12]">Add Team Member</h3><button onClick={() => setShowAddMember(false)} className="text-[#C4A0B0] hover:text-[#8B2252]"><X size={18} /></button></div>
        <div className="space-y-3">
          <input value={newMember.name} onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))} placeholder="Full name" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select value={newMember.role} onChange={(e) => setRole(e.target.value as TeamRole)} className="rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm"><option>Operations Manager</option><option>Yoga Instructor</option><option>Puppy Monitor</option><option>Puppy Specialist</option><option>BDR</option><option>Social Media Specialist</option></select>
            <select value={newMember.location} onChange={(e) => setNewMember((m) => ({ ...m, location: e.target.value as TeamLocation }))} disabled={CENTRAL_ROLES.includes(newMember.role as any)} className="rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm disabled:opacity-50"><option value="KW">Kitchener</option><option value="OAK">Oakville</option><option value="HAM">Hamilton</option>{CENTRAL_ROLES.includes(newMember.role as any) && <option value="CENTRAL">APY-wide</option>}</select>
          </div>
          <input value={newMember.email} onChange={(e) => setNewMember((m) => ({ ...m, email: e.target.value }))} type="email" placeholder="Email (optional if phone is added)" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm" />
          <input value={newMember.phone} onChange={(e) => setNewMember((m) => ({ ...m, phone: e.target.value }))} type="tel" placeholder="Canadian phone (optional if email is added)" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm" />
          <p className="text-[11px] text-[#7A5A6A]">Add at least one contact method: email or phone.</p>
          {newMember.role === "Puppy Monitor" && <p className="rounded-lg border border-[#E6D6F8] bg-[#FAF5FF] px-3 py-2 text-xs font-medium text-[#4C1D95]">Puppy Monitors are added manually after this location’s Operations Manager has joined APY HQ. Applicants do not appear on the team board automatically.</p>}
        </div>
        <button onClick={() => createTeamMember.mutate(newMember)} disabled={!newMember.name || (!newMember.email.trim() && !newMember.phone.trim()) || createTeamMember.isPending} className="mt-5 w-full rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white hover:bg-[#6B1A3E] disabled:opacity-50">{createTeamMember.isPending ? "Adding…" : "Add to Team"}</button>
      </div></div>}
    </div>
  );
}
