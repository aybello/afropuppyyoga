import { trpc } from "@/lib/trpc";
import AdminNav from "@/components/AdminNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Send, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ReviewTexts() {
  const [triggering, setTriggering] = useState(false);

  const { data: stats } = trpc.reviewTexts.stats.useQuery();
  const { data: logs = [], isLoading, refetch } = trpc.reviewTexts.list.useQuery({ limit: 200 });
  const triggerMutation = trpc.reviewTexts.triggerNow.useMutation({
    onSuccess: (result) => {
      toast.success(`Done — sent: ${result.sent}, skipped: ${result.skipped}, errors: ${result.errors}`);
      refetch();
      setTriggering(false);
    },
    onError: (e) => {
      toast.error(`Error: ${e.message}`);
      setTriggering(false);
    },
  });

  function handleTrigger() {
    setTriggering(true);
    triggerMutation.mutate();
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-[#8B2252] rounded-full" />
              <span className="font-body text-xs font-semibold text-[#8B2252] uppercase tracking-widest">Admin</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-[#1A0A12]">Review Texts</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">
              Automated Google review SMS sent 2 hours after each class ends
            </p>
          </div>
          <Button
            onClick={handleTrigger}
            disabled={triggering}
            className="bg-[#8B2252] hover:bg-[#6d1a3f] text-white font-body gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${triggering ? "animate-spin" : ""}`} />
            {triggering ? "Running..." : "Run Now"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Sent", value: stats?.sent ?? 0, color: "text-green-600" },
            { label: "Failed", value: stats?.failed ?? 0, color: "text-red-500" },
            { label: "Total Attempts", value: stats?.total ?? 0, color: "text-[#8B2252]" },
            { label: "Events Covered", value: stats?.events ?? 0, color: "text-[#6B4C3B]" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#F0D0DC] p-4">
              <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-xl border border-[#F0D0DC] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F0D0DC] flex items-center gap-2">
            <Star className="w-4 h-4 text-[#8B2252]" />
            <h2 className="font-body text-sm font-semibold text-[#1A0A12]">Send Log</h2>
            <span className="ml-auto font-body text-xs text-[#6B4C3B]">{logs.length} records</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center font-body text-sm text-[#6B4C3B]">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <Star className="w-10 h-10 text-[#F0D0DC] mx-auto mb-3" />
              <p className="font-body text-sm text-[#6B4C3B]">No review texts sent yet.</p>
              <p className="font-body text-xs text-[#C4A0B0] mt-1">
                The system automatically sends texts 2 hours after each class ends.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0D0DC] bg-[#FFF5F8]">
                    {["Status", "Guest", "Phone", "Event", "Event End", "Sent At"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-body text-xs font-semibold text-[#6B4C3B] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-[#F0D0DC] hover:bg-[#FFF9FB] transition-colors">
                      <td className="px-4 py-3">
                        {log.status === "sent" ? (
                          <span className="flex items-center gap-1 text-green-600 font-body text-xs font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> Sent
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500 font-body text-xs font-semibold">
                            <XCircle className="w-3.5 h-3.5" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-body text-sm text-[#1A0A12]">{log.guestName}</p>
                        {log.guestEmail && <p className="font-body text-xs text-[#6B4C3B]">{log.guestEmail}</p>}
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-[#1A0A12]">{log.phone}</td>
                      <td className="px-4 py-3">
                        <p className="font-body text-xs text-[#1A0A12] max-w-[200px] truncate">{log.eventName}</p>
                        <p className="font-body text-xs text-[#6B4C3B]">{log.lumaEventId}</p>
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-[#6B4C3B]">
                        {new Date(log.eventEndAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-[#6B4C3B]">
                        {new Date(log.sentAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 bg-[#FFF5F8] border border-[#F0D0DC] rounded-xl">
          <p className="font-body text-xs text-[#6B4C3B]">
            <strong>How it works:</strong> Every 30 minutes, the system checks for Luma events that ended approximately 2 hours ago.
            It fetches all registered guests, checks who hasn't received a text yet, and sends each one a personalised Google review request.
            The "Run Now" button manually triggers the same check — useful for testing or if a class was missed.
          </p>
        </div>
      </div>
    </div>
  );
}

