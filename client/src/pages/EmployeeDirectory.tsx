import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Link, useLocation, useSearch } from "wouter";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, CheckCircle2, Clock3, KeyRound, List, Mail, Network, Pencil, Phone, RefreshCw, Trash2, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmployeeTeamTree from "@/components/EmployeeTeamTree";
import EmployeeAvailabilityDialog from "@/components/EmployeeAvailabilityDialog";
import { employeeDirectoryTabUrl, getEmployeeDirectoryTab, type EmployeeDirectoryTab } from "@shared/employeeDirectoryNavigation";
import { getTorontoCalendarDate } from "@shared/scheduleVisibility";
import { APY_TEAM_LOCATIONS, APY_TEAM_ROLES, isCentralApyTeamRole, resolveLocationForRole, type ApyTeamLocation, type ApyTeamRole } from "@shared/apyPermissions";

type Employee = {
  id: number;
  sourceApplicationId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  location: string;
  employmentStatus: "active" | "inactive";
  hasApyHqAccess: boolean;
  startedAt: Date | string;
  endedAt: Date | string | null;
};

/**
 * A legacy record may hold a pairing the current rules reject, such as a site
 * role saved at CENTRAL. Opening the editor presents a valid starting pairing
 * so the owner is never blocked from editing that person.
 */
function withEditableAssignment(employee: Employee): Employee {
  return { ...employee, location: resolveLocationForRole(employee.role, employee.location) };
}

type NewEmployeeForm = {
  name: string;
  email: string;
  phone: string;
  role: ApyTeamRole;
  location: ApyTeamLocation;
  startedAt: string;
};

const LOCATION_LABELS: Record<string, string> = {
  KW: "Kitchener",
  HAM: "Hamilton",
  GUE: "Guelph",
  OAK: "Oakville",
  CENTRAL: "APY-wide",
};

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function createEmptyEmployeeForm(): NewEmployeeForm {
  return {
    name: "",
    email: "",
    phone: "",
    role: "Yoga Instructor",
    location: "KW",
    startedAt: new Date().toISOString().slice(0, 10),
  };
}

