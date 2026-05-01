import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, AlertTriangle, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { getLoginUrl } from "@/const";

function DaysLeftBadge({ daysLeft, urgency, status }: {
  daysLeft: number | null;
  urgency: string;
  status: string;
}) {
  if (status === "paid") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Paid
      </Badge>
    );
  }

  if (daysLeft === null) {
    return <Badge variant="outline" className="text-gray-500">No due date</Badge>;
  }

  if (urgency === "overdue") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
        <AlertTriangle className="w-3 h-3" />
        {Math.abs(daysLeft)}d overdue
      </Badge>
    );
  }

  if (urgency === "urgent") {
    return (
      <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1">
        <Clock className="w-3 h-3" />
        {daysLeft}d left
      </Badge>
    );
  }

  if (urgency === "soon") {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1">
        <Clock className="w-3 h-3" />
        {daysLeft}d left
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
      <CheckCircle2 className="w-3 h-3" />
      {daysLeft}d left
    </Badge>
  );
}

export default function InvoiceDashboard() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const { data: invoices, isLoading, refetch } = trpc.invoices.list.useQuery(undefined, {
    refetchInterval: 10000, // poll every 10s to pick up AI extraction results
  });

  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => utils.invoices.list.invalidate(),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#2C1810] mb-2">Admin Access Required</h2>
          <p className="text-[#6B4C3B] mb-4">Please log in to view invoices.</p>
          <Button
            onClick={() => window.location.href = getLoginUrl("/admin/invoices")}
            className="bg-[#C4622D] hover:bg-[#A8522A] text-white"
          >
            Log In
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#2C1810] mb-2">Access Denied</h2>
          <p className="text-[#6B4C3B]">This page is for admins only.</p>
        </div>
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
      <div className="bg-white border-b border-[#E8D5C4] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1810]">Staff Invoices</h1>
            <p className="text-sm text-[#6B4C3B]">Manage and track staff payment requests</p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2 border-[#D4A574] text-[#6B4C3B]"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-[#E8D5C4]">
            <p className="text-sm text-[#6B4C3B] mb-1">Pending Invoices</p>
            <p className="text-3xl font-bold text-[#2C1810]">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-red-200">
            <p className="text-sm text-red-600 mb-1">Overdue</p>
            <p className="text-3xl font-bold text-red-600">{overdueCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-[#E8D5C4]">
            <p className="text-sm text-[#6B4C3B] mb-1">Total Owed</p>
            <p className="text-3xl font-bold text-[#C4622D]">
              ${totalOwed.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Invoices table */}
        <div className="bg-white rounded-xl border border-[#E8D5C4] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-12 h-12 text-[#D4A574] mb-3" />
              <h3 className="text-lg font-semibold text-[#2C1810]">No invoices yet</h3>
              <p className="text-[#6B4C3B] text-sm mt-1">
                Share the invoice submission link with your staff
              </p>
              <div className="mt-4 px-4 py-2 bg-[#FFF5EE] rounded-lg border border-[#E8D5C4]">
                <p className="text-xs text-[#6B4C3B] font-mono">
                  {window.location.origin}/submit-invoice
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FFF5EE]">
                  <TableHead className="text-[#6B4C3B] font-semibold">Staff Member</TableHead>
                  <TableHead className="text-[#6B4C3B] font-semibold">Position</TableHead>
                  <TableHead className="text-[#6B4C3B] font-semibold">Amount</TableHead>
                  <TableHead className="text-[#6B4C3B] font-semibold">Due Date</TableHead>
                  <TableHead className="text-[#6B4C3B] font-semibold">Days Left</TableHead>
                  <TableHead className="text-[#6B4C3B] font-semibold">Invoice</TableHead>
                  <TableHead className="text-[#6B4C3B] font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-[#FEFAF4]">
                    <TableCell className="font-medium text-[#2C1810]">
                      {invoice.extractionStatus === "pending" ? (
                        <span className="flex items-center gap-1 text-[#6B4C3B]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing...
                        </span>
                      ) : invoice.extractionStatus === "failed" ? (
                        <span className="text-red-500 text-sm">Extraction failed</span>
                      ) : (
                        invoice.staffName ?? (
                          <span className="text-[#6B4C3B] italic text-sm">Not found</span>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-[#6B4C3B]">
                      {invoice.position ?? (
                        <span className="italic text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-[#2C1810]">
                      {invoice.payAmount ?? (
                        <span className="text-[#6B4C3B] italic text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[#6B4C3B]">
                      {invoice.dueDate
                        ? new Date(invoice.dueDate).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : <span className="italic text-sm">—</span>}
                    </TableCell>
                    <TableCell>
                      <DaysLeftBadge
                        daysLeft={invoice.daysLeft}
                        urgency={invoice.urgency}
                        status={invoice.status}
                      />
                    </TableCell>
                    <TableCell>
                      <a
                        href={invoice.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[#C4622D] hover:underline text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        View PDF
                      </a>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={invoice.status}
                        onValueChange={(value) =>
                          updateStatus.mutate({
                            id: invoice.id,
                            status: value as "pending" | "paid" | "overdue",
                          })
                        }
                      >
                        <SelectTrigger className="w-28 h-8 text-sm border-[#D4A574]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Staff link */}
        {invoices && invoices.length > 0 && (
          <div className="bg-[#FFF5EE] rounded-xl border border-[#E8D5C4] p-4">
            <p className="text-sm font-medium text-[#2C1810] mb-1">Staff Invoice Submission Link</p>
            <p className="text-xs text-[#6B4C3B]">Share this link with your staff to submit invoices:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-[#D4A574] rounded px-3 py-2 text-[#2C1810]">
                {window.location.origin}/submit-invoice
              </code>
              <Button
                size="sm"
                variant="outline"
                className="border-[#D4A574] text-[#6B4C3B]"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/submit-invoice`)}
              >
                Copy
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
