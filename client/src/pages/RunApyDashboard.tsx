import { Link } from "wouter";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, Inbox, Loader2, RefreshCw, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AdminNav from "@/components/AdminNav";

type RunApyAction = {
  id: string;
  severity: "critical" | "warning" | "normal";
  title: string;
  detail: string;
  href: string;
};

type RunApyScheduleEvent = {
  id: number;
  classDate: string;
  startTime: string;
  location: string;
  breed: string;
  breederName: string;
  fullyStaffed: boolean;
  gaps: string[];
  teamNotified: boolean;
  lumaSyncStatus: "not_required" | "pending" | "synced" | "failed";
};

const severityClass: Record<RunApyAction["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  normal: "border-[#D8E5D2] bg-white text-[#29472A]",
};

function EventRow({ event }: { event: RunApyScheduleEvent }) {
  return (
    <div className="grid gap-3 border-b border-[#E6EBDD] px-4 py-4 last:border-0 md:grid-cols-[130px_1fr_1fr_auto] md:items-center">
      <div><p className="text-sm font-bold text-[#1E3A20]">{event.classDate}</p><p className="text-xs text-[#77725F]">{event.startTime}</p></div>
      <div><p className="font-bold text-[#1E241C]">{event.location} · {event.breed}</p><p className="text-xs text-[#77725F]">Breeder: {event.breederName}</p></div>
      <div className="text-xs">{event.fullyStaffed ? <span className="font-bold text-emerald-700">Fully staffed</span> : <span className="font-bold text-red-700">Missing {event.gaps.join(", ")}</span>}<span className="mx-2 text-[#C9C4B3]">·</span>{event.teamNotified ? "Team notified" : "Notification pending"}<span className="mx-2 text-[#C9C4B3]">·</span><span className={event.lumaSyncStatus === "synced" || event.lumaSyncStatus === "not_required" ? "text-emerald-700" : "font-bold text-red-700"}>{event.lumaSyncStatus === "not_required" ? "Private" : event.lumaSyncStatus === "synced" ? "Luma synced" : "Luma attention"}</span></div>
      <Link href="/admin/puppy-schedule" className="text-xs font-bold text-[#8B2252] hover:underline">Open schedule</Link>
    </div>
  );
}

export default function RunApyDashboard() {
  const dashboard = trpc.operationsDashboard.getRunApy.useQuery(undefined, { refetchInterval: 60_000 });
  if (dashboard.isLoading) return <div className="min-h-screen bg-[#F7F2E8] flex items-center justify-center"><Loader2 className="animate-spin text-[#2D5A27]" /></div>;
  if (dashboard.error || !dashboard.data) return <div className="min-h-screen bg-[#F7F2E8]"><AdminNav /><div className="mx-auto max-w-4xl p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">Run APY could not load: {dashboard.error?.message ?? "Unknown error"}</div></div></div>;
  const data = dashboard.data;
  const actions = data.actions as RunApyAction[];
  const todaySchedule = data.todaySchedule as RunApyScheduleEvent[];
  const upcomingSchedule = data.upcomingSchedule as RunApyScheduleEvent[];
  const metrics = [
    ["Today's classes", data.metrics.todayClasses, CalendarDays],
    ["Staffing gaps", data.metrics.staffingGaps, AlertTriangle],
    ["Private leads", data.metrics.newPrivateLeads, Users],
    ["Unread texts", data.metrics.unreadMessages, Inbox],
  ] as const;

  return (
    <div className="min-h-screen bg-[#F7F2E8] text-[#1E241C]">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C05A35]">Operations command view</p><h1 className="mt-1 font-serif text-4xl font-bold text-[#2D5A27]">Run APY</h1><p className="mt-2 text-sm text-[#665A36]">What needs attention today, ordered by operational risk.</p></div>
          <button onClick={() => dashboard.refetch()} disabled={dashboard.isFetching} className="flex items-center gap-2 rounded-full border border-[#B9CDB2] bg-white px-4 py-2 text-sm font-bold text-[#2D5A27]"><RefreshCw size={15} className={dashboard.isFetching ? "animate-spin" : ""} />Refresh</button>
        </div>

        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-[#DCE5D5] bg-white p-5"><Icon size={18} className="text-[#C05A35]" /><p className="mt-3 text-3xl font-bold text-[#2D5A27]">{value}</p><p className="text-xs font-semibold text-[#77725F]">{label}</p></div>)}
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.9fr_1.5fr]">
          <section className="rounded-3xl border border-[#DCE5D5] bg-[#EEF4EA] p-5">
            <div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-bold text-[#2D5A27]">Priority actions</h2><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#2D5A27]">{data.actions.length}</span></div>
            <div className="mt-4 space-y-3">
              {actions.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-white p-5 text-sm text-emerald-800"><CheckCircle2 className="mb-2" />No urgent operating tasks are currently open.</div> : actions.map(action => <Link key={action.id} href={action.href} className={`block rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${severityClass[action.severity]}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{action.title}</p><p className="mt-1 text-xs leading-5 opacity-80">{action.detail}</p></div><ArrowRight size={17} className="mt-0.5 shrink-0" /></div></Link>)}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-[#DCE5D5] bg-white">
            <div className="border-b border-[#E6EBDD] bg-[#FFF9E9] px-5 py-4"><h2 className="font-serif text-2xl font-bold text-[#2D5A27]">Next 14 days</h2><p className="text-xs text-[#77725F]">{data.metrics.next14Days} scheduled event{data.metrics.next14Days === 1 ? "" : "s"} · {data.metrics.unnotifiedTeams} team notification{data.metrics.unnotifiedTeams === 1 ? "" : "s"} ready to send</p></div>
            {todaySchedule.length === 0 && upcomingSchedule.length === 0 ? <div className="p-8 text-center text-sm text-[#77725F]"><Clock3 className="mx-auto mb-2" />No classes are scheduled in this window.</div> : <>{todaySchedule.map(event => <EventRow key={event.id} event={event} />)}{upcomingSchedule.map(event => <EventRow key={event.id} event={event} />)}</>}
          </section>
        </div>
      </main>
    </div>
  );
}
