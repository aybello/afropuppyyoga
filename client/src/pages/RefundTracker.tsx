/* ============================================================
   RefundTracker — Admin page for tracking customer refunds
   Features: stats summary, filterable table, add/edit/delete modal
   Design: consistent with APY admin palette (warm pink/cream)
   ============================================================ */
import { useState, useMemo } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const LOCATIONS = ["Hamilton", "Kitchener", "Oakville", "Other"] as const;
const REASONS = [
  "Customer request",
  "Event cancelled",
  "Event rescheduled",
  "Duplicate charge",
  "No show",
  "Medical / emergency",
  "Other",
] as const;
const METHODS = ["Stripe", "E-Transfer", "Cash", "Credit", "Other"] as const;
const STATUSES = ["Pending", "Processed", "Denied"] as const;

type Location = (typeof LOCATIONS)[number];
type Reason = (typeof REASONS)[number];
type Method = (typeof METHODS)[number];
type Status = (typeof STATUSES)[number];

interface RefundFormData {
  customerName: string;
  customerEmail: string;
  orderRef: string;
  eventName: string;
  location: Location;
  amountDollars: string; // user types dollars, we convert to cents
  reason: Reason;
  notes: string;
  method: Method;
  status: Status;
  requestedAt: string; // date string YYYY-MM-DD
  processedBy: string;
}

