/* ============================================================
   Invoice Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   ============================================================ */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, AlertTriangle, Clock, CheckCircle2, RefreshCw, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { getLoginUrl } from "@/const";
import AdminNav from "@/components/AdminNav";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

function DaysLeftBadge({ daysLeft, urgency, status }: {
  daysLeft: number | null;
  urgency: string;
  status: string;
}) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Paid
      </span>
    );
  }
  if (daysLeft === null) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-body font-semibold bg-[#F5F0EB] text-[#6B4C3B]">No due date</span>;
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

export default function InvoiceDashboard() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const { data: invoices, isLoading, refetch } = trpc.invoices.list.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => utils.invoices.list.invalidate(),
  });

  const deleteInvoice = trpc.invoices.delete.useMutation({
    onSuccess: () => utils.invoices.list.invalidate(),
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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
        <p className="font-body text-[#6B4C3B] mb-6">Please log in to view invoices.</p>
        <button
          onClick={() => window.location.href = getLoginUrl()}
          className="inline-flex items-center px-6 py-3 font-body font-semibold text-sm rounded-full text-white transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #e91e8c, #c2410c)" }}
        >
          Log In
        </button>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Access Denied</h2>
        <p className="font-body text-[#6B4C3B]">This page is for admins only.</p>
      </div>
    );
  }

  const pendingCount = invoices?.filter((i) => i.status === "pending").length ?? 0;
  const overdueCount = invoices?.filter((i) => i.urgency === "overdue" && i.status !== "paid").length ?? 0;
  const totalOwed = invoices
    ?.filter((i) => i.status === "pending")
    .reduce((sum, i) => {
      if (!i.payAmount) return sum;
      const num = parseFloat(i.payAmount.replace(/[^0-9.]/g, ""));
      return isNaN(num) ? sum : sum + num;
    }, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      {/* Header */}
      <AdminNav />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Page title */}
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-[#8B2252]" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252]">Admin</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1A0A12]">Staff Invoices</h1>
          <p className="font-body text-sm text-[#6B4C3B] mt-1">Manage and track staff payment requests</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-[#F0D0DC]">
            <p className="font-body text-sm text-[#6B4C3B] mb-2">Pending Invoices</p>
            <p className="font-display font-bold text-4xl text-[#1A0A12]">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-red-200">
            <p className="font-body text-sm text-red-500 mb-2">Overdue</p>
            <p className="font-display font-bold text-4xl text-red-600">{overdueCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-[#F0D0DC]">
            <p className="font-body text-sm text-[#6B4C3B] mb-2">Total Owed</p>
            <p className="font-display font-bold text-4xl text-[#8B2252]">
              ${totalOwed.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Invoices table */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF0F4] flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-[#8B2252]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#1A0A12] mb-2">No invoices yet</h3>
              <p className="font-body text-[#6B4C3B] text-sm mb-4">
                Share the invoice submission link with your staff
              </p>
              <div className="px-5 py-3 bg-[#FFF5F8] rounded-xl border border-[#F0D0DC]">
                <p className="font-body text-xs text-[#6B4C3B] font-mono">
                  {window.location.origin}/submit-invoice
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FFF5F8] border-b border-[#F0D0DC]">
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Staff Member</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Position</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Amount</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Due Date</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Days Left</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Invoice</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Status</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, idx) => (
                    <tr
                      key={invoice.id}
                      className={`border-b border-[#F0D0DC] last:border-0 transition-colors hover:bg-[#FFF5F8] ${idx % 2 === 0 ? "" : "bg-[#FEFAF4]"}`}
                    >
                      <td className="px-5 py-4">
                        {invoice.extractionStatus === "pending" ? (
                          <span className="flex items-center gap-1.5 font-body text-sm text-[#6B4C3B]">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Processing...
                          </span>
                        ) : invoice.extractionStatus === "failed" ? (
                          <span className="font-body text-sm text-red-500">Extraction failed</span>
                        ) : (
                          <span className="font-body font-semibold text-sm text-[#1A0A12]">
                            {invoice.staffName ?? <span className="italic text-[#6B4C3B]">Not found</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-[#6B4C3B]">
                        {invoice.position ?? <span className="italic">—</span>}
                      </td>
                      <td className="px-5 py-4 font-body font-bold text-sm text-[#1A0A12]">
                        {invoice.payAmount ?? <span className="italic text-[#6B4C3B]">—</span>}
                      </td>
                      <td className="px-5 py-4 font-body text-sm text-[#6B4C3B]">
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString("en-CA", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : <span className="italic">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <DaysLeftBadge
                          daysLeft={invoice.daysLeft}
                          urgency={invoice.urgency}
                          status={invoice.status}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <a
                          href={invoice.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-body font-semibold text-sm text-[#8B2252] hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          View PDF
                        </a>
                      </td>
                      <td className="px-5 py-4">
                        <Select
                          value={invoice.status}
                          onValueChange={(value) =>
                            updateStatus.mutate({
                              id: invoice.id,
                              status: value as "pending" | "paid" | "overdue",
                            })
                          }
                        >
                          <SelectTrigger className="w-28 h-8 text-xs font-body border-[#F0D0DC] rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-4">
                        {confirmDeleteId === invoice.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                deleteInvoice.mutate({ id: invoice.id });
                                setConfirmDeleteId(null);
                              }}
                              className="px-3 py-1 text-xs font-body font-semibold rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1 text-xs font-body font-semibold rounded-full bg-[#F5F0EB] text-[#6B4C3B] hover:bg-[#F0D0DC] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(invoice.id)}
                            className="p-1.5 rounded-lg text-[#6B4C3B] hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Staff submission link */}
        {invoices && invoices.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6">
            <p className="font-body font-semibold text-sm text-[#1A0A12] mb-1">Staff Invoice Submission Link</p>
            <p className="font-body text-xs text-[#6B4C3B] mb-3">Share this link with your staff to submit invoices:</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 font-body text-xs bg-[#FFF5F8] border border-[#F0D0DC] rounded-xl px-4 py-3 text-[#1A0A12]">
                {window.location.origin}/submit-invoice
              </code>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-3 font-body font-semibold text-xs rounded-xl border border-[#F0D0DC] text-[#6B4C3B] bg-white hover:bg-[#FFF0F4] transition-colors"
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
