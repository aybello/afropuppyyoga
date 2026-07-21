import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import AdminNav from "@/components/AdminNav";
import { toast } from "sonner";
import { PhoneCall, MessageSquare, AlertTriangle, CheckCircle2, XCircle, SkipForward, RefreshCw } from "lucide-react";

type CallResult = {
  name: string;
  phone: string;
  callStatus: string;
  smsStatus: string;
  callSid?: string;
  smsSid?: string;
  error?: string;
};

type CancellationResult = {
  total: number;
  called: number;
  texted: number;
  skipped: number;
  failed: number;
  results: CallResult[];
};

function statusBadge(status: string) {
  switch (status) {
    case "queued":
    case "initiated":
    case "ringing":
    case "in-progress":
    case "accepted":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">{status}</Badge>;
    case "completed":
    case "delivered":
    case "sent":
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">{status}</Badge>;
    case "failed":
    case "busy":
    case "no-answer":
    case "undelivered":
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">{status}</Badge>;
    case "skipped":
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">skipped</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

export default function CancellationDashboard() {
  const [selectedEventApiId, setSelectedEventApiId] = useState<string>("");
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [cancellationResult, setCancellationResult] = useState<CancellationResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = trpc.cancellation.listEvents.useQuery();

  const cancelMutation = trpc.cancellation.cancelClass.useMutation({
    onSuccess: (data) => {
      setCancellationResult(data);
      setConfirming(false);
      toast.success(`Done! ${data.called} called, ${data.texted} texted, ${data.skipped} skipped, ${data.failed} failed`);
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(`Failed to cancel class: ${err.message}`);
    },
  });

  const { data: callLogsData, refetch: refetchLogs } = trpc.cancellation.getCallLogs.useQuery(
    { eventApiId: selectedEventApiId || undefined },
    { enabled: !!selectedEventApiId }
  );

  function handleSelectEvent(apiId: string) {
    const event = events?.find((e) => e.apiId === apiId);
    setSelectedEventApiId(apiId);
    setSelectedEventName(event?.name ?? "");
    setCancellationResult(null);
  }

  function handleCancelClass() {
    if (!selectedEventApiId || !selectedEventName) {
      toast.error("Please select an event first");
      return;
    }
    setConfirming(true);
  }

  function handleConfirm() {
    cancelMutation.mutate({
      eventApiId: selectedEventApiId,
      eventName: selectedEventName,
      customMessage: customMessage.trim() || undefined,
    });
  }

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2d1b4e] mb-1 flex items-center gap-2">
            <PhoneCall className="w-7 h-7 text-[#8b5cf6]" />
            Class Cancellation
          </h1>
          <p className="text-gray-600 text-sm">
            Select an upcoming class to cancel. Every registered attendee will receive both a <strong>phone call</strong> and an <strong>SMS</strong> simultaneously. Attendees without a phone number will receive a <strong>cancellation email</strong> as a fallback.
          </p>
        </div>

        {/* Event Selector */}
        <Card className="mb-6 border-[#e8dff5]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-[#2d1b4e]">1. Select Event to Cancel</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Spinner className="w-4 h-4" /> Loading upcoming events...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500">{events?.length ?? 0} upcoming events</span>
                  <button onClick={() => refetchEvents()} className="text-xs text-[#8b5cf6] hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
                <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
                  {events?.map((event) => (
                    <button
                      key={event.apiId}
                      onClick={() => handleSelectEvent(event.apiId)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        selectedEventApiId === event.apiId
                          ? "border-[#8b5cf6] bg-[#f3eeff]"
                          : "border-gray-200 bg-white hover:border-[#c4b5fd] hover:bg-[#faf5ff]"
                      }`}
                    >
                      <div className="font-medium text-[#2d1b4e] text-sm">{event.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(event.startAt).toLocaleString()} {event.address && `· ${event.address}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Message */}
        {selectedEventApiId && (
          <Card className="mb-6 border-[#e8dff5]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#2d1b4e]">2. Customize Message (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-sm text-gray-600 mb-2 block">
                Leave blank to use the default APY cancellation message. This message is used for both the call and the SMS.
              </Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={`Default SMS: "Hi from AfroPuppyYoga! Your class "${selectedEventName}" has been cancelled. We're sorry — visit afropuppyyoga.ca to rebook."`}
                rows={4}
                className="text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* Cancel Button */}
        {selectedEventApiId && !confirming && !cancellationResult && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-orange-800 text-sm">
                    You are about to cancel: <span className="font-bold">{selectedEventName}</span>
                  </p>
                  <p className="text-orange-700 text-xs mt-1">
                    Every registered attendee with a phone number will receive a <strong>phone call</strong> and an <strong>SMS</strong> simultaneously. Attendees without a phone number will receive a <strong>cancellation email</strong> instead. This cannot be undone.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCancelClass}
                className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <PhoneCall className="w-4 h-4 mr-1.5" />
                <MessageSquare className="w-4 h-4 mr-2" />
                Cancel Class & Notify Attendees
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Step */}
        {confirming && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="pt-5">
              <p className="font-bold text-red-800 mb-1">Are you absolutely sure?</p>
              <p className="text-red-700 text-sm mb-4">
                A phone call <strong>and</strong> SMS will be sent immediately to all attendees of <strong>{selectedEventName}</strong>.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirm}
                  disabled={cancelMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {cancelMutation.isPending ? (
                    <><Spinner className="w-4 h-4 mr-2" /> Calling & texting attendees...</>
                  ) : (
                    "Yes, Cancel & Notify Everyone"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={cancelMutation.isPending}>
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {cancellationResult && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-800">Notifications Sent</span>
              </div>
              <div className="grid grid-cols-5 gap-3 mb-4">
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-[#2d1b4e]">{cancellationResult.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-blue-600">{cancellationResult.called}</div>
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><PhoneCall className="w-3 h-3" /> Called</div>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-purple-600">{cancellationResult.texted}</div>
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><MessageSquare className="w-3 h-3" /> Texted</div>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-gray-500">{cancellationResult.skipped}</div>
                  <div className="text-xs text-gray-500">Skipped</div>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-red-500">{cancellationResult.failed}</div>
                  <div className="text-xs text-gray-500">Failed</div>
                </div>
              </div>

              {/* Per-guest results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cancellationResult.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded p-2 border border-green-100 text-sm">
                    <div className="flex items-center gap-2">
                      {r.callStatus === "skipped" ? (
                        <SkipForward className="w-4 h-4 text-gray-400" />
                      ) : r.callStatus === "failed" ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <PhoneCall className="w-4 h-4 text-blue-500" />
                      )}
                      <span className="font-medium text-[#2d1b4e]">{r.name}</span>
                      <span className="text-gray-400 text-xs">{r.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.callStatus !== "skipped" && (
                        <><span className="text-xs text-gray-500">Call:</span>
                        {statusBadge(r.callStatus)}</>
                      )}
                      <span className="text-xs text-gray-500">
                        {r.phone.startsWith("email:") ? "Email:" : "SMS:"}
                      </span>
                      {statusBadge(r.smsStatus)}
                      {r.error && <span className="text-xs text-red-500 max-w-32 truncate">{r.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Call Log History */}
        {selectedEventApiId && callLogsData && callLogsData.length > 0 && (
          <Card className="border-[#e8dff5]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-[#2d1b4e]">Notification Log</CardTitle>
                <button onClick={() => refetchLogs()} className="text-xs text-[#8b5cf6] hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Guest</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Phone</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Call</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">SMS</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogsData.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-[#2d1b4e]">{log.guestName}</td>
                        <td className="py-2 px-2 text-gray-600">
                            {log.phone.startsWith("email:") ? (
                              <span className="text-xs text-blue-600">📧 {log.phone.replace("email:", "")}</span>
                            ) : log.phone}
                          </td>
                        <td className="py-2 px-2">{statusBadge(log.status)}</td>
                        <td className="py-2 px-2">{statusBadge(log.smsStatus ?? "queued")}</td>
                        <td className="py-2 px-2 text-gray-500 text-xs">
                          {new Date(log.calledAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
