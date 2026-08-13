import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft, Plus, X, User, MapPin, Calendar, ChevronDown } from "lucide-react";
import { LOGO_URL } from "@/const";

const LOCATIONS = ["KW", "OAK", "HAM"] as const;
const LOCATION_LABELS: Record<string, string> = { KW: "Kitchener", OAK: "Oakville", HAM: "Hamilton" };
const ROLE_COLORS: Record<string, string> = {
  "yoga_instructor": "#8B2252",
  "Yoga Instructor": "#8B2252",
  "puppy_monitor": "#7C3AED",
  "Puppy Monitor": "#7C3AED",
  "puppy_specialist": "#0891B2",
  "Puppy Specialist": "#0891B2",
  "operations_manager": "#D97706",
  "Operations Manager": "#D97706",
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

function isOnLeave(staffId: number, leaves: any[], today: string) {
  return leaves.find(l => l.staffId === staffId && l.startDate <= today && l.endDate >= today);
}

function OrgNode({ name, role, location, color, status, onClick }: {
  name: string; role: string; location?: string; color: string;
  status?: { label: string; color: string } | null;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 text-center min-w-[130px] max-w-[160px] transition-all duration-150 ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
      style={{ borderColor: color, background: `${color}10` }}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: color }}>
        {name.charAt(0).toUpperCase()}
      </div>
      <p className="font-semibold text-[12px] text-[#1A0A12] leading-tight">{name}</p>
      <p className="text-[10px] font-medium" style={{ color }}>{role}</p>
      {location && <p className="text-[10px] text-[#7A5A6A]">{LOCATION_LABELS[location] ?? location}</p>}
      {status && (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: status.color }}>
          {status.label}
        </span>
      )}
      {!status && onClick && (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Available</span>
      )}
    </div>
  );
}

function Connector() {
  return <div className="w-px h-6 bg-[#D4B8C4] mx-auto" />;
}

function HorizontalBranch({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-start justify-center gap-6 flex-wrap">
      {children}
    </div>
  );
}

