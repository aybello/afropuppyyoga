import { Link } from "wouter";
import { buildEmployeeTeamTree, type EmployeeTreeMember } from "@shared/employeeTeamTree";
import { getPuppyMonitorLocationCoverage } from "@shared/puppyMonitorLocationCoverage";

type Leave = { staffId: number; startDate: string; endDate: string };
const ROLE_COLORS: Record<string, string> = {
  "Operations Manager": "#D97706", "Yoga Instructor": "#8B2252", "Puppy Monitor": "#7C3AED",
  "Puppy Specialist": "#0891B2", BDR: "#0F766E", "Social Media Specialist": "#DB2777",
};

export default function EmployeeTeamTree({ employees, leaves = [], today, onManageAvailability }: {
  employees: EmployeeTreeMember[];
  leaves?: Leave[];
  today: string;
  onManageAvailability?: (employee: EmployeeTreeMember) => void;
}) {
  const locations = buildEmployeeTeamTree(employees);
  const renderLocation = (location: typeof locations[number]) => {
    const monitors = location.roles.find((branch) => branch.role === "Puppy Monitor")?.members ?? [];
    const coverage = getPuppyMonitorLocationCoverage(monitors.filter((person) => person.employmentStatus === "active").length);
    const total = location.roles.reduce((count, branch) => count + branch.members.length, 0);
    return (
      <section key={location.key} aria-label={`${location.label} employee team`} className="rounded-2xl border border-[#EADBE2] bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-[#8B2252] px-3 py-2 text-sm font-bold text-white">
          <h3>{location.label}</h3><span className="text-xs font-medium">{total} employees</span>
        </div>
        <div className="space-y-4">
          {location.roles.map(({ role, members }) => {
            const color = ROLE_COLORS[role] ?? "#8B2252";
            return (
              <div key={role}>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{role} · {members.length}</h4>
                <div className="grid gap-2">
                  {members.map((employee) => {
                    const active = employee.employmentStatus === "active";
                    const onLeave = active && employee.sourceApplicationId !== null && leaves.some((leave) =>
                      leave.staffId === employee.sourceApplicationId && leave.startDate <= today && leave.endDate >= today);
                    return (
                      <div key={employee.id}>
                      <Link href={`/admin/employees?employee=${employee.id}`} data-employee-id={employee.id}
                        className="flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B2252]"
                        style={{ borderColor: `${color}40`, background: active ? `${color}08` : "#FAF5F7" }}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }} aria-hidden="true">{employee.name.charAt(0)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold text-[#1A0A12]">{employee.name}</p>
                          <p className="mt-0.5 text-[10px] text-[#7A5A6A]">{employee.hasApyHqAccess ? "Login enabled" : "No portal access"}{onLeave ? " · On leave" : ""}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-[#EFE5E9] text-[#725665]"}`}>{active ? "Active" : "Inactive"}</span>
                      </Link>
                      {onManageAvailability && active && employee.hasApyHqAccess && employee.sourceApplicationId !== null && <button type="button" onClick={() => onManageAvailability(employee)} className="mt-1 text-[11px] font-semibold text-[#8B2252] hover:underline">Manage availability</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {total === 0 && <p className="rounded-lg border border-dashed border-[#DCCAD3] px-3 py-4 text-center text-xs text-[#7A5A6A]">No employees assigned here.</p>}
          {["KW", "OAK", "HAM"].includes(location.key) && <p className="border-t border-[#F1E7E2] pt-3 text-[11px] text-[#7A5A6A]">Puppy Monitors: {coverage.activeCount} active · target {coverage.target}. Planning reminder only, with no minimum or maximum enforced.</p>}
        </div>
      </section>
    );
  };
  return (
    <div className="space-y-5">
      {locations.filter((location) => location.key === "CENTRAL").map(renderLocation)}
      <div className="grid items-start gap-5 lg:grid-cols-3">{locations.filter((location) => location.key !== "CENTRAL").map(renderLocation)}</div>
    </div>
  );
}
