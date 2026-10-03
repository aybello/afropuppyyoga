import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmployeeTreeLeave } from "./EmployeeTeamTree";
import type { EmployeeTreeMember } from "@shared/employeeTeamTree";

const LEAVE_LABELS = { vacation: "Vacation", sick: "Sick leave", personal: "Personal leave", leave: "Leave", unavailable: "Unavailable" };
type LeaveType = keyof typeof LEAVE_LABELS;

export default function EmployeeAvailabilityDialog({ employee, leaves, today, onClose, onSaved }: {
  employee: EmployeeTreeMember;
  leaves: EmployeeTreeLeave[];
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ leaveType: "vacation" as LeaveType, startDate: today, endDate: today, notes: "" });
  const addLeave = trpc.staffAvailability.addLeave.useMutation({
    onSuccess: () => { onSaved(); toast.success("Leave added"); onClose(); },
    onError: (error) => toast.error(error.message),
  });
  const deleteLeave = trpc.staffAvailability.deleteLeave.useMutation({
    onSuccess: () => { onSaved(); toast.success("Leave removed"); },
    onError: (error) => toast.error(error.message),
  });
  const canManage = employee.employmentStatus === "active" && employee.hasApyHqAccess && employee.sourceApplicationId !== null;
  const ownLeaves = leaves.filter((leave) => leave.staffId === employee.sourceApplicationId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto border-[#EADBE2] bg-[#FEFAF4]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#1A0A12]">Availability for {employee.name}</DialogTitle>
          <DialogDescription>Manage leave here without leaving the Employee Directory. Adding leave does not remove employment or login access.</DialogDescription>
        </DialogHeader>
        {ownLeaves.length > 0 && <section className="space-y-2" aria-label="Saved leave">
          {ownLeaves.map((leave, index) => <div key={leave.id ?? index} className="flex items-center justify-between gap-3 rounded-lg border border-[#EADBE2] bg-white p-3 text-xs text-[#6E5360]">
            <div><p className="font-semibold">{LEAVE_LABELS[leave.leaveType as LeaveType] ?? "Leave"}</p><p>{leave.startDate} to {leave.endDate}</p>{leave.notes && <p className="mt-1 break-words">{leave.notes}</p>}</div>
            {leave.id !== undefined && <Button type="button" variant="outline" disabled={!canManage || deleteLeave.isPending} onClick={() => { if (window.confirm("Remove this leave entry?")) deleteLeave.mutate({ id: leave.id! }); }}>Remove leave</Button>}
          </div>)}
        </section>}
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (canManage && employee.sourceApplicationId !== null) addLeave.mutate({ staffId: employee.sourceApplicationId, staffName: employee.name, ...form });
        }}>
          <label className="block space-y-1.5 text-sm font-semibold text-[#3D1A2E]">Leave type
            <select className="w-full rounded-md border border-[#EADBE2] bg-white px-3 py-2" value={form.leaveType} onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value as LeaveType }))}>
              {Object.entries(LEAVE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-semibold text-[#3D1A2E]">Start date<Input type="date" required value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
            <label className="space-y-1.5 text-sm font-semibold text-[#3D1A2E]">End date<Input type="date" required min={form.startDate} value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold text-[#3D1A2E]">Notes (optional)<textarea rows={2} className="w-full rounded-md border border-[#EADBE2] bg-white px-3 py-2" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="submit" disabled={!canManage || form.endDate < form.startDate || addLeave.isPending} className="bg-[#8B2252] text-white hover:bg-[#6B1A3E]">{addLeave.isPending ? "Saving…" : "Save leave"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