export default function EmployeeDirectory() {
  const utils = trpc.useUtils();
  const { data, error, isLoading, refetch } = trpc.staffAvailability.listEmployees.useQuery();
  const search = useSearch();
  const [, navigate] = useLocation();
  const tab = getEmployeeDirectoryTab(search);
  const changeTab = (next: EmployeeDirectoryTab) => navigate(employeeDirectoryTabUrl(next, search));
  const availability = trpc.staffAvailability.getOrgChart.useQuery(undefined, { enabled: tab === "tree" });
  const today = getTorontoCalendarDate(new Date());
  const refreshPeople = () => {
    void utils.staffAvailability.listEmployees.invalidate();
    void utils.staffAvailability.getOrgChart.invalidate();
    void utils.staffAvailability.getWeekendCoverage.invalidate();
    void utils.puppySchedule.listWithStaffing.invalidate();
    void utils.staff.listStaff.invalidate();
  };
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmEditEnablesLogin, setConfirmEditEnablesLogin] = useState(false);
  const [accessRefresh, setAccessRefresh] = useState<"loading" | "failed" | null>(null);
  const editSession = useRef(0);
  const openEmployeeEditor = (employee: Employee) => {
    editSession.current += 1;
    setAccessRefresh(null);
    setConfirmEditEnablesLogin(false);
    setEditingEmployee(withEditableAssignment(employee));
  };
  const closeEmployeeEditor = () => {
    editSession.current += 1;
    setAccessRefresh(null);
    setConfirmEditEnablesLogin(false);
    setEditingEmployee(null);
  };
  const refreshEditingAccess = async (employeeId: number, session: number) => {
    if (editSession.current !== session) return;
    setConfirmEditEnablesLogin(false);
    setAccessRefresh("loading");
    try {
      const result = await refetch();
      if (editSession.current !== session) return;
      const employee = !result.isError && result.data?.find((person) => person.id === employeeId);
      if (!employee) {
        setAccessRefresh("failed");
        return;
      }
      // Do not replace the draft: only these two server-owned fields affect consent.
      setEditingEmployee((current) => current?.id === employeeId ? {
        ...current,
        employmentStatus: employee.employmentStatus,
        hasApyHqAccess: employee.hasApyHqAccess,
      } : current);
      setConfirmEditEnablesLogin(false);
      setAccessRefresh(null);
    } catch {
      if (editSession.current === session) setAccessRefresh("failed");
    }
  };
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState<NewEmployeeForm>(createEmptyEmployeeForm);
  const [departingEmployee, setDepartingEmployee] = useState<Employee | null>(null);
  const [reactivatingEmployee, setReactivatingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [availabilityEmployeeId, setAvailabilityEmployeeId] = useState<number | null>(null);
  const requestedEmployeeId = new URLSearchParams(search).get("employee");
  const openedRequestedEmployee = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedEmployeeId) { openedRequestedEmployee.current = null; return; }
    if (!data || openedRequestedEmployee.current === requestedEmployeeId) return;
    openedRequestedEmployee.current = requestedEmployeeId;
    const requested = data.find((employee) => String(employee.id) === requestedEmployeeId);
    if (requested) openEmployeeEditor(requested as Employee);
  }, [data, requestedEmployeeId]);
  // Restores a linked APY HQ profile and therefore grants operational access.
  const restoreApyHqTeamMember = trpc.staffAvailability.reactivateTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Employee restored to APY HQ");
      refreshPeople();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateEmployee = trpc.staffAvailability.updateEmployeeRecord.useMutation({
    onSuccess: (result) => {
      const retired = result.retiredClassAssignments + result.releasedLeadershipCoverage;
      if (result.roleChanged && retired > 0) {
        toast.success(`Position updated from ${result.previousRole}`, {
          description: `${result.retiredClassAssignments} class assignments removed; ${result.releasedLeadershipCoverage} leadership slots opened for reassignment.`,
        });
      } else if (result.roleChanged) {
        toast.success(`Position updated from ${result.previousRole}`, {
          description: "No upcoming duties were affected. Existing login access and training follow the saved position.",
        });
      } else {
        toast.success("Employee record updated");
      }
      closeEmployeeEditor();
      refreshPeople();
    },
    onMutate: () => editSession.current,
    onError: (error, variables, session) => {
      toast.error(error.message);
      if (session !== undefined && /saving this active employee will enable APY HQ login\. Confirm this access change before saving\./i.test(error.message)) {
        void refreshEditingAccess(variables.id, session);
      }
    },
  });
  const createEmployee = trpc.staffAvailability.createEmployeeRecord.useMutation({
    onSuccess: () => {
      toast.success("Employee added with APY HQ access");
      setShowAddEmployee(false);
      setNewEmployee(createEmptyEmployeeForm());
      refreshPeople();
    },
    onError: (error) => toast.error(error.message),
  });
  const provisionApyHqAccess = trpc.staffAvailability.provisionEmployeeApyHqAccess.useMutation({
    onSuccess: () => {
      toast.success("APY HQ access added for this employee");
      refreshPeople();
    },
    onError: (error) => toast.error(error.message),
  });
  const markEmployeeDeparted = trpc.staffAvailability.markEmployeeDeparted.useMutation({
    onSuccess: () => {
      toast.success("Employee marked as no longer active");
      setDepartingEmployee(null);
      refreshPeople();
    },
    onError: (error) => toast.error(error.message),
  });
  // Explicit activation restores employment and role-based login access together.
  const activateEmployee = trpc.staffAvailability.reactivateEmployeeEmployment.useMutation({
    onSuccess: () => {
      toast.success("Employee activated with login access.");
      setReactivatingEmployee(null);
      refreshPeople();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteFormerEmployee = trpc.staffAvailability.deleteFormerEmployeeRecord.useMutation({
    onSuccess: () => {
      toast.success("Former employee record deleted permanently");
      setDeletingEmployee(null);
      refreshPeople();
    },
    onError: (error) => toast.error(error.message),
  });

  const employees = (data ?? []) as Employee[];
  const activeEmployees = employees.filter((employee) => employee.employmentStatus === "active");
  const inactiveEmployees = employees.filter((employee) => employee.employmentStatus === "inactive");
  const availabilityEmployee = employees.find((employee) => employee.id === availabilityEmployeeId);
  const selectFilter = (next: typeof filter) => { setFilter(next); changeTab("list"); };
  const visibleEmployees = filter === "all"
    ? employees
    : employees.filter((employee) => employee.employmentStatus === filter);

  const handleUpdateEmployee = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEmployee) return;
    if (accessRefresh) return;
    if (!APY_TEAM_ROLES.some((role) => role === editingEmployee.role)) {
      toast.error("Choose a supported position before saving.");
      return;
    }
    if (editingEmployee.employmentStatus === "active" && !editingEmployee.hasApyHqAccess && !confirmEditEnablesLogin) {
      toast.error("Confirm that saving will enable login for this active employee.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    updateEmployee.mutate({
      id: editingEmployee.id,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      role: editingEmployee.role as ApyTeamRole,
      location: editingEmployee.location as ApyTeamLocation,
      confirmEnableLogin: editingEmployee.employmentStatus === "active" && !editingEmployee.hasApyHqAccess && confirmEditEnablesLogin,
    });
  };

  const handleCreateEmployee = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createEmployee.mutate(newEmployee);
  };

  return (
    <div className="min-h-screen apy-staff-ui bg-background">
      <AdminNav />
      <main className="container max-w-7xl py-6 sm:py-8">
        <Link href="/staff" className="mb-5 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-brand-link hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> APY HQ
        </Link>

        <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-brand-link">
              <UsersRound className="h-5 w-5" />
              <span className="font-body text-xs font-bold uppercase tracking-[0.18em]">People</span>
            </div>
            <h1 className="font-display text-3xl font-medium text-foreground">Employee Directory</h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-muted-foreground">
              Active employees can sign in with their saved email or phone. Remove someone from the active team when they leave to stop login immediately and keep their history.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setShowAddEmployee(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-body text-sm font-bold text-primary-foreground hover:bg-primary-hover">
              <UserPlus className="h-4 w-4" /> Add Employee
            </Button>
            <Link href="/admin/staff-availability" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 py-3 font-body text-sm font-bold text-brand-link hover:bg-accent">
              <CalendarCheck className="h-4 w-4" /> Weekend Ops
            </Link>
          </div>
        </section>

        <section className="mb-6 grid gap-3 rounded-2xl border border-border bg-white p-2 sm:grid-cols-3">
          <button type="button" onClick={() => selectFilter("all")} className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${filter === "all" ? "border-primary bg-accent" : "border-transparent bg-white hover:bg-accent/60"}`}>
            <p className="font-body text-sm font-semibold text-foreground">All employees</p>
            <p className="font-body text-xl font-semibold tabular-nums text-foreground">{employees.length}</p>
          </button>
          <button type="button" onClick={() => selectFilter("active")} className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${filter === "active" ? "border-primary bg-accent" : "border-transparent bg-white hover:bg-accent/60"}`}>
            <p className="font-body text-sm font-semibold text-foreground">Active employees</p>
            <p className="font-body text-xl font-semibold tabular-nums text-emerald-800">{activeEmployees.length}</p>
          </button>
          <button type="button" onClick={() => selectFilter("inactive")} className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${filter === "inactive" ? "border-primary bg-accent" : "border-transparent bg-white hover:bg-accent/60"}`}>
            <p className="font-body text-sm font-semibold text-foreground">Former or removed</p>
            <p className="font-body text-xl font-semibold tabular-nums text-muted-foreground">{inactiveEmployees.length}</p>
          </button>
        </section>

        <Tabs value={tab} onValueChange={(value) => changeTab(value as EmployeeDirectoryTab)}>
          <TabsList aria-label="Employee Directory views" className="mb-4 h-11 w-full justify-start border border-border bg-white p-1 sm:w-fit">
            <TabsTrigger value="list" className="px-5 text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><List className="h-4 w-4" /> List</TabsTrigger>
            <TabsTrigger value="tree" className="px-5 text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Network className="h-4 w-4" /> Team Tree</TabsTrigger>
          </TabsList>
          <TabsContent value="list">
        <section className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-xl font-medium text-foreground">{filter === "all" ? "All employee records" : filter === "active" ? "Active employee records" : "Former or removed employee records"}</h2>
          </div>
          {isLoading ? (
            <p className="px-5 py-16 text-center font-body text-sm text-brand-link">Loading employee records…</p>
          ) : error ? (
            <div className="px-5 py-14 text-center">
              <UsersRound className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-body text-sm font-semibold text-foreground">Employee records could not be loaded.</p>
              <p className="mt-1 font-body text-xs text-muted-foreground">Check your APY HQ access, then try again.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-accent px-3 py-2 font-body text-xs font-bold text-brand-link hover:bg-accent"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          ) : visibleEmployees.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <UsersRound className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-body text-sm font-semibold text-foreground">No {filter === "all" ? "employee" : filter} employee records.</p>
              <p className="mt-1 font-body text-xs text-muted-foreground">Choose another status above to view more records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="bg-accent">
                  <tr className="font-body text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => {
                    const isActive = employee.employmentStatus === "active";
                    const isReactivatingThisEmployee = activateEmployee.isPending
                      && reactivatingEmployee?.id === employee.id;
                    return (
                      <tr key={employee.id} className="border-t border-border font-body text-sm text-foreground">
                        <td className="px-5 py-4">
                          <p className="font-bold text-foreground">{employee.name}</p>
                          {!isActive && employee.endedAt && <p className="mt-0.5 text-xs text-muted-foreground">Removed {formatDate(employee.endedAt)}</p>}
                        </td>
                        <td className="px-4 py-4">{employee.role}</td>
                        <td className="px-4 py-4">{LOCATION_LABELS[employee.location] ?? employee.location}</td>
                        <td className="px-4 py-4">
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {employee.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{employee.email}</p>}
                            {employee.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{employee.phone}</p>}
                            {!employee.email && !employee.phone && <p>Not recorded</p>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(employee.startedAt)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${isActive ? "bg-emerald-100 text-emerald-800" : "bg-accent text-muted-foreground"}`}>
                            {isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            {isActive ? "Active" : "Inactive"}
                          </span>
                          <p className={`mt-1 text-[10px] ${isActive && employee.hasApyHqAccess ? "text-emerald-700" : "text-muted-foreground"}`}>
                            {isActive ? employee.hasApyHqAccess ? "Login enabled" : "Login needs setup" : "Login removed"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={() => openEmployeeEditor(employee)} className="inline-flex items-center gap-1.5 font-body text-xs font-bold text-brand-link hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" /> Edit position or details
                            </button>
                            {isActive && employee.sourceApplicationId && employee.hasApyHqAccess ? (
                              <span className="inline-flex items-center gap-1.5 font-body text-xs font-bold text-emerald-700"><KeyRound className="h-3.5 w-3.5" /> Login enabled</span>
                            ) : employee.sourceApplicationId && isActive ? (
                              <button
                                type="button"
                                onClick={() => restoreApyHqTeamMember.mutate({ employeeId: employee.id })}
                                disabled={restoreApyHqTeamMember.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-accent px-3 py-2 text-xs font-bold text-brand-link hover:bg-accent disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${restoreApyHqTeamMember.isPending ? "animate-spin" : ""}`} /> {restoreApyHqTeamMember.isPending ? "Enabling…" : "Enable login"}
                              </button>
                            ) : !isActive && employee.sourceApplicationId ? (
                              <span className="font-body text-xs text-muted-foreground">Activate employee first</span>
                            ) : isActive ? (
                              <button
                                type="button"
                                onClick={() => provisionApyHqAccess.mutate({ employeeId: employee.id })}
                                disabled={provisionApyHqAccess.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-accent px-3 py-2 text-xs font-bold text-brand-link hover:bg-accent disabled:opacity-50"
                              >
                                <KeyRound className="h-3.5 w-3.5" /> {provisionApyHqAccess.isPending ? "Enabling…" : "Enable login"}
                              </button>
                            ) : (
                              <span className="font-body text-xs text-muted-foreground">No APY HQ access</span>
                            )}
                            {!isActive && (
                              <button type="button" onClick={() => setReactivatingEmployee(employee)} disabled={activateEmployee.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
                                <RefreshCw className={`h-3.5 w-3.5 ${isReactivatingThisEmployee ? "animate-spin" : ""}`} /> {isReactivatingThisEmployee ? "Activating…" : "Activate employee & login"}
                              </button>
                            )}
                            {isActive && (
                              <button type="button" onClick={() => setDepartingEmployee(employee)} className="inline-flex items-center gap-1.5 font-body text-xs font-bold text-destructive hover:text-destructive">
                                <UserMinus className="h-3.5 w-3.5" /> Remove from active team
                              </button>
                            )}
                            {!isActive && (
                              <button type="button" onClick={() => setDeletingEmployee(employee)} className="inline-flex items-center gap-1.5 font-body text-xs font-bold text-[#A33A36] hover:text-[#7D2825]">
                                <Trash2 className="h-3.5 w-3.5" /> Delete permanently
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </TabsContent>
          <TabsContent value="tree">
            <div className="mb-5">
              <h2 className="font-display text-xl font-medium text-foreground">APY Team Tree</h2>
              <p className="mt-1 font-body text-sm text-muted-foreground">Every Directory employee is shown under their saved role and location, including inactive employees. Select a person to edit their record here.</p>
            </div>
            {isLoading ? <p role="status" className="py-12 text-center text-sm text-brand-link">Loading employee tree…</p> : error ? (
              <div role="alert" className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground"><p>The employee tree could not be loaded.</p><Button type="button" variant="outline" onClick={() => refetch()} className="mt-3">Try again</Button></div>
            ) : <>
              {availability.isLoading && <p role="status" className="mb-4 text-sm text-muted-foreground">Loading availability controls…</p>}
              {availability.error && <p role="alert" className="mb-4 text-sm text-muted-foreground">Leave information could not be loaded. <button type="button" onClick={() => availability.refetch()} className="font-semibold underline">Retry availability</button></p>}
              <EmployeeTeamTree employees={employees} leaves={availability.data?.leaves ?? []} today={today}
                onEditEmployee={(employee) => { const record = employees.find((person) => person.id === employee.id); if (record) openEmployeeEditor(record); }}
                onManageAvailability={availability.data && !availability.error ? (employee) => setAvailabilityEmployeeId(employee.id) : undefined} />
            </>}
          </TabsContent>
        </Tabs>
      </main>

      {availabilityEmployee && <EmployeeAvailabilityDialog key={availabilityEmployee.id} employee={availabilityEmployee} leaves={availability.data?.leaves ?? []} today={today} onClose={() => setAvailabilityEmployeeId(null)} onSaved={refreshPeople} />}

      <Dialog open={showAddEmployee} onOpenChange={(open) => {
        setShowAddEmployee(open);
        if (!open) setNewEmployee(createEmptyEmployeeForm());
      }}>
        <DialogContent className="max-w-xl border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Add employee</DialogTitle>
            <DialogDescription className="font-body leading-6 text-muted-foreground">Create the Employee Directory record and a matching active APY HQ profile. They receive role-based access when they sign in with this email or phone number.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEmployee} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Full name<Input value={newEmployee.name} onChange={(event) => setNewEmployee((current) => ({ ...current, name: event.target.value }))} required className="border-border bg-white" /></label>
              <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Start date<Input type="date" value={newEmployee.startedAt} onChange={(event) => setNewEmployee((current) => ({ ...current, startedAt: event.target.value }))} required className="border-border bg-white" /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Email<Input type="email" value={newEmployee.email} onChange={(event) => setNewEmployee((current) => ({ ...current, email: event.target.value }))} className="border-border bg-white" /></label>
              <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Phone<Input type="tel" value={newEmployee.phone} onChange={(event) => setNewEmployee((current) => ({ ...current, phone: event.target.value }))} className="border-border bg-white" /></label>
            </div>
            <p className="-mt-2 font-body text-xs text-muted-foreground">Enter at least one contact method.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Role
                <select value={newEmployee.role} onChange={(event) => setNewEmployee((current) => ({
                  ...current,
                  role: event.target.value as ApyTeamRole,
                  location: resolveLocationForRole(event.target.value, current.location),
                }))} className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-border focus:ring-2 focus:ring-ring/15">
                  {APY_TEAM_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Primary location
                <select value={newEmployee.location} disabled={isCentralApyTeamRole(newEmployee.role)} onChange={(event) => setNewEmployee((current) => ({ ...current, location: event.target.value as NewEmployeeForm["location"] }))} className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-border focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-accent">
                  {APY_TEAM_LOCATIONS.map((location) => <option key={location} value={location}>{LOCATION_LABELS[location]}</option>)}
                </select>
              </label>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddEmployee(false)}>Cancel</Button>
              <Button type="submit" disabled={createEmployee.isPending} className="bg-primary text-primary-foreground hover:bg-primary-hover">{createEmployee.isPending ? "Adding…" : "Add employee & grant access"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(departingEmployee)} onOpenChange={(open) => !open && setDepartingEmployee(null)}>
        <DialogContent className="max-w-lg border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Remove employee from active team?</DialogTitle>
            <DialogDescription className="font-body leading-6 text-muted-foreground">{departingEmployee?.name} will become inactive and lose login access immediately. Email links and phone codes will stop working. Their employee record and application history will remain. Any staffing gaps can be handled afterwards.</DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setDepartingEmployee(null)}>Keep active</Button>
            <Button type="button" disabled={markEmployeeDeparted.isPending} onClick={() => departingEmployee && markEmployeeDeparted.mutate({ employeeId: departingEmployee.id })} className="bg-destructive text-white hover:bg-destructive">{markEmployeeDeparted.isPending ? "Removing…" : "Remove & stop login"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reactivatingEmployee)} onOpenChange={(open) => !open && setReactivatingEmployee(null)}>
        <DialogContent className="max-w-lg border-[#CFE7DC] bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Activate employee and login?</DialogTitle>
            <DialogDescription className="font-body leading-6 text-muted-foreground">{reactivatingEmployee?.name} will become active and receive role-based login access using their saved email or phone. Signed onboarding is not required for this employee action.</DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-body text-sm leading-5 text-emerald-800">Past duty history is retained. Future duties are not automatically reassigned by activating login. Use a fresh email link or phone code to sign in.</p>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setReactivatingEmployee(null)}>Keep inactive</Button>
            <Button type="button" disabled={activateEmployee.isPending} onClick={() => reactivatingEmployee && activateEmployee.mutate({ employeeId: reactivatingEmployee.id })} className="bg-emerald-700 text-white hover:bg-emerald-800">{activateEmployee.isPending ? "Reactivating…" : "Activate employee & login"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingEmployee)} onOpenChange={(open) => !open && setDeletingEmployee(null)}>
        <DialogContent className="max-w-lg border-[#F1D4D1] bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Delete former employee record permanently?</DialogTitle>
            <DialogDescription className="font-body leading-6 text-muted-foreground">This will remove {deletingEmployee?.name} from the Employee Directory. Their original application and APY hiring history will remain available.</DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-body text-sm leading-5 text-red-800">This cannot be undone. Only inactive former-record entries can be deleted; active staff must be managed through the APY HQ team workflow.</p>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setDeletingEmployee(null)}>Cancel</Button>
            <Button type="button" disabled={deleteFormerEmployee.isPending} onClick={() => deletingEmployee && deleteFormerEmployee.mutate({ employeeId: deletingEmployee.id })} className="bg-[#A33A36] text-white hover:bg-[#7D2825]">{deleteFormerEmployee.isPending ? "Deleting…" : "Delete permanently"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingEmployee)} onOpenChange={(open) => { if (!open) closeEmployeeEditor(); }}>
        <DialogContent className="max-w-xl border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Edit position or employee details</DialogTitle>
            <DialogDescription className="font-body leading-6 text-muted-foreground">Choose a position and location or update contact details. Changes also update the linked APY HQ profile when one exists.</DialogDescription>
          </DialogHeader>
          {editingEmployee && (
            <form key={editingEmployee.id} onSubmit={handleUpdateEmployee} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Name<Input name="name" defaultValue={editingEmployee.name} required className="border-border bg-white" /></label>
                <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Position / role
                  <select
                    name="role"
                    value={editingEmployee.role}
                    onChange={(event) => setEditingEmployee((current) => current ? {
                      ...current,
                      role: event.target.value,
                      location: resolveLocationForRole(event.target.value, current.location),
                    } : current)}
                    className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-border focus:ring-2 focus:ring-ring/15"
                  >
                    {!APY_TEAM_ROLES.some((role) => role === editingEmployee.role) && <option value={editingEmployee.role} disabled>Current legacy role: {editingEmployee.role || "not set"} — choose a position</option>}
                    {APY_TEAM_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Email<Input name="email" type="email" defaultValue={editingEmployee.email ?? ""} className="border-border bg-white" /></label>
                <label className="space-y-1.5 font-body text-sm font-semibold text-foreground">Phone<Input name="phone" type="tel" defaultValue={editingEmployee.phone ?? ""} className="border-border bg-white" /></label>
              </div>
              <label className="block space-y-1.5 font-body text-sm font-semibold text-foreground">Primary location
                <select
                  name="location"
                  value={editingEmployee.location}
                  disabled={isCentralApyTeamRole(editingEmployee.role)}
                  onChange={(event) => setEditingEmployee((current) => current ? { ...current, location: event.target.value } : current)}
                  className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-border focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-accent"
                >
                  {APY_TEAM_LOCATIONS.map((location) => <option key={location} value={location}>{LOCATION_LABELS[location]}</option>)}
                </select>
                {isCentralApyTeamRole(editingEmployee.role) && <span className="block text-xs font-normal text-muted-foreground">This APY-wide role is centrally assigned.</span>}
              </label>
              <p className="rounded-lg border border-border bg-white p-3 font-body text-xs leading-5 text-muted-foreground">A position change can change portal permissions and role-based training, and remove incompatible upcoming duties from the schedule. Signed offer documents are not changed. Check the location before saving; switching from an APY-wide role defaults to Kitchener.</p>
              {accessRefresh === "loading" && <p role="status" className="text-sm text-muted-foreground">Refreshing login access before you can save…</p>}
              {accessRefresh === "failed" && <p role="alert" className="text-sm text-destructive">Could not refresh this employee's login access. Your edits are still here. <button type="button" className="font-semibold underline" onClick={() => void refreshEditingAccess(editingEmployee.id, editSession.current)}>Retry refresh</button></p>}
              {editingEmployee.employmentStatus === "active" && !editingEmployee.hasApyHqAccess && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 font-body text-xs leading-5 text-amber-900">
                  <input type="checkbox" checked={confirmEditEnablesLogin} disabled={Boolean(accessRefresh)} onChange={(event) => setConfirmEditEnablesLogin(event.target.checked)} className="mt-1" />
                  <span>I understand that saving this active employee will also enable their APY HQ login using the saved contact details.</span>
                </label>
              )}
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={closeEmployeeEditor}>Cancel</Button>
                <Button type="submit" disabled={updateEmployee.isPending || Boolean(accessRefresh)} className="bg-primary text-primary-foreground hover:bg-primary-hover">{updateEmployee.isPending ? "Saving…" : "Save record"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
