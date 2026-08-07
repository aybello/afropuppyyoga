import { useState } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Inbox, CheckCheck, RefreshCw, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function timeAgo(date: Date | string | number): string {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
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

  const filtered = filter === "unread" ? messages.filter(m => !m.isRead) : messages;

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
              <p className="text-sm text-[#8B6070]">Breeder replies to your outreach texts</p>
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

