import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Mail, Pencil, Phone, RefreshCw, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Employee = {
  id: number;
  sourceApplicationId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  location: string;
  employmentStatus: "active" | "inactive";
  startedAt: Date | string;
  endedAt: Date | string | null;
};

const LOCATION_LABELS: Record<string, string> = {
  KW: "Kitchener",
  HAM: "Hamilton",
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

export default function EmployeeDirectory() {
  const { data, error, isLoading, refetch } = trpc.staffAvailability.listEmployees.useQuery();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const reactivate = trpc.staffAvailability.reactivateTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Employee restored to APY HQ");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateEmployee = trpc.staffAvailability.updateEmployeeRecord.useMutation({
    onSuccess: () => {
      toast.success("Employee record updated");
      setEditingEmployee(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const employees = (data ?? []) as Employee[];
  const activeEmployees = employees.filter((employee) => employee.employmentStatus === "active");
  const inactiveEmployees = employees.filter((employee) => employee.employmentStatus === "inactive");
  const visibleEmployees = filter === "all"
    ? employees
    : employees.filter((employee) => employee.employmentStatus === filter);

  const handleUpdateEmployee = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEmployee) return;
    const formData = new FormData(event.currentTarget);
    updateEmployee.mutate({
      id: editingEmployee.id,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      role: String(formData.get("role") ?? ""),
      location: String(formData.get("location") ?? "CENTRAL") as "KW" | "OAK" | "HAM" | "CENTRAL",
    });
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <main className="container max-w-7xl py-10">
        <Link href="/staff" className="mb-5 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-[#8B2252] hover:text-[#6B1A3E]">
          <ArrowLeft className="h-4 w-4" /> APY HQ
        </Link>

        <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[#8B2252]">
              <UsersRound className="h-5 w-5" />
              <span className="font-body text-xs font-bold uppercase tracking-[0.18em]">People</span>
            </div>
            <h1 className="font-display text-4xl font-bold text-[#1A0A12]">Employee Directory</h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-[#6E5360]">
              APY's record of active and former team members. Removing someone from APY HQ clears their staffing access and keeps their history here.
            </p>
          </div>
          <Link href="/admin/staff-availability" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B2252] px-5 py-3 font-body text-sm font-bold text-white hover:bg-[#6B1A3E]">
            Manage Active Team
          </Link>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => setFilter("all")} className={`rounded-2xl border bg-white p-5 text-left transition-colors ${filter === "all" ? "border-[#8B2252] ring-2 ring-[#8B2252]/15" : "border-[#EADBE2] hover:border-[#CFA5B7]"}`}>
            <p className="font-body text-xs font-bold uppercase tracking-wider text-[#956A7C]">All employees</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#1A0A12]">{employees.length}</p>
          </button>
          <button type="button" onClick={() => setFilter("active")} className={`rounded-2xl border bg-emerald-50 p-5 text-left transition-colors ${filter === "active" ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-emerald-100 hover:border-emerald-300"}`}>
            <p className="font-body text-xs font-bold uppercase tracking-wider text-emerald-700">Active employees</p>
            <p className="mt-2 font-display text-3xl font-bold text-emerald-800">{activeEmployees.length}</p>
          </button>
          <button type="button" onClick={() => setFilter("inactive")} className={`rounded-2xl border bg-[#FFF8FA] p-5 text-left transition-colors ${filter === "inactive" ? "border-[#956A7C] ring-2 ring-[#956A7C]/15" : "border-[#EADBE2] hover:border-[#CFA5B7]"}`}>
            <p className="font-body text-xs font-bold uppercase tracking-wider text-[#956A7C]">Former or removed</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#6E5360]">{inactiveEmployees.length}</p>
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#EADBE2] bg-white">
          <div className="border-b border-[#F1E7E2] px-5 py-4">
            <h2 className="font-display text-xl font-bold text-[#1A0A12]">{filter === "all" ? "All employee records" : filter === "active" ? "Active employee records" : "Former or removed employee records"}</h2>
          </div>
          {isLoading ? (
            <p className="px-5 py-16 text-center font-body text-sm text-[#8B2252]">Loading employee records…</p>
          ) : error ? (
            <div className="px-5 py-14 text-center">
              <UsersRound className="mx-auto h-9 w-9 text-[#D8BFC9]" />
              <p className="mt-3 font-body text-sm font-semibold text-[#3D1A2E]">Employee records could not be loaded.</p>
              <p className="mt-1 font-body text-xs text-[#956A7C]">Check your APY HQ access, then try again.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#8B2252]/25 bg-[#FFF8FA] px-3 py-2 font-body text-xs font-bold text-[#8B2252] hover:bg-[#FFF0F5]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          ) : visibleEmployees.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <UsersRound className="mx-auto h-9 w-9 text-[#D8BFC9]" />
              <p className="mt-3 font-body text-sm font-semibold text-[#3D1A2E]">No {filter === "all" ? "employee" : filter} employee records.</p>
              <p className="mt-1 font-body text-xs text-[#956A7C]">Choose another status above to view more records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="bg-[#FFF5F8]">
                  <tr className="font-body text-[11px] font-bold uppercase tracking-wider text-[#956A7C]">
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
                    return (
                      <tr key={employee.id} className="border-t border-[#F4EAED] font-body text-sm text-[#3D1A2E]">
                        <td className="px-5 py-4">
                          <p className="font-bold text-[#1A0A12]">{employee.name}</p>
                          {!isActive && employee.endedAt && <p className="mt-0.5 text-xs text-[#956A7C]">Removed {formatDate(employee.endedAt)}</p>}
                        </td>
                        <td className="px-4 py-4">{employee.role}</td>
                        <td className="px-4 py-4">{LOCATION_LABELS[employee.location] ?? employee.location}</td>
                        <td className="px-4 py-4">
                          <div className="space-y-1 text-xs text-[#6E5360]">
                            {employee.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{employee.email}</p>}
                            {employee.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{employee.phone}</p>}
                            {!employee.email && !employee.phone && <p>Not recorded</p>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#6E5360]">{formatDate(employee.startedAt)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${isActive ? "bg-emerald-100 text-emerald-800" : "bg-[#EFE5E9] text-[#725665]"}`}>
                            {isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={() => setEditingEmployee(employee)} className="inline-flex items-center gap-1.5 font-body text-xs font-bold text-[#8B2252] hover:text-[#6B1A3E]">
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            {isActive && employee.sourceApplicationId ? (
                              <Link href="/admin/staff-availability" className="font-body text-xs font-bold text-[#8B2252] hover:text-[#6B1A3E]">Manage</Link>
                            ) : !isActive && employee.sourceApplicationId ? (
                              <button
                                type="button"
                                onClick={() => reactivate.mutate({ employeeId: employee.id })}
                                disabled={reactivate.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B2252]/25 bg-[#FFF8FA] px-3 py-2 text-xs font-bold text-[#8B2252] hover:bg-[#FFF0F5] disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${reactivate.isPending ? "animate-spin" : ""}`} /> Restore to APY HQ
                              </button>
                            ) : (
                              <span className="font-body text-xs text-[#956A7C]">APY HQ profile not set</span>
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
      </main>

      <Dialog open={Boolean(editingEmployee)} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent className="max-w-xl border-[#EADBE2] bg-[#FEFAF4]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#1A0A12]">Edit employee record</DialogTitle>
            <DialogDescription className="font-body leading-6 text-[#6E5360]">Update contact and assignment details. Changes also update the linked APY HQ profile when one exists.</DialogDescription>
          </DialogHeader>
          {editingEmployee && (
            <form key={editingEmployee.id} onSubmit={handleUpdateEmployee} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 font-body text-sm font-semibold text-[#3D1A2E]">Name<Input name="name" defaultValue={editingEmployee.name} required className="border-[#EADBE2] bg-white" /></label>
                <label className="space-y-1.5 font-body text-sm font-semibold text-[#3D1A2E]">Role<Input name="role" defaultValue={editingEmployee.role} required className="border-[#EADBE2] bg-white" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 font-body text-sm font-semibold text-[#3D1A2E]">Email<Input name="email" type="email" defaultValue={editingEmployee.email ?? ""} className="border-[#EADBE2] bg-white" /></label>
                <label className="space-y-1.5 font-body text-sm font-semibold text-[#3D1A2E]">Phone<Input name="phone" type="tel" defaultValue={editingEmployee.phone ?? ""} className="border-[#EADBE2] bg-white" /></label>
              </div>
              <label className="block space-y-1.5 font-body text-sm font-semibold text-[#3D1A2E]">Primary location
                <select name="location" defaultValue={editingEmployee.location} className="h-9 w-full rounded-md border border-[#EADBE2] bg-white px-3 text-sm outline-none focus:border-[#8B2252] focus:ring-2 focus:ring-[#8B2252]/15">
                  <option value="KW">Kitchener</option><option value="HAM">Hamilton</option><option value="OAK">Oakville</option><option value="CENTRAL">APY-wide</option>
                </select>
              </label>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingEmployee(null)}>Cancel</Button>
                <Button type="submit" disabled={updateEmployee.isPending} className="bg-[#8B2252] text-white hover:bg-[#6B1A3E]">{updateEmployee.isPending ? "Saving…" : "Save record"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
