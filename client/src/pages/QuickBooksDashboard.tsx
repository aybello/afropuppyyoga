import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Landmark, RefreshCw, ShieldCheck, Download, BrainCircuit, AlertCircle, ArrowUpRight, ArrowDownRight, Clock3 } from "lucide-react";
import { toast } from "sonner";

function money(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format((cents ?? 0) / 100);
}

export default function QuickBooksDashboard() {
  const [location] = useLocation();
  const [question, setQuestion] = useState("What are the main expense patterns and anything I should review?");
  const [analysisConsent, setAnalysisConsent] = useState(false);
  const overview = trpc.quickbooks.overview.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const utils = trpc.useUtils();
  const connect = trpc.quickbooks.beginAuthorization.useMutation({
    onSuccess: ({}) => undefined,
  });
  const sync = trpc.quickbooks.syncNow.useMutation({
    onSuccess: result => {
      toast.success(`QuickBooks sync completed: ${result.importedCount} transaction records refreshed.`);
      utils.quickbooks.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const disconnect = trpc.quickbooks.disconnect.useMutation({
    onSuccess: result => {
      toast.success(result.schedulePaused ? "QuickBooks access was revoked and daily imports are paused." : "QuickBooks access was revoked. The scheduled job will stop safely because the connection is inactive.");
      utils.quickbooks.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const aiExport = trpc.quickbooks.exportForAi.useQuery(undefined, { enabled: false });
  const analyze = trpc.quickbooks.analyze.useMutation({ onError: error => toast.error(error.message) });

  const statusBanner = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    return params.get("quickbooks");
  }, [location]);

  async function handleConnect() {
    try {
      const url = await connect.mutateAsync();
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start QuickBooks connection");
    }
  }

  async function downloadAiSummary() {
    try {
      const data = await aiExport.refetch();
      if (!data.data) return;
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "apy-quickbooks-ai-summary.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("AI-ready finance summary downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create export");
    }
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#1F6B52] font-body text-xs font-bold uppercase tracking-[0.16em]">
              <Landmark size={15} /> Owner-only finance workspace
            </div>
            <h1 className="font-display text-3xl text-[#1A0A12] mt-2">QuickBooks Finance</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1 max-w-2xl">Read-only QuickBooks Online expenses and bank activity for management analysis. APY cannot create payments, edit transactions, or reconcile your books.</p>
          </div>
          {overview.data?.connection?.connected ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="bg-[#1F6B52] hover:bg-[#15503D] text-white rounded-full">
                <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
                {sync.isPending ? "Syncing…" : "Sync now"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className="rounded-full border-rose-300 text-rose-800 hover:bg-rose-50">Disconnect</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Disconnect QuickBooks Online?</AlertDialogTitle><AlertDialogDescription>This revokes APY’s QuickBooks access, stops future imports, and pauses the daily sync. Existing APY-imported records remain in APY HQ and any prior Google Sheet export remains in your Google account.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep connected</AlertDialogCancel><AlertDialogAction onClick={() => disconnect.mutate({ confirmDisconnect: true })} className="bg-rose-700 hover:bg-rose-800">{disconnect.isPending ? "Disconnecting…" : "Disconnect QuickBooks"}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </header>

        {statusBanner === "connected" && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><ShieldCheck className="h-4 w-4" /><AlertTitle>QuickBooks connected</AlertTitle><AlertDescription>Your read-only daily refresh is now set up. Use Sync now to import data immediately.</AlertDescription></Alert>}
        {statusBanner === "error" && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>QuickBooks connection was not completed</AlertTitle><AlertDescription>Please try connecting again. No QuickBooks data was changed.</AlertDescription></Alert>}

        {overview.isLoading && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white border border-[#F0D0DC] animate-pulse" />)}</div>}
        {overview.error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Finance workspace unavailable</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert>}

        {overview.data && !overview.data.connection && (
          <Card className="border-[#D5E8DD] bg-[#F3FBF6] rounded-2xl"><CardContent className="p-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between"><div><h2 className="font-display text-xl text-[#173F30]">Connect APY to QuickBooks Online</h2><p className="font-body text-sm text-[#416557] mt-1">You will approve access in QuickBooks. APY will import transaction facts daily and keep all actions read-only.</p></div><Button onClick={handleConnect} disabled={connect.isPending} className="bg-[#1F6B52] hover:bg-[#15503D] text-white rounded-full"><Landmark className="mr-2 h-4 w-4" />Connect</Button></CardContent></Card>
        )}

        {overview.data?.connection && overview.data.summary && (
          <>
            <div className="flex flex-wrap gap-2 text-xs font-body text-[#6B4C3B]">
              <span className="rounded-full bg-white border border-[#E5D4DB] px-3 py-1">{overview.data.connection.companyName ?? "QuickBooks Online"}</span>
              <span className="rounded-full bg-white border border-[#E5D4DB] px-3 py-1 inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Last sync: {overview.data.connection.lastSyncAt ? new Date(overview.data.connection.lastSyncAt).toLocaleString() : "Not yet synced"}</span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1">Daily refresh: {overview.data.connection.dailyRefreshEnabled ? "on" : "pending"}</span>
            </div>
            {overview.data.connection.lastSyncStatus === "failed" && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Last sync needs attention</AlertTitle><AlertDescription>{overview.data.connection.lastSyncError ?? "Please try Sync now."}</AlertDescription></Alert>}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Metric title="Expenses" value={money(overview.data.summary.expenseCents)} icon={<ArrowDownRight className="h-4 w-4 text-rose-700" />} note="Imported expense records" />
              <Metric title="Income" value={money(overview.data.summary.incomeCents)} icon={<ArrowUpRight className="h-4 w-4 text-emerald-700" />} note="Imported income records" />
              <Metric title="Net movement" value={money(overview.data.summary.netCashMovementCents)} icon={<Landmark className="h-4 w-4 text-[#1F6B52]" />} note="Income less expenses" />
              <Metric title="Transactions" value={String(overview.data.summary.transactionCount)} icon={<RefreshCw className="h-4 w-4 text-[#8B2252]" />} note="Read-only imported records" />
            </section>
            <section className="grid lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-[#F0D0DC] bg-white"><CardHeader><CardTitle className="font-display text-lg">Top expense categories</CardTitle></CardHeader><CardContent className="space-y-3">{overview.data.byCategory.map(row => <div key={row.name} className="flex items-center justify-between gap-4"><span className="font-body text-sm text-[#3D1A2E] truncate">{row.name}</span><strong className="font-body text-sm text-[#1A0A12]">{money(row.expenseCents)}</strong></div>)}{overview.data.byCategory.length === 0 && <p className="font-body text-sm text-[#9B7A69]">No imported expense categories yet. Run the first sync after connecting.</p>}</CardContent></Card>
              <Card className="rounded-2xl border-[#D5E8DD] bg-[#F8FCF9]"><CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-[#1F6B52]" />AI analysis and export</CardTitle></CardHeader><CardContent className="space-y-3"><p className="font-body text-sm text-[#416557]">Download a clean, aggregate-only summary for another AI, or ask APY’s private analysis assistant. No account numbers or individual transaction descriptions are included in the AI context.</p><Textarea value={question} onChange={event => setQuestion(event.target.value)} className="bg-white border-[#BFD9C9] min-h-24" maxLength={600} /><label className="flex gap-2 items-start font-body text-xs text-[#416557]"><input type="checkbox" checked={analysisConsent} onChange={event => setAnalysisConsent(event.target.checked)} className="mt-0.5" />I approve sending this aggregate finance summary to the configured AI service for this one analysis.</label><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadAiSummary} disabled={aiExport.isFetching} className="border-[#1F6B52] text-[#1F6B52]"><Download className="mr-2 h-4 w-4" />Download AI summary</Button><Button onClick={() => analyze.mutate({ question, confirmExternalAnalysis: true })} disabled={!analysisConsent || analyze.isPending} className="bg-[#1F6B52] hover:bg-[#15503D] text-white"><BrainCircuit className="mr-2 h-4 w-4" />{analyze.isPending ? "Analyzing…" : "Ask AI"}</Button></div>{analyze.data?.analysis && <div className="rounded-xl border border-[#D5E8DD] bg-white p-4 whitespace-pre-wrap font-body text-sm text-[#234738]">{analyze.data.analysis}</div>}</CardContent></Card>
            </section>
            <Card className="rounded-2xl border-[#F0D0DC] bg-white"><CardHeader><CardTitle className="font-display text-lg">Recent imported transaction records</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[720px] text-left font-body text-sm"><thead className="text-xs uppercase text-[#8B6876]"><tr><th className="pb-3">Date</th><th className="pb-3">Type</th><th className="pb-3">Category</th><th className="pb-3">Payee</th><th className="pb-3">Direction</th><th className="pb-3 text-right">Amount</th></tr></thead><tbody>{overview.data.recentTransactions.map(row => <tr key={row.id} className="border-t border-[#F7E8EE]"><td className="py-3">{row.transactionDate}</td><td className="py-3">{row.sourceType}</td><td className="py-3">{row.categoryName ?? "—"}</td><td className="py-3">{row.payeeName ?? "—"}</td><td className="py-3 capitalize">{row.direction}</td><td className="py-3 text-right font-semibold">{money(row.amountCents)}</td></tr>)}</tbody></table>{overview.data.recentTransactions.length === 0 && <p className="py-5 font-body text-sm text-[#9B7A69]">No QuickBooks data has been imported yet.</p>}</CardContent></Card>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ title, value, icon, note }: { title: string; value: string; icon: React.ReactNode; note: string }) {
  return <Card className="rounded-2xl border-[#F0D0DC] bg-white"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-2 mb-2">{icon}<span className="font-body text-xs uppercase tracking-wide text-[#6B4C3B]">{title}</span></div><p className="font-display text-2xl text-[#1A0A12]">{value}</p><p className="font-body text-xs text-[#9B7A69] mt-1">{note}</p></CardContent></Card>;
}
