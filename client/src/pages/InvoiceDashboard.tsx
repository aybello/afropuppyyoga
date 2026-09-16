/* ============================================================
   Invoice Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   Tabs: All | Remaining (partial/pending) | Paid
   ============================================================ */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FileText, Loader2, AlertTriangle, Clock, CheckCircle2,
  Copy, Trash2, DollarSign, X, Wallet, PencilLine,
} from "lucide-react";
import { useState } from "react";
import { getLoginUrl, LOGO_URL } from "@/const";
import AdminNav from "@/components/AdminNav";


// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a pay amount string like "$250.00" or "CAD 300" into a number */
function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const num = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
}

/** Format cents to a dollar string */
function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, daysLeft, urgency }: {
  status: string;
  daysLeft: number | null;
  urgency: string;
}) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Paid
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-blue-100 text-blue-700">
        <Wallet className="w-3 h-3" /> Partial
      </span>
    );
  }
  if (daysLeft === null) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-body font-semibold bg-[#FFF5F8] text-[#1A0A12]">No due date</span>;
  }
  if (urgency === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3" />
        {Math.abs(daysLeft)}d overdue
      </span>
    );
  }
  if (urgency === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-orange-100 text-orange-700">
        <Clock className="w-3 h-3" />
        {daysLeft}d left
      </span>
    );
  }
  if (urgency === "soon") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-yellow-100 text-yellow-700">
        <Clock className="w-3 h-3" />
        {daysLeft}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-emerald-100 text-emerald-700">
      <CheckCircle2 className="w-3 h-3" />
      {daysLeft}d left
    </span>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

type InvoiceRow = {
  id: number;
  staffName: string | null;
  payAmount: string | null;
  amountPaidCents: number;
  paymentNotes: string | null;
};