export default function StaffAvailabilityPage() {
  const today = new Date().toISOString().split("T")[0];
  const { data, isLoading, refetch } = trpc.staffAvailability.getOrgChart.useQuery();
  const addLeave = trpc.staffAvailability.addLeave.useMutation({ onSuccess: () => { refetch(); toast.success("Leave added"); setShowModal(false); } });
  const deleteLeave = trpc.staffAvailability.deleteLeave.useMutation({ onSuccess: () => { refetch(); toast.success("Leave removed"); } });
  const createTeamMember = trpc.staffAvailability.createTeamMember.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Team member added to the org chart");
      setShowAddMember(false);
      setNewMember({ name: "", email: "", phone: "", role: "Operations Manager", location: "KW" });
    },
    onError: (error) => toast.error(error.message || "Could not add this team member."),
  });

  const [showModal, setShowModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<{ id: number; name: string } | null>(null);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "vacation" as const, startDate: today, endDate: today, notes: "" });
  const [showLeavePanel, setShowLeavePanel] = useState<number | null>(null);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Operations Manager" as "Yoga Instructor" | "Operations Manager" | "Puppy Monitor" | "Puppy Specialist",
    location: "KW" as "KW" | "OAK" | "HAM",
  });

  const staff = data?.staff ?? [];
  const leaves = data?.leaves ?? [];

  const byLocationAndRole = (loc: string, role: string) =>
    staff.filter(s => s.location === loc && (s.role === role || s.role === role.toLowerCase().replace(" ", "_")));

  const handleNodeClick = (s: { id: number; name: string }) => {
    setSelectedStaff(s);
    setShowModal(true);
  };

  const getStatus = (staffId: number) => {
    const leave = isOnLeave(staffId, leaves, today);
    if (!leave) return null;
    return { label: LEAVE_LABELS[leave.leaveType] ?? leave.leaveType, color: LEAVE_COLORS[leave.leaveType] ?? "#6B7280" };
  };

  return (
    <div className="min-h-screen bg-[#F7F2EE]">
      {/* Header */}
      <header className="bg-white border-b border-[#EDE0D8] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/staff" className="flex items-center gap-1.5 text-xs text-[#8B2252] hover:text-[#6B1A3E] transition-colors font-medium">
              <ArrowLeft size={13} /> APY HQ
            </Link>
            <span className="text-[#D4B8C4]">/</span>
            <p className="font-bold text-[13px] text-[#1A0A12]">Staff Availability</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#7A5A6A]">
              <Calendar size={13} />
              <span>{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
            <button
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2252] px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#6B1A3E]"
            >
              <Plus size={14} /> Add Team Member
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-8">
          {Object.entries(LEAVE_LABELS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full text-white" style={{ background: LEAVE_COLORS[k] }}>
              {v}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">✅ Available</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-[#8B2252]">Loading org chart...</div>
        ) : (
          <div className="overflow-x-auto pb-8">
            {/* CEO */}
            <div className="flex flex-col items-center mb-2">
              <OrgNode name="Ay Bello" role="CEO & Founder" color="#8B2252" />
            </div>
            <Connector />

            {/* Location columns */}
            <div className="flex items-start justify-center gap-12 flex-wrap">
              {LOCATIONS.map(loc => {
                const yogaInstructors = byLocationAndRole(loc, "Yoga Instructor");
                const opsManagers = byLocationAndRole(loc, "Operations Manager");
                const pms = staff.filter(s => s.location === loc && (s.role === "Puppy Monitor" || s.role === "puppy_monitor"));

                return (
                  <div key={loc} className="flex flex-col items-center gap-0 min-w-[160px]">
                    {/* Location header */}
                    <div className="px-5 py-2 rounded-xl bg-[#8B2252] text-white text-sm font-bold mb-2 shadow-sm">
                      {LOCATION_LABELS[loc]}
                    </div>
                    <Connector />

                    {/* Yoga Instructor */}
                    <div className="flex flex-col items-center gap-0 mb-3">
                      <p className="text-[9px] font-bold tracking-widest uppercase text-[#8B2252] mb-1">Yoga Instructor</p>
                      {yogaInstructors.length > 0 ? yogaInstructors.map(s => (
                        <div key={s.id} className="mb-1">
                          <OrgNode name={s.name} role="Yoga Instructor" color={ROLE_COLORS["Yoga Instructor"]} status={getStatus(s.id)} onClick={() => handleNodeClick(s)} />
                        </div>
                      )) : (
                        <div className="px-4 py-3 rounded-xl border-2 border-dashed border-[#D4B8C4] text-[11px] text-[#C4A0B0] text-center min-w-[130px]">
                          Open Position
                        </div>
                      )}
                    </div>

                    {/* Ops Manager */}
                    <div className="flex flex-col items-center gap-0 mb-3">
                      <p className="text-[9px] font-bold tracking-widest uppercase text-[#D97706] mb-1">Ops Manager</p>
                      {opsManagers.length > 0 ? opsManagers.map(s => (
                        <div key={s.id} className="mb-1">
                          <OrgNode name={s.name} role="Ops Manager" color={ROLE_COLORS["Operations Manager"]} status={getStatus(s.id)} onClick={() => handleNodeClick(s)} />
                        </div>
                      )) : (
                        <div className="px-4 py-3 rounded-xl border-2 border-dashed border-[#D4B8C4] text-[11px] text-[#C4A0B0] text-center min-w-[130px]">
                          Open Position
                        </div>
                      )}
                    </div>

                    {/* Puppy Monitors */}
                    <div className="flex flex-col items-center gap-0">
                      <p className="text-[9px] font-bold tracking-widest uppercase text-[#7C3AED] mb-1">Puppy Monitors</p>
                      {pms.length > 0 ? pms.map(s => (
                        <div key={s.id} className="mb-1">
                          <OrgNode name={s.name} role="Puppy Monitor" color={ROLE_COLORS["Puppy Monitor"]} status={getStatus(s.id)} onClick={() => handleNodeClick(s)} />
                        </div>
                      )) : (
                        <div className="px-4 py-3 rounded-xl border-2 border-dashed border-[#D4B8C4] text-[11px] text-[#C4A0B0] text-center min-w-[130px]">
                          No PMs yet
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming leaves table */}
        {leaves.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-bold tracking-widest uppercase text-[#8B2252] mb-3">Upcoming & Active Leave</h2>
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#EDE0D8]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EDE0D8] bg-[#FAF5F2]">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-[#8B2252] uppercase tracking-wide">Staff</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-[#8B2252] uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-[#8B2252] uppercase tracking-wide">Dates</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-[#8B2252] uppercase tracking-wide">Notes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id} className="border-b border-[#F5EDE8] hover:bg-[#FAF5F2] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1A0A12]">{l.staffName}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: LEAVE_COLORS[l.leaveType] }}>
                          {LEAVE_LABELS[l.leaveType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#7A5A6A] text-xs">{l.startDate} → {l.endDate}</td>
                      <td className="px-4 py-3 text-[#7A5A6A] text-xs">{l.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteLeave.mutate({ id: l.id })} className="text-[#C4A0B0] hover:text-red-500 transition-colors">
                          <X size={14} />
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

      {/* Add Leave Modal */}
      {showModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-[#1A0A12] text-lg">{selectedStaff.name}</h3>
                <p className="text-xs text-[#7A5A6A]">Mark time off or unavailability</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#C4A0B0] hover:text-[#8B2252]"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#8B2252] uppercase tracking-wide mb-1 block">Leave Type</label>
                <select
                  value={leaveForm.leaveType}
                  onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value as any }))}
                  className="w-full border border-[#EDE0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B2252]"
                >
                  {Object.entries(LEAVE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#8B2252] uppercase tracking-wide mb-1 block">Start Date</label>
                  <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-[#EDE0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B2252]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#8B2252] uppercase tracking-wide mb-1 block">End Date</label>
                  <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-[#EDE0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B2252]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#8B2252] uppercase tracking-wide mb-1 block">Notes (optional)</label>
                <textarea value={leaveForm.notes} onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="e.g. Family vacation, doctor's appointment..."
                  className="w-full border border-[#EDE0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B2252] resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-[#EDE0D8] rounded-xl py-2.5 text-sm font-medium text-[#7A5A6A] hover:bg-[#FAF5F2] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => addLeave.mutate({ staffId: selectedStaff.id, staffName: selectedStaff.name, ...leaveForm })}
                disabled={addLeave.isPending}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors"
                style={{ background: "#8B2252" }}
              >
                {addLeave.isPending ? "Saving..." : "Save Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#1A0A12]">Add Team Member</h3>
                <p className="mt-1 text-xs text-[#7A5A6A]">Add a person directly to APY HQ and assign their role and home studio.</p>
              </div>
              <button onClick={() => setShowAddMember(false)} className="text-[#C4A0B0] transition-colors hover:text-[#8B2252]" aria-label="Close add team member form"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Full Name</label>
                <input value={newMember.name} onChange={(e) => setNewMember((member) => ({ ...member, name: e.target.value }))} placeholder="e.g. Jordan Smith" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Role</label>
                  <select value={newMember.role} onChange={(e) => setNewMember((member) => ({ ...member, role: e.target.value as typeof member.role }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none">
                    <option>Operations Manager</option>
                    <option>Yoga Instructor</option>
                    <option>Puppy Monitor</option>
                    <option>Puppy Specialist</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Home Studio</label>
                  <select value={newMember.location} onChange={(e) => setNewMember((member) => ({ ...member, location: e.target.value as typeof member.location }))} className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none">
                    <option value="KW">Kitchener</option>
                    <option value="OAK">Oakville</option>
                    <option value="HAM">Hamilton</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Email Address</label>
                <input type="email" value={newMember.email} onChange={(e) => setNewMember((member) => ({ ...member, email: e.target.value }))} placeholder="name@email.com" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8B2252]">Phone Number <span className="normal-case font-medium text-[#7A5A6A]">(optional)</span></label>
                <input type="tel" value={newMember.phone} onChange={(e) => setNewMember((member) => ({ ...member, phone: e.target.value }))} placeholder="(289) 788-1885" className="w-full rounded-lg border border-[#EDE0D8] px-3 py-2 text-sm focus:border-[#8B2252] focus:outline-none" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowAddMember(false)} className="flex-1 rounded-xl border border-[#EDE0D8] py-2.5 text-sm font-medium text-[#7A5A6A] transition-colors hover:bg-[#FAF5F2]">Cancel</button>
              <button onClick={() => createTeamMember.mutate(newMember)} disabled={createTeamMember.isPending || !newMember.name.trim() || !newMember.email.trim()} className="flex-1 rounded-xl bg-[#8B2252] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#6B1A3E] disabled:cursor-not-allowed disabled:opacity-50">
                {createTeamMember.isPending ? "Adding..." : "Add to APY HQ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
