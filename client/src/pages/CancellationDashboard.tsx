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
import { PhoneCall, MessageSquare, Mail, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Send, Users, Eye } from "lucide-react";

type CallResult = {
  name: string;
  phone: string;
  callStatus: string;
  smsStatus: string;
  emailStatus: string;
  callSid?: string;
  smsSid?: string;
  error?: string;
};

type CancellationResult = {
  total: number;
  called: number;
  texted: number;
  emailed: number;
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
      return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">no phone</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

export default function CancellationDashboard() {
  const [selectedEventApiId, setSelectedEventApiId] = useState<string>("");
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [cancellationResult, setCancellationResult] = useState<CancellationResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const utils = trpc.useUtils();

  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = trpc.cancellation.listEvents.useQuery();

  // Preview query — only runs when showPreview is true and an event is selected
  const {
    data: previewData,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = trpc.cancellation.previewCancellation.useQuery(
    { eventApiId: selectedEventApiId },
    { enabled: showPreview && !!selectedEventApiId }
  );

  const cancelMutation = trpc.cancellation.cancelClass.useMutation({
    onSuccess: async (data, variables) => {
      setCancellationResult(data as CancellationResult);
      setConfirming(false);
      setShowPreview(false);
      setCustomMessage("");

      // The mutation writes notification logs, but React Query still has the
      // pre-send responses cached. Refresh every cancellation-related view so
      // the event list and notification history update immediately.
      await Promise.all([
        utils.cancellation.listEvents.invalidate(),
        utils.cancellation.previewCancellation.invalidate({
          eventApiId: variables.eventApiId,
        }),
        utils.cancellation.getCallLogs.invalidate({
          eventApiId: variables.eventApiId,
        }),
      ]);

      toast.success(
        `Done! ${data.called} called · ${data.texted} texted · ${data.emailed} emailed · ${data.failed} failed`
      );
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

  const syncDeliveryStatuses = trpc.cancellation.syncDeliveryStatuses.useMutation({
    onSuccess: async (result) => {
      await refetchLogs();
      if (result.errors.length > 0) {
        toast.error("Some delivery records could not be refreshed. Please try again.");
      } else if (result.updated > 0) {
        toast.success(`Updated ${result.updated} notification record${result.updated === 1 ? "" : "s"} from Twilio.`);
      } else {
        toast.success("Notification delivery statuses are already current.");
      }
    },
    onError: (error) => toast.error(`Could not refresh delivery statuses: ${error.message}`),
  });

  function handleRefreshLogs() {
    if (!selectedEventApiId || syncDeliveryStatuses.isPending) return;
    syncDeliveryStatuses.mutate({ eventApiId: selectedEventApiId });
  }

  function handleSelectEvent(apiId: string) {
    const event = events?.find((e) => e.apiId === apiId);
    setSelectedEventApiId(apiId);
    setSelectedEventName(event?.name ?? "");
    setCancellationResult(null);
    setShowPreview(false);
    setConfirming(false);
  }

  function handlePreviewRecipients() {
    if (!selectedEventApiId || !selectedEventName) {
      toast.error("Please select an event first");
      return;
    }
    setShowPreview(true);
    refetchPreview();
  }

  function handleConfirmSend() {
    setConfirming(true);
  }

  function handleFinalSend() {
    cancelMutation.mutate({
      eventApiId: selectedEventApiId,
      eventName: selectedEventName,
      customMessage: customMessage.trim() || undefined,
    });
  }

  const withPhone = previewData?.guests.filter((g) => g.hasPhone) ?? [];
  const emailOnly = previewData?.guests.filter((g) => !g.hasPhone) ?? [];

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
            Select an upcoming class to cancel. You will see a <strong>preview of all recipients</strong>{" "}
            before any notifications are sent. Every registered attendee will receive a{" "}
            <strong>phone call</strong>, an <strong>SMS</strong>, and a <strong>cancellation email</strong>.
          </p>
        </div>

        {/* Step 1: Event Selector */}
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
                  <button
                    onClick={() => refetchEvents()}
                    className="text-xs text-[#8b5cf6] hover:underline flex items-center gap-1"
                  >
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
                        {new Date(event.startAt).toLocaleString()}{" "}
                        {event.address && `· ${event.address}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Custom Message */}
        {selectedEventApiId && (
          <Card className="mb-6 border-[#e8dff5]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#2d1b4e]">2. Customize Message (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-sm text-gray-600 mb-2 block">
                Leave blank to use the default APY cancellation message. This message is used for the call,
                SMS, and email.
              </Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={`Default: "Hi from AfroPuppyYoga! Your class "${selectedEventName}" has been cancelled. We're sorry — visit afropuppyyoga.ca to rebook."`}
                rows={4}
                className="text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview Recipients Button */}
        {selectedEventApiId && !showPreview && !cancellationResult && (
          <Card className="mb-6 border-[#e8dff5]">
            <CardContent className="pt-5">
              <Button
                onClick={handlePreviewRecipients}
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Recipients Before Sending
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                This will fetch the list of registered attendees from Luma so you can review before sending any notifications.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 3b: Preview Panel — shows exact recipients */}
        {showPreview && !cancellationResult && (
          <Card className="mb-6 border-[#8b5cf6] bg-[#faf5ff]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-[#2d1b4e] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#8b5cf6]" />
                  3. Review Recipients
                </CardTitle>
                {previewData && (
                  <Badge className="bg-[#8b5cf6] text-white text-sm px-3 py-1">
                    {previewData.total} recipient{previewData.total !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-gray-500 py-4">
                  <Spinner className="w-4 h-4" /> Fetching registered attendees from Luma...
                </div>
              ) : previewData && previewData.total === 0 ? (
                <div className="text-center py-6">
                  <XCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">No registered attendees found</p>
                  <p className="text-gray-500 text-sm mt-1">
                    There are no approved guests for this event. No notifications will be sent.
                  </p>
                </div>
              ) : previewData ? (
                <>
                  {/* Summary badges */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-2 border border-[#e8dff5]">
                      <PhoneCall className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-[#2d1b4e]">{withPhone.length}</span>
                      <span className="text-xs text-gray-500">will get call + SMS + email</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-2 border border-[#e8dff5]">
                      <Mail className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-[#2d1b4e]">{emailOnly.length}</span>
                      <span className="text-xs text-gray-500">will get email only (no phone)</span>
                    </div>
                  </div>

                  {/* Recipient list */}
                  <div className="bg-white rounded-lg border border-[#e8dff5] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">#</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Name</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Email</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Phone</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Channels</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.guests.map((g, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 text-gray-400 text-xs">{i + 1}</td>
                            <td className="py-2 px-3 font-medium text-[#2d1b4e]">{g.name}</td>
                            <td className="py-2 px-3 text-gray-600 text-xs">{g.email}</td>
                            <td className="py-2 px-3 text-gray-600 text-xs">
                              {g.phone || <span className="text-gray-400 italic">none</span>}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1">
                                {g.hasPhone ? (
                                  <>
                                    <PhoneCall className="w-3.5 h-3.5 text-blue-500" />
                                    <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                                    <Mail className="w-3.5 h-3.5 text-green-500" />
                                  </>
                                ) : (
                                  <Mail className="w-3.5 h-3.5 text-green-500" />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Action buttons */}
                  {!confirming ? (
                    <div className="mt-4 flex items-start gap-3">
                      <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-orange-800">
                              Ready to notify <strong>{previewData.total}</strong> attendee{previewData.total !== 1 ? "s" : ""} of{" "}
                              <strong>{selectedEventName}</strong>
                            </p>
                            <p className="text-xs text-orange-700 mt-1">
                              This will send phone calls, SMS messages, and emails. This action cannot be undone.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={handleConfirmSend}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <Send className="w-4 h-4 mr-1.5" />
                          Proceed to Send
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowPreview(false)}
                          className="text-sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 bg-red-50 border border-red-300 rounded-lg p-4">
                      <p className="font-bold text-red-800 mb-1">Final confirmation</p>
                      <p className="text-red-700 text-sm mb-3">
                        You are about to send <strong>phone calls</strong>, <strong>SMS messages</strong>, and{" "}
                        <strong>emails</strong> to <strong>{previewData.total}</strong> attendee{previewData.total !== 1 ? "s" : ""}.
                        This cannot be undone.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={handleFinalSend}
                          disabled={cancelMutation.isPending}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {cancelMutation.isPending ? (
                            <>
                              <Spinner className="w-4 h-4 mr-2" /> Notifying {previewData.total} attendees...
                            </>
                          ) : (
                            <>Yes, Cancel &amp; Notify {previewData.total} Attendee{previewData.total !== 1 ? "s" : ""}</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setConfirming(false)}
                          disabled={cancelMutation.isPending}
                        >
                          Go Back
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
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
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                    <PhoneCall className="w-3 h-3" /> Called
                  </div>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-purple-600">{cancellationResult.texted}</div>
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Texted
                  </div>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{cancellationResult.emailed}</div>
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                    <Mail className="w-3 h-3" /> Emailed
                  </div>
                </div>
                <div className="text-center bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-red-500">{cancellationResult.failed}</div>
                  <div className="text-xs text-gray-500">Failed</div>
                </div>
              </div>

              {/* Per-guest results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cancellationResult.results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white rounded p-2 border border-green-100 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-[#2d1b4e]">{r.name}</span>
                      <span className="text-gray-400 text-xs truncate max-w-32">{r.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {r.callStatus !== "skipped" && (
                        <>
                          <span className="text-xs text-gray-500">Call:</span>
                          {statusBadge(r.callStatus)}
                        </>
                      )}
                      {r.smsStatus !== "skipped" && (
                        <>
                          <span className="text-xs text-gray-500">SMS:</span>
                          {statusBadge(r.smsStatus)}
                        </>
                      )}
                      <span className="text-xs text-gray-500">Email:</span>
                      {statusBadge(r.emailStatus)}
                      {r.error && (
                        <span className="text-xs text-red-500 max-w-32 truncate">{r.error}</span>
                      )}
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
                <button
                  onClick={handleRefreshLogs}
                  disabled={syncDeliveryStatuses.isPending}
                  className="text-xs text-[#8b5cf6] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${syncDeliveryStatuses.isPending ? "animate-spin" : ""}`} />
                  {syncDeliveryStatuses.isPending ? "Syncing…" : "Refresh"}
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
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Email</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogsData.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-[#2d1b4e]">{log.guestName}</td>
                        <td className="py-2 px-2 text-gray-600 text-xs">
                          {log.phone.startsWith("email:") ? (
                            <span className="text-blue-600">
                              📧 {log.phone.replace("email:", "")}
                            </span>
                          ) : (
                            log.phone
                          )}
                        </td>
                        <td className="py-2 px-2">{statusBadge(log.status)}</td>
                        <td className="py-2 px-2">{statusBadge(log.smsStatus ?? "queued")}</td>
                        <td className="py-2 px-2">{statusBadge((log as { emailStatus?: string }).emailStatus ?? "queued")}</td>
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