function SetInvoiceTotalModal({
  invoice,
  onClose,
  onSave,
  isSaving,
}: {
  invoice: Pick<InvoiceRow, "id" | "staffName" | "payAmount">;
  onClose: () => void;
  onSave: (totalAmountCents: number) => void;
  isSaving: boolean;
}) {
  const [amountStr, setAmountStr] = useState(() => {
    const amount = parseAmount(invoice.payAmount);
    return amount > 0 ? amount.toFixed(2) : "";
  });
  const amountCents = Math.round(Number.parseFloat(amountStr || "0") * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#F0D0DC] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F0D0DC] px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#1A0A12]">Confirm Invoice Total</h2>
            <p className="mt-0.5 font-body text-xs text-[#1A0A12]">{invoice.staffName ?? "Staff invoice"}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#1A0A12] transition-colors hover:bg-[#FFF5F8]" aria-label="Close invoice total dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="mb-4 font-body text-sm leading-relaxed text-[#1A0A12]">
            The uploaded PDF did not provide a usable total. Enter the invoice total before you review and approve it.
          </p>
          <label className="mb-1.5 block font-body text-xs font-semibold text-[#1A0A12]" htmlFor={`invoice-total-${invoice.id}`}>
            Invoice Total (CAD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-[#1A0A12]">$</span>
            <input
              id={`invoice-total-${invoice.id}`}
              type="number"
              min="0.01"
              step="0.01"
              value={amountStr}
              onChange={(event) => setAmountStr(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-[#F0D0DC] bg-[#FEFAF4] py-2.5 pl-7 pr-4 font-body text-sm text-[#1A0A12] focus:outline-none focus:ring-2 focus:ring-[#8B2252]/30"
            />
          </div>
        </div>
        <div className="flex gap-3 border-t border-[#F0D0DC] px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-full border border-[#F0D0DC] bg-white px-4 py-2.5 font-body text-sm font-semibold text-[#1A0A12] transition-colors hover:bg-[#FFF5F8]">
            Cancel
          </button>
          <button
            onClick={() => onSave(amountCents)}
            disabled={isSaving || !Number.isFinite(amountCents) || amountCents <= 0}
            className="flex-1 rounded-full px-4 py-2.5 font-body text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8B2252, #c2410c)" }}
          >
            {isSaving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save Total"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({
  invoice,
  onClose,
  onSave,
  isSaving,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
  onSave: (amountPaidCents: number, notes: string) => void;
  isSaving: boolean;
}) {
  const totalAmount = parseAmount(invoice.payAmount);
  const totalCents = Math.round(totalAmount * 100);
  const alreadyPaidCents = invoice.amountPaidCents ?? 0;
  const remainingCents = Math.max(0, totalCents - alreadyPaidCents);

  const [amountStr, setAmountStr] = useState(
    alreadyPaidCents > 0 ? (alreadyPaidCents / 100).toFixed(2) : ""
  );
  const [notes, setNotes] = useState(invoice.paymentNotes ?? "");

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const newRemaining = Math.max(0, totalCents - amountCents);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#F0D0DC]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0D0DC]">
          <div>
            <h2 className="font-display font-bold text-lg text-[#1A0A12]">Record Payment</h2>
            <p className="font-body text-xs text-[#1A0A12] mt-0.5">
              {invoice.staffName ?? "Unknown staff"} · Invoice total: {invoice.payAmount ?? "—"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#1A0A12] hover:bg-[#FFF5F8] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Progress bar */}
          {totalCents > 0 && (
            <div>
              <div className="flex justify-between text-xs font-body text-[#1A0A12] mb-1">
                <span>Paid so far</span>
                <span>{centsToDisplay(alreadyPaidCents)} / {invoice.payAmount}</span>
              </div>
              <div className="h-2 bg-[#FFF5F8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8B2252] rounded-full transition-all"
                  style={{ width: `${Math.min(100, (alreadyPaidCents / totalCents) * 100)}%` }}
                />
              </div>
              <p className="text-xs font-body text-[#1A0A12] mt-1">
                Remaining: <span className="font-semibold text-[#1A0A12]">{centsToDisplay(remainingCents)}</span>
              </p>
            </div>
          )}

          {/* Amount paid input */}
          <div>
            <label className="block font-body text-xs font-semibold text-[#1A0A12] mb-1.5">
              Total Amount Paid So Far (CAD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-[#1A0A12]">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-2.5 border border-[#F0D0DC] rounded-xl font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:ring-2 focus:ring-[#8B2252]/30"
              />
            </div>
            {totalCents > 0 && amountCents > 0 && (
              <p className="text-xs font-body text-[#1A0A12] mt-1">
                New remaining: <span className={`font-semibold ${newRemaining === 0 ? "text-emerald-600" : "text-[#8B2252]"}`}>
                  {centsToDisplay(newRemaining)}
                </span>
                {newRemaining === 0 && " · Will be marked as Paid ✓"}
              </p>
            )}
          </div>

          {/* Quick fill buttons */}
          {totalCents > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => setAmountStr((totalCents / 2 / 100).toFixed(2))}
                className="flex-1 px-3 py-2 text-xs font-body font-semibold rounded-xl border border-[#F0D0DC] text-[#1A0A12] bg-white hover:bg-[#FFF5F8] transition-colors"
              >
                Half ({centsToDisplay(Math.round(totalCents / 2))})
              </button>
              <button
                onClick={() => setAmountStr((totalCents / 100).toFixed(2))}
                className="flex-1 px-3 py-2 text-xs font-body font-semibold rounded-xl border border-[#F0D0DC] text-[#1A0A12] bg-white hover:bg-[#FFF5F8] transition-colors"
              >
                Full ({invoice.payAmount})
              </button>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block font-body text-xs font-semibold text-[#1A0A12] mb-1.5">
              Payment Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Half payment on May 1, rest on May 15"
              rows={2}
              className="w-full px-4 py-2.5 border border-[#F0D0DC] rounded-xl font-body text-sm text-[#1A0A12] bg-[#FEFAF4] focus:outline-none focus:ring-2 focus:ring-[#8B2252]/30 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#F0D0DC]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 font-body font-semibold text-sm rounded-full border border-[#F0D0DC] text-[#1A0A12] bg-white hover:bg-[#FFF5F8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(amountCents, notes)}
            disabled={isSaving || amountCents < 0 || (totalCents > 0 && amountCents > totalCents)}
            className="flex-1 px-4 py-2.5 font-body font-semibold text-sm rounded-full text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8B2252, #c2410c)" }}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : totalCents > 0 && amountCents === totalCents ? "Mark Fully Paid" : "Save Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type TabId = "all" | "remaining" | "paid";

export default function InvoiceDashboard() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const { data: invoices, isLoading } = trpc.invoices.list.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const reviewInvoice = trpc.invoices.review.useMutation({
    onSuccess: () => utils.invoices.list.invalidate(),
  });
  const approveInvoice = trpc.invoices.approve.useMutation({ onSuccess: () => utils.invoices.list.invalidate() });

  const recordPayment = trpc.invoices.recordPayment.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate();
      setPaymentModal(null);
      setActionError(null);
    },
  });
  const setTotal = trpc.invoices.setTotal.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate();
      setTotalModal(null);
      setActionError(null);
    },
    onError: (error) => setActionError(error.message),
  });

  const archiveInvoice = trpc.invoices.archive.useMutation({
    onSuccess: () => utils.invoices.list.invalidate(),
  });

  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [paymentModal, setPaymentModal] = useState<InvoiceRow | null>(null);
  const [totalModal, setTotalModal] = useState<Pick<InvoiceRow, "id" | "staffName" | "payAmount"> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Admin Access Required</h2>
        <p className="font-body text-[#1A0A12] mb-6">Please log in to view invoices.</p>
        <button
          onClick={() => window.location.href = getLoginUrl()}
          className="inline-flex items-center px-6 py-3 font-body font-semibold text-sm rounded-full text-white transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #8B2252, #c2410c)" }}
        >
          Log In
        </button>
      </div>
    );
  }

  if (user.role !== "admin" && user.role !== "staff") {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Access Denied</h2>
        <p className="font-body text-[#1A0A12]">This page is for admins only.</p>
      </div>
    );
  }

  // ── Tab filtering ────────────────────────────────────────────────────────────
  const filteredInvoices = invoices?.filter((i) => {
    if (activeTab === "remaining") return i.status === "pending" || i.status === "partial";
    if (activeTab === "paid") return i.status === "paid";
    return true; // "all"
  }) ?? [];

  // ── Derived stats — always based on filteredInvoices so they update with the active tab ──
  const pendingCount = filteredInvoices.filter((i) => i.status === "pending").length;
  const partialCount = filteredInvoices.filter((i) => i.status === "partial").length;
  const overdueCount = filteredInvoices.filter((i) => i.urgency === "overdue" && i.status !== "paid").length;

  // (outstanding is now computed as totalOutstandingFixed below, after totalPaid)

  // Total paid = for paid invoices, use amountPaidCents if recorded via payment modal,
  // otherwise fall back to the full payAmount (invoice was marked paid via status dropdown)
  const totalPaid = filteredInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => {
      const recorded = (i.amountPaidCents ?? 0) / 100;
      const invoiceTotal = parseAmount(i.payAmount);
      // If payment was recorded via modal use that; otherwise assume full amount was paid
      return sum + (recorded > 0 ? recorded : invoiceTotal);
    }, 0);

  // Total invoiced = gross sum of all invoice amounts in the current view (used on All tab)
  const totalInvoiced = filteredInvoices
    .reduce((sum, i) => sum + parseAmount(i.payAmount), 0);

  // Outstanding = sum of (invoiceTotal - amountPaid) for non-paid invoices in current view
  // Paid invoices are excluded entirely so they never inflate the outstanding figure
  const totalOutstandingFixed = filteredInvoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => {
      const total = parseAmount(i.payAmount);
      const paid = (i.amountPaidCents ?? 0) / 100;
      return sum + Math.max(0, total - paid);
    }, 0);

  // Tab counts always use the full invoice list so the pill numbers don’t change when you switch tabs
  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all", label: "All", count: invoices?.length ?? 0 },
    { id: "remaining", label: "Remaining", count: invoices?.filter((i) => i.status === "pending" || i.status === "partial").length ?? 0 },
    { id: "paid", label: "Paid", count: invoices?.filter((i) => i.status === "paid").length ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      {/* Payment modal */}
      {paymentModal && (
        <RecordPaymentModal
          invoice={paymentModal}
          onClose={() => setPaymentModal(null)}
          isSaving={recordPayment.isPending}
          onSave={(amountPaidCents, paymentNotes) => {
            setActionError(null);
            recordPayment.mutate(
              {
                id: paymentModal.id,
                amountPaidCents,
                paymentNotes: paymentNotes || undefined,
              },
              { onError: (error) => setActionError(error.message) },
            );
          }}
        />
      )}
      {totalModal && (
        <SetInvoiceTotalModal
          invoice={totalModal}
          onClose={() => setTotalModal(null)}
          isSaving={setTotal.isPending}
          onSave={(totalAmountCents) => setTotal.mutate({ id: totalModal.id, totalAmountCents })}
        />
      )}

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Page title */}
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-[#8B2252]" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252]">Admin</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1A0A12]">Staff Invoices</h1>
          <p className="font-body text-sm text-[#1A0A12] mt-1">Manage and track staff payment requests</p>
        </div>

        {actionError && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700" role="alert">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="shrink-0 rounded p-0.5 hover:bg-red-100" aria-label="Dismiss invoice action error">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#F0D0DC]">
            <p className="font-body text-xs text-[#1A0A12] mb-1">Pending</p>
            <p className="font-display font-bold text-3xl text-[#1A0A12]">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-blue-200">
            <p className="font-body text-xs text-blue-500 mb-1">Partial</p>
            <p className="font-display font-bold text-3xl text-blue-600">{partialCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-red-200">
            <p className="font-body text-xs text-red-500 mb-1">Overdue</p>
            <p className="font-display font-bold text-3xl text-red-600">{overdueCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#F0D0DC]">
            {activeTab === "all" ? (
              <>
                <p className="font-body text-xs text-[#1A0A12] mb-1">Total Invoiced</p>
                <p className="font-display font-bold text-3xl text-[#1A0A12]">
                  ${totalInvoiced.toFixed(2)}
                </p>
              </>
            ) : activeTab === "paid" ? (
              <>
                <p className="font-body text-xs text-emerald-600 mb-1">Total Paid</p>
                <p className="font-display font-bold text-3xl text-emerald-600">
                  ${totalPaid.toFixed(2)}
                </p>
              </>
            ) : (
              <>
                <p className="font-body text-xs text-[#1A0A12] mb-1">Outstanding</p>
                <p className="font-display font-bold text-3xl text-[#8B2252]">
                  ${totalOutstandingFixed.toFixed(2)}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white rounded-2xl border border-[#F0D0DC] p-1.5 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 font-body font-semibold text-sm rounded-xl transition-colors ${
                activeTab === tab.id
                  ? "bg-[#8B2252] text-white"
                  : "text-[#1A0A12] hover:bg-[#FFF5F8]"
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-[#FFF5F8] text-[#8B2252]"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Invoices table */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF5F8] flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-[#8B2252]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#1A0A12] mb-2">
                {activeTab === "remaining" ? "No outstanding invoices" :
                 activeTab === "paid" ? "No paid invoices yet" : "No invoices yet"}
              </h3>
              {activeTab === "all" && (
                <p className="font-body text-[#1A0A12] text-sm mb-4">
                  Share the invoice submission link with your staff
                </p>
              )}
              {activeTab === "all" && (
                <div className="px-5 py-3 bg-[#FFF5F8] rounded-xl border border-[#F0D0DC]">
                  <p className="font-body text-xs text-[#1A0A12] font-mono">
                    {window.location.origin}/submit-invoice
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FFF5F8] border-b border-[#F0D0DC]">
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Staff Member</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Position</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Invoice Total</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Paid / Remaining</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Due Date</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Status</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Invoice</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Update</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice, idx) => {
                    const totalAmount = parseAmount(invoice.payAmount);
                    const paidAmount = (invoice.amountPaidCents ?? 0) / 100;
                    const remaining = Math.max(0, totalAmount - paidAmount);
                    const hasPaid = paidAmount > 0;
                    const totalCents = Math.round(totalAmount * 100);
                    const paidPct = totalCents > 0 ? Math.min(100, Math.round((invoice.amountPaidCents ?? 0) / totalCents * 100)) : 0;

                    return (
                      <tr
                        key={invoice.id}
                        className={`border-b border-[#F0D0DC] last:border-0 transition-colors hover:bg-[#FFF5F8] ${idx % 2 === 0 ? "" : "bg-[#FEFAF4]"}`}
                      >
                        {/* Staff name */}
                        <td className="px-5 py-4">
                          {invoice.extractionStatus === "pending" ? (
                            <span className="flex items-center gap-1.5 font-body text-sm text-[#1A0A12]">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </span>
                          ) : invoice.extractionStatus === "failed" ? (
                            <span className="font-body text-sm text-red-500">Extraction failed</span>
                          ) : (
                            <span className="font-body font-semibold text-sm text-[#1A0A12]">
                              {invoice.staffName ?? <span className="italic text-[#1A0A12]">Not found</span>}
                            </span>
                          )}
                        </td>

                        {/* Position */}
                        <td className="px-5 py-4 font-body text-sm text-[#1A0A12]">
                          {invoice.position ?? <span className="italic">—</span>}
                        </td>

                        {/* Invoice total */}
                        <td className="px-5 py-4 font-body font-bold text-sm text-[#1A0A12]">
                          {invoice.payAmount ?? <span className="italic text-[#1A0A12]">—</span>}
                        </td>

                        {/* Paid / Remaining */}
                        <td className="px-5 py-4 min-w-[140px]">
                          {invoice.status === "paid" ? (
                            <span className="font-body text-xs text-emerald-600 font-semibold">Fully paid</span>
                          ) : hasPaid ? (
                            <div>
                              <div className="flex justify-between text-xs font-body text-[#1A0A12] mb-1">
                                <span className="text-emerald-600 font-semibold">${paidAmount.toFixed(2)} paid</span>
                                <span className="text-[#8B2252] font-semibold">${remaining.toFixed(2)} left</span>
                              </div>
                              <div className="h-1.5 bg-[#FFF5F8] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${paidPct}%` }}
                                />
                              </div>
                              {invoice.paymentNotes && (
                                <p className="text-[10px] text-[#1A0A12] mt-0.5 italic truncate max-w-[130px]" title={invoice.paymentNotes}>
                                  {invoice.paymentNotes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="font-body text-xs text-[#1A0A12] italic">No payments yet</span>
                          )}
                        </td>

                        {/* Due date */}
                        <td className="px-5 py-4 font-body text-sm text-[#1A0A12]">
                          {invoice.dueDate
                            ? new Date(invoice.dueDate).toLocaleDateString("en-CA", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : <span className="italic">—</span>}
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-4">
                          <StatusBadge
                            status={invoice.status}
                            daysLeft={invoice.daysLeft}
                            urgency={invoice.urgency}
                          />
                        </td>

                        {/* View PDF */}
                        <td className="px-5 py-4">
                          <a
                            href={invoice.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-body font-semibold text-sm text-[#8B2252] hover:underline"
                          >
                            <FileText className="w-4 h-4" />
                            View
                          </a>
                        </td>

                        {/* Approval workflow */}
                        <td className="px-5 py-4">
                          {(invoice.totalAmountCents ?? 0) <= 0 && invoice.workflowStatus !== "paid" && invoice.status !== "paid" && (invoice.amountPaidCents ?? 0) === 0 ? (
                            <button
                              onClick={() => {
                                setActionError(null);
                                setTotalModal({ id: invoice.id, staffName: invoice.staffName, payAmount: invoice.payAmount });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800 transition-colors hover:bg-violet-200"
                            >
                              <PencilLine className="h-3 w-3" /> Set total
                            </button>
                          ) : invoice.workflowStatus === "submitted" ? (
                            <button onClick={() => { setActionError(null); reviewInvoice.mutate({ id: invoice.id }, { onError: (error) => setActionError(error.message) }); }} className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-200">Review</button>
                          ) : invoice.workflowStatus === "reviewed" ? (
                            <button onClick={() => { setActionError(null); approveInvoice.mutate({ id: invoice.id }, { onError: (error) => setActionError(error.message) }); }} className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200">Approve</button>
                          ) : (
                            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${invoice.workflowStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}>{invoice.workflowStatus === "paid" ? "Paid" : "Approved"}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            {/* Record payment button */}
                            <button
                              onClick={() => setPaymentModal({
                                id: invoice.id,
                                staffName: invoice.staffName,
                                payAmount: invoice.payAmount,
                                amountPaidCents: invoice.amountPaidCents ?? 0,
                                paymentNotes: invoice.paymentNotes,
                              })}
                              disabled={invoice.workflowStatus !== "approved" && invoice.workflowStatus !== "paid"}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-xs font-semibold text-[#8B2252] transition-colors hover:bg-[#FFF5F8] disabled:cursor-not-allowed disabled:opacity-40"
                              title="Record payment or mark the full invoice paid"
                            >
                              <DollarSign className="w-4 h-4" />
                              Record payment
                            </button>

                            {/* Delete */}
                            {confirmDeleteId === invoice.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    archiveInvoice.mutate({ id: invoice.id });
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 text-xs font-body font-semibold rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 text-xs font-body font-semibold rounded-full bg-[#FFF5F8] text-[#1A0A12] hover:bg-[#F0D0DC] transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(invoice.id)}
                                className="p-1.5 rounded-lg text-[#1A0A12] hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Archive invoice"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </div>

        {/* Staff submission link */}
        {invoices && invoices.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6">
            <p className="font-body font-semibold text-sm text-[#1A0A12] mb-1">Staff Invoice Submission Link</p>
            <p className="font-body text-xs text-[#1A0A12] mb-3">Share this link with your staff to submit invoices:</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 font-body text-xs bg-[#FFF5F8] border border-[#F0D0DC] rounded-xl px-4 py-3 text-[#1A0A12]">
                {window.location.origin}/submit-invoice
              </code>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-3 font-body font-semibold text-xs rounded-xl border border-[#F0D0DC] text-[#1A0A12] bg-white hover:bg-[#FFF5F8] transition-colors"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/submit-invoice`)}
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
