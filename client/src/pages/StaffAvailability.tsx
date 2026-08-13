import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft, Calendar, CalendarDays, Plus, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";

const LOCATIONS = ["KW", "OAK", "HAM"] as const;
const LOCATION_LABELS: Record<string, string> = {
  KW: "Kitchener",
  OAK: "Oakville",
  HAM: "Hamilton",
  CENTRAL: "APY-wide",
};
const CENTRAL_ROLES = ["BDR", "Social Media Specialist"] as const;
const ROLE_COLORS: Record<string, string> = {
  yoga_instructor: "#8B2252",
  "Yoga Instructor": "#8B2252",
  puppy_monitor: "#7C3AED",
  "Puppy Monitor": "#7C3AED",
  puppy_specialist: "#0891B2",
  "Puppy Specialist": "#0891B2",
  operations_manager: "#D97706",
  "Operations Manager": "#D97706",
  BDR: "#0F766E",
  "Social Media Specialist": "#DB2777",
};
const LEAVE_COLORS: Record<string, string> = {
  vacation: "#F59E0B",
  sick: "#EF4444",
  personal: "#8B5CF6",
  leave: "#6B7280",
  unavailable: "#374151",
};
const LEAVE_LABELS: Record<string, string> = {
  vacation: "🌴 Vacation",
  sick: "🤒 Sick",
  personal: "🏠 Personal",
  leave: "📋 Leave",
  unavailable: "⛔ Unavailable",
};
type TeamRole = "Yoga Instructor" | "Operations Manager" | "Puppy Monitor" | "Puppy Specialist" | "BDR" | "Social Media Specialist";
type TeamLocation = "KW" | "OAK" | "HAM" | "CENTRAL";
type StaffMember = { id: number; name: string; email: string; phone: string | null; role: string; location: string; appStatus: string };
type WeekendShift = {
  date: string;
  dayLabel: string;
  shortLabel: string;
  location: "KW" | "OAK" | "HAM";
  role: "Operations Manager" | "Yoga Instructor";
  primary: Pick<StaffMember, "id" | "name" | "role" | "location"> | null;
  primaryLeave: { leaveType: string } | null;
  coverage: { coverageStaffId: number | null; coverageStaffName: string | null; notes: string | null } | null;
  candidates: Pick<StaffMember, "id" | "name" | "role" | "location">[];
  status: "available" | "away" | "covered" | "unassigned";
};
const WEEKEND_STATUS = {
  available: { label: "Primary available", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  away: { label: "Away · cover needed", className: "border-amber-200 bg-amber-50 text-amber-800" },
  covered: { label: "Coverage assigned", className: "border-sky-200 bg-sky-50 text-sky-800" },
  unassigned: { label: "No primary assigned", className: "border-rose-200 bg-rose-50 text-rose-800" },
} as const;

function isOnLeave(staffId: number, leaves: any[], today: string) {
  return leaves.find((leave) => leave.staffId === staffId && leave.startDate <= today && leave.endDate >= today);
}

function OrgNode({ staff, role, location, status, onClick, emptyLabel, compact = false }: {
  staff?: StaffMember;
  role: string;
  location?: string;
  status?: { label: string; color: string } | null;
  onClick?: () => void;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const color = ROLE_COLORS[role] ?? "#8B2252";
  if (!staff) {
    return (
      <div className={`flex min-h-[${compact ? "88px" : "112px"}] items-center justify-center rounded-xl border-2 border-dashed border-[#DCCAD3] bg-white/50 px-3 text-center text-[11px] font-medium text-[#B39AA5]`}>
        {emptyLabel ?? "Open Position"}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-center transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${compact ? "min-h-[88px]" : "min-h-[112px]"}`}
      style={{ borderColor: color, background: `${color}0D` }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>
        {staff.name.charAt(0).toUpperCase()}
      </div>
      <p className="text-[12px] font-semibold leading-tight text-[#1A0A12]">{staff.name}</p>
      <p className="text-[10px] font-medium" style={{ color }}>{role}</p>
      {location && <p className="text-[10px] text-[#7A5A6A]">{LOCATION_LABELS[location] ?? location}</p>}
      <span className="mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold" style={status ? { background: status.color, color: "#fff" } : { background: "#DDF7E8", color: "#177343" }}>
        {status?.label ?? "Available"}
      </span>
    </button>
  );
}

function RoleBand({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#EADBE2] bg-[#FFFDFC] p-3 shadow-sm">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color }}>{title}</p>
      {children}
    </section>
  );
}

export default function StaffAvailabilityPage() {
  const today = new Date().toISOString().split("T")[0];
  const { data, isLoading, refetch } = trpc.staffAvailability.getOrgChart.useQuery();
  const [weekendCoverageInput] = useState(() => ({ weekends: 6 }));
  const weekendCoverage = trpc.staffAvailability.getWeekendCoverage.useQuery(weekendCoverageInput);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedWeekendShift, setSelectedWeekendShift] = useState<WeekendShift | null>(null);
  const [coverageDraft, setCoverageDraft] = useState({ coverageStaffId: "", notes: "" });
  const [leaveForm, setLeaveForm] = useState({ leaveType: "vacation" as const, startDate: today, endDate: today, notes: "" });
  const [newMember, setNewMember] = useState<{ name: string; email: string; phone: string; role: TeamRole; location: TeamLocation }>({
    name: "", email: "", phone: "", role: "Operations Manager", location: "KW",
  });

  const refreshAvailability = () => { refetch(); weekendCoverage.refetch(); };
  const addLeave = trpc.staffAvailability.addLeave.useMutation({
    onSuccess: () => { refreshAvailability(); toast.success("Leave added"); setShowLeaveModal(false); },
  });
  const deleteLeave = trpc.staffAvailability.deleteLeave.useMutation({
    onSuccess: () => { refreshAvailability(); toast.success("Leave removed"); },
  });
  const createTeamMember = trpc.staffAvailability.createTeamMember.useMutation({
    onSuccess: () => {
      refreshAvailability(); toast.success("Team member added to the org chart"); setShowAddMember(false);
      setNewMember({ name: "", email: "", phone: "", role: "Operations Manager", location: "KW" });
    },
    onError: (error) => toast.error(error.message || "Could not add this team member."),
  });
  const removeTeamMember = trpc.staffAvailability.removeTeamMember.useMutation({
    onSuccess: () => { refreshAvailability(); toast.success("Team member removed from the org chart"); setShowLeaveModal(false); setSelectedStaff(null); },
    onError: (error) => toast.error(error.message || "Could not remove this team member."),
  });
  const markWeekendAway = trpc.staffAvailability.addLeave.useMutation({
    onSuccess: () => { refreshAvailability(); toast.success("Weekend unavailability saved"); setSelectedWeekendShift(null); },
    onError: (error) => toast.error(error.message || "Could not save weekend unavailability."),
  });
  const assignWeekendCoverage = trpc.staffAvailability.assignWeekendCoverage.useMutation({
    onSuccess: () => { refreshAvailability(); toast.success("Weekend coverage updated"); setSelectedWeekendShift(null); },
    onError: (error) => toast.error(error.message || "Could not update weekend coverage."),
  });

  const staff = (data?.staff ?? []) as StaffMember[];
  const leaves = data?.leaves ?? [];
  const matchesRole = (staffMember: StaffMember, role: string) => staffMember.role === role || staffMember.role === role.toLowerCase().replaceAll(" ", "_");
  const byLocationAndRole = (location: string, role: string) => staff.filter((staffMember) => staffMember.location === location && matchesRole(staffMember, role));
  const centralStaff = staff.filter((staffMember) => CENTRAL_ROLES.some((role) => matchesRole(staffMember, role)) || staffMember.location === "CENTRAL");
  const getStatus = (staffId: number) => {
    const leave = isOnLeave(staffId, leaves, today);
    return leave ? { label: LEAVE_LABELS[leave.leaveType] ?? leave.leaveType, color: LEAVE_COLORS[leave.leaveType] ?? "#6B7280" } : null;
  };
  const openStaff = (staffMember: StaffMember) => { setSelectedStaff(staffMember); setShowLeaveModal(true); };
  const setRole = (role: TeamRole) => setNewMember((member) => ({
    ...member,
    role,
    location: CENTRAL_ROLES.includes(role as typeof CENTRAL_ROLES[number]) ? "CENTRAL" : member.location === "CENTRAL" ? "KW" : member.location,
  }));
  const openWeekendShift = (shift: WeekendShift) => {
    setSelectedWeekendShift(shift);
    setCoverageDraft({ coverageStaffId: shift.coverage?.coverageStaffId ? String(shift.coverage.coverageStaffId) : "", notes: shift.coverage?.notes ?? "" });
  };
  const weekendDates = weekendCoverage.data?.weekends ?? [];
  const weekendShifts = (weekendCoverage.data?.shifts ?? []) as WeekendShift[];
  const leadershipRows = LOCATIONS.flatMap((location) => ([
    { location, role: "Operations Manager" as const },
    { location, role: "Yoga Instructor" as const },
  ]));
  const findWeekendShift = (date: string, location: string, role: string) => weekendShifts.find((shift) => shift.date === date && shift.location === location && shift.role === role);

  return (
    <div className="min-h-screen bg-[#F7F2EE]">
      <header className="sticky top-0 z-40 border-b border-[#EDE0D8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/staff" className="flex items-center gap-1.5 text-xs font-medium text-[#8B2252] transition-colors hover:text-[#6B1A3E]"><ArrowLeft size={13} /> APY HQ</Link>
            <span className="text-[#D4B8C4]">/</span>
            <p className="text-[13px] font-bold text-[#1A0A12]">Team & Availability</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-[#7A5A6A] lg:flex"><Calendar size={13} />{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
            <button onClick={() => setShowAddMember(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2252] px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#6B1A3E]"><Plus size={14} /> Add Team Member</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-7 md:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B2252]/60">APY team structure</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1A0A12]">Organization & availability</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#7A5A6A]">Click a team member to manage time off or remove them. Each studio has space for one Operations Manager, one Yoga Instructor, and six Puppy Monitors.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LEAVE_LABELS).map(([key, label]) => <span key={key} className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: LEAVE_COLORS[key] }}>{label}</span>)}
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">✓ Available</span>
          </div>
        </div>

        {isLoading ? <div className="py-20 text-center text-[#8B2252]">Loading organization...</div> : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-[#EADBE2] bg-white p-5 shadow-sm md:p-6">
              <div className="mx-auto max-w-[240px]"><OrgNode staff={{ id: 0, name: "Ay Bello", email: "", phone: null, role: "CEO & Founder", location: "CENTRAL", appStatus: "onboarded" }} role="CEO & Founder" /></div>
              <div className="mx-auto h-6 w-px bg-[#D4B8C4]" />
              <div className="mx-auto mb-5 h-px w-[45%] bg-[#D4B8C4]" />
              <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                {CENTRAL_ROLES.map((role) => {
                  const members = centralStaff.filter((staffMember) => matchesRole(staffMember, role));
                  return <RoleBand key={role} title={`Central · ${role}`} color={ROLE_COLORS[role]}><div className="grid gap-2">{members.length ? members.map((staffMember) => <OrgNode key={staffMember.id} staff={staffMember} role={role} status={getStatus(staffMember.id)} onClick={() => openStaff(staffMember)} />) : <OrgNode role={role} emptyLabel="Open central role" />}</div></RoleBand>;
                })}
              </div>
            </section>

            <section className="overflow-x-auto rounded-3xl border border-[#EADBE2] bg-white p-4 shadow-sm md:p-6">
              <div className="mb-5 flex items-center gap-2"><UsersRound size={17} className="text-[#8B2252]" /><h2 className="text-sm font-bold text-[#1A0A12]">Studio teams</h2><span className="text-xs text-[#9D7888]">Operations first, then instruction and Puppy Monitor coverage.</span></div>
              <div className="grid min-w-[1000px] grid-cols-3 gap-5">
                {LOCATIONS.map((location) => {
                  const operationsManagers = byLocationAndRole(location, "Operations Manager");
                  const yogaInstructors = byLocationAndRole(location, "Yoga Instructor");
                  const puppyMonitors = byLocationAndRole(location, "Puppy Monitor").slice(0, 6);
                  return (
                    <div key={location} className="rounded-2xl border border-[#EADBE2] bg-[#FFFCFA] p-3">
                      <div className="mb-3 rounded-xl bg-[#8B2252] px-4 py-2 text-center text-sm font-bold text-white">{LOCATION_LABELS[location]}</div>
                      <div className="space-y-3">
                        <RoleBand title="1 · Operations Manager" color={ROLE_COLORS["Operations Manager"]}><div className="grid gap-2">{operationsManagers.length ? operationsManagers.map((staffMember) => <OrgNode key={staffMember.id} staff={staffMember} role="Operations Manager" status={getStatus(staffMember.id)} onClick={() => openStaff(staffMember)} />) : <OrgNode role="Operations Manager" emptyLabel="Open Operations Manager" />}</div></RoleBand>
                        <RoleBand title="2 · Yoga Instructor" color={ROLE_COLORS["Yoga Instructor"]}><div className="grid gap-2">{yogaInstructors.length ? yogaInstructors.map((staffMember) => <OrgNode key={staffMember.id} staff={staffMember} role="Yoga Instructor" status={getStatus(staffMember.id)} onClick={() => openStaff(staffMember)} />) : <OrgNode role="Yoga Instructor" emptyLabel="Open Yoga Instructor" />}</div></RoleBand>
                        <RoleBand title={`3 · Puppy Monitors · ${puppyMonitors.length}/6 filled`} color={ROLE_COLORS["Puppy Monitor"]}>
                          <div className="grid grid-cols-2 gap-2">{Array.from({ length: 6 }, (_, index) => { const staffMember = puppyMonitors[index]; return <OrgNode key={staffMember?.id ?? `${location}-pm-${index}`} staff={staffMember} role="Puppy Monitor" status={staffMember ? getStatus(staffMember.id) : null} onClick={staffMember ? () => openStaff(staffMember) : undefined} emptyLabel={`PM ${index + 1} · Open`} compact />; })}</div>
                        </RoleBand>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        <section className="mt-7 rounded-3xl border border-[#EADBE2] bg-white p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B2252]/10 text-[#8B2252]"><CalendarDays size={18} /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8B2252]/60">Weekend leadership plan</p>
                <h2 className="mt-0.5 text-lg font-bold text-[#1A0A12]">Saturday & Sunday coverage</h2>
                <p className="mt-1 text-xs text-[#7A5A6A]">The board reads existing leave records automatically. Select a shift to mark the primary person away or assign a same-role cover.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#7A5A6A]"><ShieldCheck size={14} className="text-[#177343]" /> {weekendDates.length / 2} upcoming weekends</div>
          </div>

          {weekendCoverage.isLoading ? (
            <div className="py-10 text-center text-sm text-[#8B2252]">Loading weekend coverage…</div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[2100px]">
                <div className="grid border-b border-[#EADBE2]" style={{ gridTemplateColumns: `220px repeat(${weekendDates.length}, minmax(150px, 1fr))` }}>
                  <div className="sticky left-0 z-10 bg-white px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B2252]">Studio · Leadership role</div>
                  {weekendDates.map((weekend) => (
                    <div key={weekend.date} className={`border-l border-[#EADBE2] px-3 py-3 text-center ${weekend.dayLabel === "Sunday" ? "bg-[#FAF5F2]" : "bg-white"}`}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B2252]">{weekend.dayLabel.slice(0, 3)}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#1A0A12]">{weekend.shortLabel}</p>
                    </div>
                  ))}
                </div>
                {leadershipRows.map((row) => (
                  <div key={`${row.location}-${row.role}`} className="grid border-b border-[#F1E7E2] last:border-b-0" style={{ gridTemplateColumns: `220px repeat(${weekendDates.length}, minmax(150px, 1fr))` }}>
                    <div className="sticky left-0 z-10 flex items-center gap-2 bg-white px-3 py-3">
                      <span className="h-7 w-1 rounded-full" style={{ background: ROLE_COLORS[row.role] }} />
                      <div><p className="text-xs font-bold text-[#1A0A12]">{LOCATION_LABELS[row.location]}</p><p className="text-[10px] font-medium" style={{ color: ROLE_COLORS[row.role] }}>{row.role}</p></div>
                    </div>
                    {weekendDates.map((weekend) => {
                      const shift = findWeekendShift(weekend.date, row.location, row.role);
                      const display = shift ? WEEKEND_STATUS[shift.status] : WEEKEND_STATUS.unassigned;
                      const primaryName = shift?.primary?.name ?? "No primary assigned";
                      const coverageName = shift?.coverage?.coverageStaffName;
                      return (
                        <button key={weekend.date} type="button" onClick={() => shift && openWeekendShift(shift)} className={`border-l border-[#F1E7E2] p-2 text-left transition-colors ${weekend.dayLabel === "Sunday" ? "bg-[#FFFCFA]" : "bg-white"} hover:bg-[#FAF5F2]`}>
                          <div className={`min-h-[74px] rounded-xl border px-2.5 py-2 ${display.className}`}>
                            <p className="truncate text-[11px] font-bold">{coverageName ? coverageName : primaryName}</p>
                            <p className="mt-1 text-[9px] font-semibold leading-tight">{coverageName ? `Covering for ${primaryName}` : display.label}</p>
                            {shift?.status === "away" && <p className="mt-1 text-[9px] font-bold">Select cover →</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {leaves.length > 0 && <section className="mt-7"><h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#8B2252]">Upcoming & Active Leave</h2><div className="overflow-x-auto rounded-xl border border-[#EDE0D8] bg-white shadow-sm"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-[#EDE0D8] bg-[#FAF5F2]"><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#8B2252]">Staff</th><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#8B2252]">Type</th><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#8B2252]">Dates</th><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#8B2252]">Notes</th><th className="px-4 py-3" /></tr></thead><tbody>{leaves.map((leave) => <tr key={leave.id} className="border-b border-[#F5EDE8]"><td className="px-4 py-3 font-medium text-[#1A0A12]">{leave.staffName}</td><td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: LEAVE_COLORS[leave.leaveType] }}>{LEAVE_LABELS[leave.leaveType]}</span></td><td className="px-4 py-3 text-xs text-[#7A5A6A]">{leave.startDate} → {leave.endDate}</td><td className="px-4 py-3 text-xs text-[#7A5A6A]">{leave.notes ?? "—"}</td><td className="px-4 py-3"><button onClick={() => deleteLeave.mutate({ id: leave.id })} className="text-[#C4A0B0] transition-colors hover:text-red-500" aria-label="Remove leave entry"><X size={14} /></button></td></tr>)}</tbody></table></div></section>}
      </main>

      {showLeaveModal && selectedStaff && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-[#1A0A12]">{selectedStaff.name}</h3><p className="mt-1 text-xs text-[#7A5A6A]">{selectedStaff.role} · {LOCATION_LABELS[selectedStaff.location] ?? selectedStaff.location}</p></div><button onClick={() => setShowLeaveModal(false)} className="text-[#C4A0B0] hover:text-[#8B2252]"><X size={18} /></button></div><div className="space-y-4"><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Leave Type</label><select value={leaveForm.leaveType} onChange={(event) => setLeaveForm((form) => ({ ...form, leaveType: event.target.value as typeof form.leaveType }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none">{Object.entries(LEAVE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Start Date</label><input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm((form) => ({ ...form, startDate: event.target.value }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" /></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">End Date</label><input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm((form) => ({ ...form, endDate: event.target.value }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" /></div></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Notes <span className="normal-case font-medium text-[#7A5A6A]">(optional)</span></label><textarea value={leaveForm.notes} onChange={(event) => setLeaveForm((form) => ({ ...form, notes: event.target.value }))} rows={2} placeholder="e.g. Family vacation" className="w-full resize-none rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" /></div></div><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => addLeave.mutate({ staffId: selectedStaff.id, staffName: selectedStaff.name, ...leaveForm })} disabled={addLeave.isPending} className="rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#6B1A3E] disabled:opacity-50">{addLeave.isPending ? "Saving..." : "Save Leave"}</button><button onClick={() => { if (window.confirm(`Remove ${selectedStaff.name} from the APY org chart? Their record will be archived, not permanently deleted.`)) removeTeamMember.mutate({ id: selectedStaff.id }); }} disabled={removeTeamMember.isPending} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"><Trash2 size={14} />{removeTeamMember.isPending ? "Removing..." : "Remove Person"}</button></div></div></div>}

      {selectedWeekendShift && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B2252]">Weekend leadership shift</p>
              <h3 className="mt-1 text-lg font-bold text-[#1A0A12]">{LOCATION_LABELS[selectedWeekendShift.location]} · {selectedWeekendShift.role}</h3>
              <p className="mt-1 text-xs text-[#7A5A6A]">{selectedWeekendShift.dayLabel}, {selectedWeekendShift.shortLabel} · {selectedWeekendShift.date}</p>
            </div>
            <button onClick={() => setSelectedWeekendShift(null)} className="text-[#C4A0B0] transition-colors hover:text-[#8B2252]" aria-label="Close weekend coverage editor"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div className={`rounded-xl border p-3 ${WEEKEND_STATUS[selectedWeekendShift.status].className}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Primary leadership</p>
              <p className="mt-1 text-sm font-bold">{selectedWeekendShift.primary?.name ?? "No primary person assigned"}</p>
              <p className="mt-1 text-xs">{selectedWeekendShift.status === "away" ? `Away: ${LEAVE_LABELS[selectedWeekendShift.primaryLeave?.leaveType ?? "unavailable"] ?? "Unavailable"}` : WEEKEND_STATUS[selectedWeekendShift.status].label}</p>
            </div>

            {selectedWeekendShift.primary && selectedWeekendShift.status !== "away" && (
              <button
                onClick={() => markWeekendAway.mutate({ staffId: selectedWeekendShift.primary!.id, staffName: selectedWeekendShift.primary!.name, leaveType: "unavailable", startDate: selectedWeekendShift.date, endDate: selectedWeekendShift.date, notes: "Weekend leadership availability marked from the coverage board." })}
                disabled={markWeekendAway.isPending}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
              >
                {markWeekendAway.isPending ? "Saving…" : `Mark ${selectedWeekendShift.primary.name} away for this day`}
              </button>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Coverage person</label>
              <select value={coverageDraft.coverageStaffId} onChange={(event) => setCoverageDraft((draft) => ({ ...draft, coverageStaffId: event.target.value }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none">
                <option value="">No cover selected</option>
                {selectedWeekendShift.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {LOCATION_LABELS[candidate.location] ?? candidate.location}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-[#7A5A6A]">Only active {selectedWeekendShift.role}s who are not away that day are shown.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Coverage notes <span className="normal-case font-medium text-[#7A5A6A]">(optional)</span></label>
              <textarea value={coverageDraft.notes} onChange={(event) => setCoverageDraft((draft) => ({ ...draft, notes: event.target.value }))} rows={2} placeholder="e.g. Swapped from Oakville for the day" className="w-full resize-none rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={() => assignWeekendCoverage.mutate({ coverageDate: selectedWeekendShift.date, location: selectedWeekendShift.location, role: selectedWeekendShift.role, coverageStaffId: coverageDraft.coverageStaffId ? Number(coverageDraft.coverageStaffId) : null, notes: coverageDraft.notes })} disabled={assignWeekendCoverage.isPending} className="rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#6B1A3E] disabled:opacity-50">
              {assignWeekendCoverage.isPending ? "Saving…" : coverageDraft.coverageStaffId ? "Assign Coverage" : "Clear Coverage"}
            </button>
            <button onClick={() => setSelectedWeekendShift(null)} className="rounded-xl border border-[#EDE0D8] py-2.5 text-sm font-medium text-[#7A5A6A] transition-colors hover:bg-[#FAF5F2]">Close</button>
          </div>
        </div>
      </div>}

      {showAddMember && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-[#1A0A12]">Add Team Member</h3><p className="mt-1 text-xs text-[#7A5A6A]">Place a person in a central APY role or a specific studio team.</p></div><button onClick={() => setShowAddMember(false)} className="text-[#C4A0B0] hover:text-[#8B2252]"><X size={18} /></button></div><div className="space-y-4"><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Full Name</label><input value={newMember.name} onChange={(event) => setNewMember((member) => ({ ...member, name: event.target.value }))} placeholder="e.g. Jordan Smith" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" /></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Role</label><select value={newMember.role} onChange={(event) => setRole(event.target.value as TeamRole)} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none"><option>Operations Manager</option><option>Yoga Instructor</option><option>Puppy Monitor</option><option>Puppy Specialist</option><option>BDR</option><option>Social Media Specialist</option></select></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Team / Studio</label><select disabled={CENTRAL_ROLES.includes(newMember.role as typeof CENTRAL_ROLES[number])} value={newMember.location} onChange={(event) => setNewMember((member) => ({ ...member, location: event.target.value as TeamLocation }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#FAF5F2]">{CENTRAL_ROLES.includes(newMember.role as typeof CENTRAL_ROLES[number]) ? <option value="CENTRAL">APY-wide (Central)</option> : <><option value="KW">Kitchener</option><option value="OAK">Oakville</option><option value="HAM">Hamilton</option></>}</select></div></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Email Address</label><input type="email" value={newMember.email} onChange={(event) => setNewMember((member) => ({ ...member, email: event.target.value }))} placeholder="name@email.com" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" /></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Phone Number <span className="normal-case font-medium text-[#7A5A6A]">(optional)</span></label><input type="tel" value={newMember.phone} onChange={(event) => setNewMember((member) => ({ ...member, phone: event.target.value }))} placeholder="(289) 788-1885" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" /></div></div><div className="mt-6 flex gap-3"><button onClick={() => setShowAddMember(false)} className="flex-1 rounded-xl border border-[#EDE0D8] py-2.5 text-sm font-medium text-[#7A5A6A] hover:bg-[#FAF5F2]">Cancel</button><button onClick={() => createTeamMember.mutate(newMember)} disabled={createTeamMember.isPending || !newMember.name.trim() || !newMember.email.trim()} className="flex-1 rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white hover:bg-[#6B1A3E] disabled:cursor-not-allowed disabled:opacity-50">{createTeamMember.isPending ? "Adding..." : "Add to APY HQ"}</button></div></div></div>}
    </div>
  );
}