const EMPTY_FORM: RefundFormData = {
  customerName: "",
  customerEmail: "",
  orderRef: "",
  eventName: "",
  location: "Other",
  amountDollars: "",
  reason: "Customer request",
  notes: "",
  method: "Stripe",
  status: "Pending",
  requestedAt: new Date().toISOString().split("T")[0],
  processedBy: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status: Status) {
  const styles: Record<Status, string> = {
    Pending: "bg-amber-100 text-amber-800 border border-amber-200",
    Processed: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Denied: "bg-red-100 text-red-800 border border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RefundTracker() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<Status | "All">("All");
  const [filterLocation, setFilterLocation] = useState<Location | "All">("All");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RefundFormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // tRPC
  const utils = trpc.useUtils();
  const { data: refundList = [], isLoading } = trpc.refunds.list.useQuery(undefined);
  const { data: stats } = trpc.refunds.stats.useQuery();

  const createMutation = trpc.refunds.create.useMutation({
    onSuccess: () => {
      utils.refunds.list.invalidate();
      utils.refunds.stats.invalidate();
      setModalOpen(false);
      toast.success("Refund record added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.refunds.update.useMutation({
    onSuccess: () => {
      utils.refunds.list.invalidate();
      utils.refunds.stats.invalidate();
      setModalOpen(false);
      toast.success("Refund updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.refunds.delete.useMutation({
    onSuccess: () => {
      utils.refunds.list.invalidate();
      utils.refunds.stats.invalidate();
      setDeleteId(null);
      toast.success("Refund deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.refunds.updateStatus.useMutation({
    onSuccess: () => {
      utils.refunds.list.invalidate();
      utils.refunds.stats.invalidate();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Auth guard
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#8B2252] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    navigate("/staff-login");
    return null;
  }

  // Filtered list
  const filtered = useMemo(() => {
    return refundList.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.customerName.toLowerCase().includes(q) ||
        (r.customerEmail ?? "").toLowerCase().includes(q) ||
        (r.orderRef ?? "").toLowerCase().includes(q) ||
        (r.eventName ?? "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "All" || r.status === filterStatus;
      const matchLocation = filterLocation === "All" || r.location === filterLocation;
      return matchSearch && matchStatus && matchLocation;
    });
  }, [refundList, search, filterStatus, filterLocation]);

  // Open add modal
  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  // Open edit modal
  function openEdit(r: (typeof refundList)[0]) {
    setEditingId(r.id);
    setForm({
      customerName: r.customerName,
      customerEmail: r.customerEmail ?? "",
      orderRef: r.orderRef ?? "",
      eventName: r.eventName ?? "",
      location: r.location as Location,
      amountDollars: (r.amountCents / 100).toFixed(2),
      reason: r.reason as Reason,
      notes: r.notes ?? "",
      method: r.method as Method,
      status: r.status as Status,
      requestedAt: new Date(r.requestedAt).toISOString().split("T")[0],
      processedBy: r.processedBy ?? "",
    });
    setModalOpen(true);
  }

  // Submit form
  function handleSubmit() {
    const amountCents = Math.round(parseFloat(form.amountDollars) * 100);
    if (!form.customerName.trim()) return toast.error("Customer name is required");
    if (isNaN(amountCents) || amountCents < 1) return toast.error("Enter a valid amount");

    const payload = {
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim(),
      orderRef: form.orderRef.trim(),
      eventName: form.eventName.trim(),
      location: form.location,
      amountCents,
      reason: form.reason,
      notes: form.notes.trim(),
      method: form.method,
      status: form.status,
      requestedAt: new Date(form.requestedAt).getTime(),
      processedAt: form.status === "Processed" ? Date.now() : null,
      processedBy: form.processedBy.trim(),
    };

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-[#1A0A12]">Refund Tracker</h1>
            <p className="font-body text-sm text-[#8B2252] mt-0.5">
              Track and manage all customer refund requests
            </p>
          </div>
          <Button
            onClick={openAdd}
            className="bg-[#C2185B] hover:bg-[#8B2252] text-white font-body font-semibold gap-2"
          >
            <Plus size={16} />
            Log Refund
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<DollarSign size={20} className="text-[#C2185B]" />}
            label="Total Refunds"
            value={stats ? centsToDisplay(stats.totalAmountCents) : "—"}
            sub={`${stats?.total ?? 0} records`}
            bg="bg-[#FFF5F8]"
            border="border-[#F0D0DC]"
          />
          <StatCard
            icon={<Clock size={20} className="text-amber-600" />}
            label="Pending"
            value={stats ? centsToDisplay(stats.pendingAmountCents) : "—"}
            sub={`${stats?.pending ?? 0} requests`}
            bg="bg-amber-50"
            border="border-amber-200"
          />
          <StatCard
            icon={<CheckCircle2 size={20} className="text-emerald-600" />}
            label="Processed"
            value={stats ? centsToDisplay(stats.processedAmountCents) : "—"}
            sub={`${stats?.processed ?? 0} refunds`}
            bg="bg-emerald-50"
            border="border-emerald-200"
          />
          <StatCard
            icon={<XCircle size={20} className="text-red-500" />}
            label="Denied"
            value={`${stats?.denied ?? 0}`}
            sub="requests denied"
            bg="bg-red-50"
            border="border-red-200"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4A0B0]" />
            <Input
              placeholder="Search by name, email, order ref…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 font-body text-sm border-[#F0D0DC] bg-white"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-36 font-body text-sm border-[#F0D0DC] bg-white">
              <Filter size={13} className="mr-1 text-[#C4A0B0]" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterLocation} onValueChange={(v) => setFilterLocation(v as any)}>
            <SelectTrigger className="w-36 font-body text-sm border-[#F0D0DC] bg-white">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Locations</SelectItem>
              {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#F0D0DC] overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-[#C4A0B0] font-body text-sm">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading refunds…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#C4A0B0]">
              <DollarSign size={32} className="mb-3 opacity-40" />
              <p className="font-body text-sm">No refund records found</p>
              {refundList.length === 0 && (
                <Button onClick={openAdd} variant="outline" className="mt-4 border-[#F0D0DC] text-[#8B2252] font-body text-sm">
                  <Plus size={14} className="mr-1" /> Log your first refund
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="bg-[#FFF5F8] border-b border-[#F0D0DC]">
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Customer</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Event</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Location</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Amount</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Reason</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Method</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Requested</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Status</th>
                    <th className="text-left px-4 py-3 text-[#8B2252] font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#F9EEF3] hover:bg-[#FFF8FB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FFFBFD]"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1A0A12]">{r.customerName}</div>
                        {r.customerEmail && (
                          <div className="text-xs text-[#9B7080]">{r.customerEmail}</div>
                        )}
                        {r.orderRef && (
                          <div className="text-xs text-[#C4A0B0] font-mono">{r.orderRef}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#5A3040]">{r.eventName || <span className="text-[#C4A0B0]">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FFF0F4] text-[#8B2252] border border-[#F0D0DC]">
                          {r.location}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1A0A12]">
                        {centsToDisplay(r.amountCents)}
                      </td>
                      <td className="px-4 py-3 text-[#5A3040] max-w-[140px]">
                        <span className="truncate block">{r.reason}</span>
                      </td>
                      <td className="px-4 py-3 text-[#5A3040]">{r.method}</td>
                      <td className="px-4 py-3 text-[#9B7080] whitespace-nowrap">
                        {formatDate(r.requestedAt)}
                      </td>
                      <td className="px-4 py-3">{statusBadge(r.status as Status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Quick status toggle */}
                          {r.status === "Pending" && (
                            <>
                              <button
                                title="Mark as Processed"
                                onClick={() =>
                                  updateStatusMutation.mutate({ id: r.id, status: "Processed" })
                                }
                                className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                              <button
                                title="Mark as Denied"
                                onClick={() =>
                                  updateStatusMutation.mutate({ id: r.id, status: "Denied" })
                                }
                                className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                          <button
                            title="Edit"
                            onClick={() => openEdit(r)}
                            className="p-1.5 rounded-md text-[#8B2252] hover:bg-[#FFF0F4] transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => setDeleteId(r.id)}
                            className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="mt-3 font-body text-xs text-[#C4A0B0] text-right">
            Showing {filtered.length} of {refundList.length} records
          </p>
        )}
      </main>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#FEFAF4] border-[#F0D0DC]">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-[#1A0A12]">
              {editingId !== null ? "Edit Refund" : "Log New Refund"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer Name */}
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-[#5A3040]">Customer Name *</Label>
              <Input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Jane Smith"
                className="border-[#F0D0DC] bg-white font-body"
              />
            </div>

            {/* Email + Order Ref */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Customer Email</Label>
                <Input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  placeholder="jane@email.com"
                  className="border-[#F0D0DC] bg-white font-body"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Order / Booking Ref</Label>
                <Input
                  value={form.orderRef}
                  onChange={(e) => setForm({ ...form, orderRef: e.target.value })}
                  placeholder="pi_xxx or Luma ID"
                  className="border-[#F0D0DC] bg-white font-body"
                />
              </div>
            </div>

            {/* Event Name */}
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-[#5A3040]">Event / Class Name</Label>
              <Input
                value={form.eventName}
                onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                placeholder="e.g. Puppy Yoga Hamilton – June 21"
                className="border-[#F0D0DC] bg-white font-body"
              />
            </div>

            {/* Location + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Location</Label>
                <Select
                  value={form.location}
                  onValueChange={(v) => setForm({ ...form, location: v as Location })}
                >
                  <SelectTrigger className="border-[#F0D0DC] bg-white font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Amount ($) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amountDollars}
                  onChange={(e) => setForm({ ...form, amountDollars: e.target.value })}
                  placeholder="50.00"
                  className="border-[#F0D0DC] bg-white font-body"
                />
              </div>
            </div>

            {/* Reason + Method */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Reason</Label>
                <Select
                  value={form.reason}
                  onValueChange={(v) => setForm({ ...form, reason: v as Reason })}
                >
                  <SelectTrigger className="border-[#F0D0DC] bg-white font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Refund Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(v) => setForm({ ...form, method: v as Method })}
                >
                  <SelectTrigger className="border-[#F0D0DC] bg-white font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status + Requested Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Status })}
                >
                  <SelectTrigger className="border-[#F0D0DC] bg-white font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body font-semibold text-[#5A3040]">Date Requested</Label>
                <Input
                  type="date"
                  value={form.requestedAt}
                  onChange={(e) => setForm({ ...form, requestedAt: e.target.value })}
                  className="border-[#F0D0DC] bg-white font-body"
                />
              </div>
            </div>

            {/* Processed By */}
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-[#5A3040]">Processed By</Label>
              <Input
                value={form.processedBy}
                onChange={(e) => setForm({ ...form, processedBy: e.target.value })}
                placeholder="Staff name (optional)"
                className="border-[#F0D0DC] bg-white font-body"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-[#5A3040]">Internal Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional context…"
                rows={3}
                className="border-[#F0D0DC] bg-white font-body resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="border-[#F0D0DC] text-[#8B2252] font-body"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-[#C2185B] hover:bg-[#8B2252] text-white font-body font-semibold"
            >
              {isSaving ? "Saving…" : editingId !== null ? "Save Changes" : "Add Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#FEFAF4] border-[#F0D0DC]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[#1A0A12]">Delete Refund?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-[#5A3040]">
              This will permanently remove the refund record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#F0D0DC] text-[#8B2252] font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              className="bg-red-500 hover:bg-red-600 text-white font-body"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  bg,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  bg: string;
  border: string;
}) {
  return (
    <div className={`${bg} border ${border} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-body text-xs font-semibold text-[#5A3040] uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-display font-bold text-xl text-[#1A0A12]">{value}</div>
      <div className="font-body text-xs text-[#9B7080] mt-0.5">{sub}</div>
    </div>
  );
}
