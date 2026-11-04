import { Link } from "wouter";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, Inbox, Loader2, Mail, MessageSquare, RefreshCw, Send, UserPlus, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import AdminNav from "@/components/AdminNav";
import { toast } from "sonner";
import { individualScheduleDeliveryFeedback } from "@shared/individualNotification";

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

type StaffingEntry = {
  id: number;
  staffing: {
    operationsManager: { id: number; name: string } | null;
    yogaInstructor: { id: number; name: string } | null;
    eligibleOperationsManagers: Array<{ id: number; name: string }>;
    eligibleYogaInstructors: Array<{ id: number; name: string }>;
    assignedPuppyMonitors: Array<{ id: number; staffId: number; name: string }>;
    eligiblePuppyMonitors: Array<{ id: number; name: string }>;
  };
};

const severityClass: Record<RunApyAction["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  normal: "border-border bg-white text-foreground",
};

function EventStaffControls({ event, staffing, onChanged }: { event: RunApyScheduleEvent; staffing: StaffingEntry | undefined; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [selectedPuppyMonitor, setSelectedPuppyMonitor] = useState("");
  const [selectedOperationsManager, setSelectedOperationsManager] = useState("");
  const [selectedYogaInstructor, setSelectedYogaInstructor] = useState("");
  const notificationPreview = trpc.puppySchedule.eventNotificationPreview.useQuery(
    { scheduleId: event.id },
    { enabled: open },
  );
  const notifyIndividual = trpc.puppySchedule.notifyIndividualEventStaff.useMutation({
    onSuccess: (result) => {
      notificationPreview.refetch();
      const feedback = individualScheduleDeliveryFeedback({ deliveryStatus: result.deliveryStatus, name: result.result.name, errors: result.result.errors });
      if (feedback.kind === "success") toast.success(feedback.message);
      else if (feedback.kind === "warning") toast.warning(feedback.message);
      else toast.error(feedback.message);
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });
  const notifyWholeTeam = trpc.puppySchedule.notifyEventTeam.useMutation({
    onSuccess: (result) => {
      notificationPreview.refetch();
      const delivered = result.results.filter((item) => item.emailStatus === "sent" || item.smsStatus === "sent").length;
      if (result.success) toast.success(`Schedule sent to ${delivered} team member${delivered === 1 ? "" : "s"}`);
      else toast.warning(`Schedule delivery completed with issues. ${delivered} team member${delivered === 1 ? "" : "s"} received a message.`);
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });
  const assignPuppyMonitor = trpc.puppySchedule.assignPuppyMonitor.useMutation({
    onSuccess: () => {
      toast.success("Puppy Monitor assigned to this class");
      setSelectedPuppyMonitor("");
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });
  const assignLeadership = trpc.puppySchedule.assignLeadership.useMutation({
    onSuccess: () => {
      toast.success("Class leadership updated");
      setSelectedOperationsManager("");
      setSelectedYogaInstructor("");
      notificationPreview.refetch();
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });

  const assignedCount = staffing?.staffing.assignedPuppyMonitors.length ?? 0;
  const canAddPuppyMonitor = assignedCount < 3;

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-border bg-accent px-3 py-2 text-xs font-bold text-brand-link hover:bg-accent">Message & staff</button>;
  }

  return <div className="mt-3 rounded-xl border border-border bg-card p-3 md:col-span-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-foreground">Class team</p><p className="text-[11px] text-muted-foreground">Assign or replace class leadership, then message any assigned team member individually.</p></div><button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-brand-link hover:underline">Close</button></div>
    {notificationPreview.isLoading ? <p className="mt-3 text-xs text-muted-foreground">Loading assigned class staff…</p> : notificationPreview.error ? <p className="mt-3 text-xs font-semibold text-red-700">Class staff could not be loaded. Open the schedule to review staffing.</p> : <div className="mt-3 space-y-2">{notificationPreview.data?.recipients.map((recipient) => {
      const canContact = Boolean(recipient.email || recipient.phone);
      const wasSent = Boolean(recipient.lastSentAt);
      return <div key={`${recipient.role}-${recipient.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white px-3 py-2"><span className="min-w-0 flex-1 text-xs font-bold text-foreground">{recipient.name} · {recipient.role}</span><Mail size={13} className={recipient.email ? "text-emerald-600" : "text-gray-300"} /><MessageSquare size={13} className={recipient.phone ? "text-emerald-600" : "text-gray-300"} /><button type="button" onClick={() => { if (canContact && confirm(`${wasSent ? "Resend" : "Send"} this class schedule to ${recipient.name} only?`)) notifyIndividual.mutate({ scheduleId: event.id, staffId: recipient.id, resend: wasSent }); }} disabled={!canContact || notifyIndividual.isPending} className="rounded-md border border-border bg-accent px-2 py-1 text-[10px] font-bold text-brand-link hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"><Send size={10} className="mr-1 inline" />{wasSent ? "Resend" : "Message"}</button></div>;
    })}<div className="rounded-lg border border-[#DDE8D9] bg-[#F7FBF4] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-foreground">Message the whole team</p><p className="mt-0.5 text-[11px] text-[#5B705A]">This sends to every currently assigned person. To contact only someone newly added, use their Message button above.</p></div><button type="button" onClick={() => { if (confirm(`Send this class schedule by email and text to ${notificationPreview.data?.recipients.length ?? 0} assigned team members?`)) notifyWholeTeam.mutate({ scheduleId: event.id, resend: Boolean(notificationPreview.data?.lastSentAt) }); }} disabled={!notificationPreview.data?.fullyStaffed || notifyWholeTeam.isPending} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"><Send size={12} className="mr-1 inline" />{notifyWholeTeam.isPending ? "Sending…" : notificationPreview.data?.lastSentAt ? "Resend to whole team" : "Send to whole team"}</button></div>{!notificationPreview.data?.fullyStaffed && <p className="mt-2 text-[11px] font-semibold text-amber-800">Finish staffing this class before sending to the whole team.</p>}</div></div>}
    <div className="mt-3 border-t border-border pt-3"><div className="grid gap-2 md:grid-cols-2">{staffing && <><div className="rounded-lg border border-border bg-white p-2.5"><p className="text-xs font-bold text-foreground">Operations Manager · {staffing.staffing.operationsManager?.name ?? "Coverage gap"}</p><div className="mt-2 flex gap-2"><select value={selectedOperationsManager} onChange={(event) => setSelectedOperationsManager(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-xs"><option value="">Select Operations Manager</option>{staffing.staffing.eligibleOperationsManagers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button type="button" onClick={() => selectedOperationsManager && assignLeadership.mutate({ scheduleId: event.id, role: "Operations Manager", staffId: Number(selectedOperationsManager) })} disabled={!selectedOperationsManager || assignLeadership.isPending} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">Save</button></div></div><div className="rounded-lg border border-border bg-white p-2.5"><p className="text-xs font-bold text-foreground">Yoga Instructor · {staffing.staffing.yogaInstructor?.name ?? "Coverage gap"}</p><div className="mt-2 flex gap-2"><select value={selectedYogaInstructor} onChange={(event) => setSelectedYogaInstructor(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-xs"><option value="">Select Yoga Instructor</option>{staffing.staffing.eligibleYogaInstructors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button type="button" onClick={() => selectedYogaInstructor && assignLeadership.mutate({ scheduleId: event.id, role: "Yoga Instructor", staffId: Number(selectedYogaInstructor) })} disabled={!selectedYogaInstructor || assignLeadership.isPending} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">Save</button></div></div></>}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-foreground">Puppy Monitors · {assignedCount}/2 required</p><p className="text-[11px] text-muted-foreground">Up to 3 can be assigned for this class.</p></div></div>{canAddPuppyMonitor && staffing && <div className="mt-2 flex flex-wrap gap-2"><select value={selectedPuppyMonitor} onChange={(event) => setSelectedPuppyMonitor(event.target.value)} className="min-w-52 rounded-md border border-border bg-white px-3 py-2 text-xs"><option value="">Select an available Puppy Monitor</option>{staffing.staffing.eligiblePuppyMonitors.map((monitor) => <option key={monitor.id} value={monitor.id}>{monitor.name}</option>)}</select><button type="button" onClick={() => selectedPuppyMonitor && assignPuppyMonitor.mutate({ scheduleId: event.id, staffId: Number(selectedPuppyMonitor) })} disabled={!selectedPuppyMonitor || assignPuppyMonitor.isPending} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"><UserPlus size={12} className="mr-1 inline" />{assignedCount >= 2 ? "Add 3rd PM" : "Assign PM"}</button></div>}{!staffing && <p className="mt-2 text-[11px] text-muted-foreground">Staffing options are loading. If they do not appear, open the schedule.</p>}</div>
  </div>;
}

function EventRow({ event, staffing, onChanged }: { event: RunApyScheduleEvent; staffing: StaffingEntry | undefined; onChanged: () => void }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-0">
      <div className="grid gap-3 md:grid-cols-[130px_1fr_1fr_auto] md:items-center">
      <div><p className="text-sm font-bold text-foreground">{event.classDate}</p><p className="text-xs text-muted-foreground">{event.startTime}</p></div>
      <div><p className="font-bold text-foreground">{event.location} · {event.breed}</p><p className="text-xs text-muted-foreground">Breeder: {event.breederName}</p></div>
      <div className="text-xs">{event.fullyStaffed ? <span className="font-bold text-emerald-700">Fully staffed</span> : <span className="font-bold text-red-700">Missing {event.gaps.join(", ")}</span>}<span className="mx-2 text-muted-foreground">·</span>{event.teamNotified ? "Team notified" : "Notification pending"}<span className="mx-2 text-muted-foreground">·</span><span className={event.lumaSyncStatus === "synced" || event.lumaSyncStatus === "not_required" ? "text-emerald-700" : "font-bold text-red-700"}>{event.lumaSyncStatus === "not_required" ? "Private" : event.lumaSyncStatus === "synced" ? "Luma synced" : "Luma attention"}</span></div>
      <div className="flex flex-wrap items-center gap-2"><EventStaffControls event={event} staffing={staffing} onChanged={onChanged} /><Link href="/admin/puppy-schedule" className="text-xs font-bold text-brand-link hover:underline">Open schedule</Link></div>
      </div>
    </div>
  );
}

export default function RunApyDashboard() {
  const dashboard = trpc.operationsDashboard.getRunApy.useQuery(undefined, { refetchInterval: 60_000 });
  const classStaffing = trpc.puppySchedule.listWithStaffing.useQuery();
  if (dashboard.isLoading) return <div className="min-h-screen apy-staff-ui bg-background flex items-center justify-center"><Loader2 className="animate-spin text-foreground" /></div>;
  if (dashboard.error || !dashboard.data) return <div className="min-h-screen apy-staff-ui bg-background"><AdminNav /><div className="mx-auto max-w-4xl p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">Run APY could not load: {dashboard.error?.message ?? "Unknown error"}</div></div></div>;
  const data = dashboard.data;
  const actions = data.actions as RunApyAction[];
  const todaySchedule = data.todaySchedule as RunApyScheduleEvent[];
  const upcomingSchedule = data.upcomingSchedule as RunApyScheduleEvent[];
  const staffingByScheduleId = new Map<number, StaffingEntry>((classStaffing.data ?? []).map((entry) => [entry.id, entry as StaffingEntry]));
  const refreshClassOperations = () => {
    dashboard.refetch();
    classStaffing.refetch();
  };
  const metrics = [
    ["Today's classes", data.metrics.todayClasses, CalendarDays],
    ["Staffing gaps", data.metrics.staffingGaps, AlertTriangle],
    ["Private leads", data.metrics.newPrivateLeads, Users],
    ["Unread texts", data.metrics.unreadMessages, Inbox],
  ] as const;

  return (
    <div className="min-h-screen apy-staff-ui bg-background text-foreground">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-link">Operations command view</p><h1 className="mt-1 font-display text-3xl font-medium text-foreground">Run APY</h1><p className="mt-2 text-sm text-muted-foreground">What needs attention today, ordered by operational risk.</p></div>
          <button onClick={() => dashboard.refetch()} disabled={dashboard.isFetching} className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-foreground"><RefreshCw size={15} className={dashboard.isFetching ? "animate-spin" : ""} />Refresh</button>
        </div>

        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-border bg-white p-5"><Icon size={18} className="text-brand-link" /><p className="mt-3 text-3xl font-bold text-foreground">{value}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div>)}
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.9fr_1.5fr]">
          <section className="rounded-3xl border border-border bg-accent p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-medium text-foreground">Priority actions</h2><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-foreground">{data.actions.length}</span></div>
            <div className="mt-4 space-y-3">
              {actions.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-white p-5 text-sm text-emerald-800"><CheckCircle2 className="mb-2" />No urgent operating tasks are currently open.</div> : actions.map(action => <Link key={action.id} href={action.href} className={`block rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${severityClass[action.severity]}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{action.title}</p><p className="mt-1 text-xs leading-5 opacity-80">{action.detail}</p></div><ArrowRight size={17} className="mt-0.5 shrink-0" /></div></Link>)}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-border bg-white">
            <div className="border-b border-border bg-[#FFF9E9] px-5 py-4"><h2 className="font-display text-2xl font-medium text-foreground">Next 14 days</h2><p className="text-xs text-muted-foreground">{data.metrics.next14Days} scheduled event{data.metrics.next14Days === 1 ? "" : "s"} · {data.metrics.unnotifiedTeams} team notification{data.metrics.unnotifiedTeams === 1 ? "" : "s"} ready to send</p></div>
            {todaySchedule.length === 0 && upcomingSchedule.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2" />No classes are scheduled in this window.</div> : <>{todaySchedule.map(event => <EventRow key={event.id} event={event} staffing={staffingByScheduleId.get(event.id)} onChanged={refreshClassOperations} />)}{upcomingSchedule.map(event => <EventRow key={event.id} event={event} staffing={staffingByScheduleId.get(event.id)} onChanged={refreshClassOperations} />)}</>}
          </section>
        </div>
      </main>
    </div>
  );
}
