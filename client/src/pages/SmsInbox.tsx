import { useRef, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Inbox, CheckCheck, RefreshCw, MessageSquare, Phone, Send, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function timeAgo(date: Date | string | number): string {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

type ReplyAttempt = { attemptId: string; body: string };
const REPLY_ATTEMPT_STORAGE_KEY = "apy-sms-inbox-reply-attempts-v2";

function getStoredReplyAttempt(messageId: number): ReplyAttempt | null {
  try {
    const attempts = JSON.parse(sessionStorage.getItem(REPLY_ATTEMPT_STORAGE_KEY) ?? "{}") as Record<string, ReplyAttempt>;
    return attempts[String(messageId)] ?? null;
  } catch {
    return null;
  }
}

function storeReplyAttempt(messageId: number, attempt: ReplyAttempt) {
  try {
    const attempts = JSON.parse(sessionStorage.getItem(REPLY_ATTEMPT_STORAGE_KEY) ?? "{}") as Record<string, ReplyAttempt>;
    attempts[String(messageId)] = attempt;
    sessionStorage.setItem(REPLY_ATTEMPT_STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // The in-memory attempt still protects this active tab if browser storage is unavailable.
  }
}

function clearStoredReplyAttempt(messageId: number) {
  try {
    const attempts = JSON.parse(sessionStorage.getItem(REPLY_ATTEMPT_STORAGE_KEY) ?? "{}") as Record<string, ReplyAttempt>;
    delete attempts[String(messageId)];
    sessionStorage.setItem(REPLY_ATTEMPT_STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // Nothing to clear if browser storage is unavailable.
  }
}

export default function SmsInbox() {
  const utils = trpc.useUtils();
  const { data: messages = [], isLoading, refetch } = trpc.inboundSms.list.useQuery({ limit: 200 });
  const { data: unreadCount = 0 } = trpc.inboundSms.unreadCount.useQuery();

  const markRead = trpc.inboundSms.markRead.useMutation({
    onSuccess: () => {
      utils.inboundSms.list.invalidate();
      utils.inboundSms.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.inboundSms.markAllRead.useMutation({
    onSuccess: () => {
      utils.inboundSms.list.invalidate();
      utils.inboundSms.unreadCount.invalidate();
      toast.success("All messages marked as read");
    },
  });

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyAttempts, setReplyAttempts] = useState<Record<number, ReplyAttempt>>({});
  const sendingReplyIds = useRef(new Set<number>());

  const reply = trpc.inboundSms.reply.useMutation({
    onSuccess: (data, variables) => {
      sendingReplyIds.current.delete(variables.messageId);
      setReplyDrafts(current => ({ ...current, [variables.messageId]: "" }));
      setReplyAttempts(current => {
        const next = { ...current };
        delete next[variables.messageId];
        return next;
      });
      clearStoredReplyAttempt(variables.messageId);
      utils.inboundSms.list.invalidate();
      utils.inboundSms.unreadCount.invalidate();
      toast.success(`Reply sent to ${data.to} from the APY business number`);
    },
    onError: async (error, variables) => {
      sendingReplyIds.current.delete(variables.messageId);
      try {
        const outcome = await utils.inboundSms.replyStatus.fetch({
          messageId: variables.messageId,
          attemptId: variables.attemptId,
        });
        if (outcome.found && outcome.deliveryStatus === "failed") {
          setReplyAttempts(current => {
            const next = { ...current };
            delete next[variables.messageId];
            return next;
          });
          clearStoredReplyAttempt(variables.messageId);
          toast.error("Twilio rejected this reply. Revise the message before trying again.");
          return;
        }
        if (outcome.found) {
          if (outcome.deliveryStatus !== "processing") {
            setReplyDrafts(current => ({ ...current, [variables.messageId]: "" }));
            setReplyAttempts(current => {
              const next = { ...current };
              delete next[variables.messageId];
              return next;
            });
            clearStoredReplyAttempt(variables.messageId);
            toast.success("Reply was accepted by Twilio from the APY business number.");
            return;
          }
          toast.error("This reply is already being processed or was sent. No duplicate SMS will be sent.");
          return;
        }
        toast.error("The reply request did not reach APY HQ. You can safely try the same message again.");
        return;
      } catch {
        // An unknown outcome is deliberately treated as non-retryable.
      }
      toast.error(`Reply outcome is unknown. Do not send it again. ${error.message}`);
    },
  });

  const filtered = filter === "unread" ? messages.filter(m => !m.isRead) : messages;

  const sendReply = async (messageId: number) => {
    const body = replyDrafts[messageId]?.trim() ?? "";
    if (!body) {
      toast.error("Write a reply before sending it.");
      return;
    }
    // A ref updates synchronously, preventing two rapid clicks from creating separate claims.
    if (sendingReplyIds.current.has(messageId)) return;
    sendingReplyIds.current.add(messageId);
    const existingAttempt = replyAttempts[messageId] ?? getStoredReplyAttempt(messageId);
    if (existingAttempt) {
      try {
        const outcome = await utils.inboundSms.replyStatus.fetch({ messageId, attemptId: existingAttempt.attemptId });
        if (outcome.found && outcome.deliveryStatus === "failed") {
          setReplyAttempts(current => {
            const next = { ...current };
            delete next[messageId];
            return next;
          });
          clearStoredReplyAttempt(messageId);
        } else if (outcome.found) {
          sendingReplyIds.current.delete(messageId);
          if (outcome.deliveryStatus !== "processing") {
            setReplyDrafts(current => ({ ...current, [messageId]: "" }));
            setReplyAttempts(current => {
              const next = { ...current };
              delete next[messageId];
              return next;
            });
            clearStoredReplyAttempt(messageId);
            toast.success("Your earlier reply was accepted by Twilio.");
          } else {
            toast.error("This reply is still being processed or has an unknown delivery outcome. No duplicate SMS will be sent.");
          }
          return;
        } else {
          // The earlier browser request did not reach APY HQ. Resume the original request, not an edited draft.
          if (body !== existingAttempt.body) {
            setReplyDrafts(current => ({ ...current, [messageId]: existingAttempt.body }));
            sendingReplyIds.current.delete(messageId);
            toast.error("Your earlier reply was interrupted before APY HQ received it. The original draft was restored. Review it and send once to resume safely.");
            return;
          }
          reply.mutate({ messageId, body: existingAttempt.body, attemptId: existingAttempt.attemptId });
          return;
        }
      } catch {
        sendingReplyIds.current.delete(messageId);
        toast.error("Reply outcome is unknown. Do not send it again until it can be checked.");
        return;
      }
    }

    const attempt = { attemptId: crypto.randomUUID(), body };
    setReplyAttempts(current => ({ ...current, [messageId]: attempt }));
    storeReplyAttempt(messageId, attempt);
    reply.mutate({ messageId, body, attemptId: attempt.attemptId });
  };

  return (
    <div className="min-h-screen bg-[#FFF8FB]">
      <AdminNav />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B2252] flex items-center justify-center">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-[#1A0A12]">SMS Inbox</h1>
              <p className="text-sm text-[#8B6070]">Read and reply from the APY business number</p>
            </div>
            {unreadCount > 0 && (
              <Badge className="bg-[#8B2252] text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-[#F0D0DC] text-[#8B2252]"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="bg-[#8B2252] hover:bg-[#6B1A3E] text-white"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(["all", "unread"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filter === f
                  ? "bg-[#8B2252] text-white"
                  : "bg-white border border-[#F0D0DC] text-[#8B2252] hover:bg-[#FFF0F4]"
              }`}
            >
              {f === "all" ? `All (${messages.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Messages */}
        {isLoading ? (
          <div className="text-center py-16 text-[#8B6070]">Loading messages...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-[#D4A0B8] mx-auto mb-3" />
            <p className="text-[#8B6070] font-medium">
              {filter === "unread" ? "No unread messages" : "No messages yet"}
            </p>
            <p className="text-sm text-[#B08090] mt-1">
              Replies from breeders will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(msg => (
              <div
                key={msg.id}
                onClick={() => { if (!msg.isRead) markRead.mutate({ id: msg.id }); }}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  msg.isRead
                    ? "bg-white border-[#F0D0DC]"
                    : "bg-[#FFF0F4] border-[#E8A0C0] shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      msg.isRead ? "bg-[#F5E8EE]" : "bg-[#8B2252]"
                    }`}>
                      <Phone className={`w-4 h-4 ${msg.isRead ? "text-[#8B2252]" : "text-white"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-[#1A0A12]">
                          {msg.breederName ?? msg.fromPhone}
                        </span>
                        {msg.breederName && (
                          <span className="text-xs text-[#8B6070]">{msg.fromPhone}</span>
                        )}
                        {!msg.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#8B2252] shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-[#3D1A2E] leading-relaxed">{msg.body}</p>
                      <div className="mt-3 rounded-lg border border-[#F0D0DC] bg-[#FFF8FB] p-3" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-medium text-[#6B4C3B]">Reply from the APY business number</p>
                          <a
                            href={`tel:${msg.fromPhone}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2252] hover:underline"
                          >
                            <PhoneCall className="h-3.5 w-3.5" /> Call {msg.fromPhone}
                          </a>
                        </div>
                        <Textarea
                          value={replyDrafts[msg.id] ?? ""}
                          onChange={(event) => setReplyDrafts(current => ({ ...current, [msg.id]: event.target.value }))}
                          placeholder={`Reply to ${msg.breederName ?? msg.fromPhone}…`}
                          maxLength={1600}
                          rows={3}
                          className="resize-y border-[#E8C4D2] bg-white text-sm"
                        />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-xs text-[#8B6070]">{(replyDrafts[msg.id] ?? "").length}/1600</span>
                          <Button
                            size="sm"
                            onClick={() => sendReply(msg.id)}
                            disabled={reply.isPending || !(replyDrafts[msg.id]?.trim())}
                            className="bg-[#8B2252] text-white hover:bg-[#6B1A3E]"
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            {reply.isPending ? "Sending…" : "Send reply"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[#B08090] shrink-0 mt-0.5">
                    {timeAgo(msg.receivedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
