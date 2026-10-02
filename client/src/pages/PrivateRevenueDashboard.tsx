import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Clock3,
  DollarSign,
  Instagram,
  MapPin,
  PawPrint,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const CHART_COLORS = ["#C96D56", "#81916B", "#D9A85D", "#6F9290", "#B58C70", "#A95543"];

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value / 100);
}

function number(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return new Intl.NumberFormat("en-CA").format(value);
}

function timestamp(value: string | undefined) {
  if (!value) return "Not yet refreshed";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not yet refreshed" : parsed.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function PawWatermark() {
  return <PawPrint aria-hidden className="absolute -bottom-5 -right-5 h-24 w-24 text-[#3D2E27] opacity-[0.045]" />;
}

function GlassCard({ children, className = "", accent = false }: { children: React.ReactNode; className?: string; accent?: boolean }) {
  return <section className={`relative overflow-hidden rounded-2xl border shadow-[0_12px_28px_rgba(83,58,43,0.10)] ${accent ? "border-[#D58B6A]/70 bg-[#F9E5D5]" : "border-[#E6D8C7] bg-[#FFFCF7]/95"} ${className}`}>{children}</section>;
}

function Metric({ icon: Icon, label, value, note, accent = "text-[#A95543]" }: { icon: typeof Ticket; label: string; value: string; note: string; accent?: string }) {
  return <GlassCard className="p-4">
    <PawWatermark />
    <div className="flex items-start gap-3">
      <div className={`rounded-xl bg-[#F9EEE3] p-2 ${accent}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#735E53]">{label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold leading-none text-[#3D2E27]">{value}</p>
        <p className="mt-1 text-[11px] text-[#806B60]">{note}</p>
      </div>
    </div>
  </GlassCard>;
}

export default function PrivateRevenueDashboard() {
  const queryClient = useQueryClient();
  const overview = trpc.dashboard.overview.useQuery(undefined, {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const [selectedLocation, setSelectedLocation] = useState("All locations");

  useEffect(() => {
    document.title = "Private Revenue Dashboard | AfroPuppyYoga";
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow, noarchive");
    return () => {
      robots?.setAttribute("content", "index, follow");
    };
  }, []);

  useEffect(() => () => {
    queryClient.removeQueries({ queryKey: getQueryKey(trpc.dashboard.overview, undefined, "query") });
  }, [queryClient]);

  const data = overview.data;
  const recentEvents = useMemo(() => {
    if (!data || selectedLocation === "All locations") return data?.recentEvents ?? [];
    return data.recentEvents.filter(event => event.location === selectedLocation);
  }, [data, selectedLocation]);

  const chartData = data?.monthly.slice(-12).map(row => ({
    ...row,
    estimatedRevenue: row.estimatedRevenueCents === null ? undefined : row.estimatedRevenueCents / 100,
    averageTickets: row.tickets === null || row.events === 0 ? undefined : Number((row.tickets / row.events).toFixed(1)),
  })) ?? [];
  const incompleteLocationCount = data?.byLocation.filter(row => row.tickets === null).length ?? 0;
  const incompleteBreedCount = data?.byBreed.filter(row => row.tickets === null).length ?? 0;
  const locationData = data?.byLocation.filter((row): row is typeof row & { tickets: number } => row.tickets !== null)
    .map((row, index) => ({ ...row, ticketValue: row.tickets, color: CHART_COLORS[index % CHART_COLORS.length] })) ?? [];
  const breedData = data?.byBreed.filter((row): row is typeof row & { tickets: number } => row.tickets !== null)
    .map(row => ({ ...row, ticketValue: row.tickets })).slice(0, 10) ?? [];

  return <div className="min-h-screen bg-[#F6F0E6] text-[#3D2E27]">
    <header className="sticky top-0 z-40 border-b border-[#E5D8C6]/80 bg-[#FFF9F0]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9634F] to-[#E4B072] shadow-lg shadow-[#A95543]/25"><PawPrint className="h-5 w-5 text-[#3D2E27]" /></div>
          <div className="min-w-0"><h1 className="truncate font-display text-lg font-bold text-[#3D2E27]">AfroPuppyYoga</h1><p className="text-[11px] tracking-wide text-[#806B60]">Private owner reporting</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block"><p className="text-[10px] uppercase tracking-widest text-[#806B60]">Last refreshed</p><p className="font-mono text-xs text-[#554238]">{timestamp(data?.source.refreshedAt)}</p></div>
          <Link href="/staff" className="inline-flex items-center gap-2 rounded-full border border-[#D6C5B3] bg-white px-3 py-2 text-xs font-semibold text-[#554238] transition-colors hover:bg-[#F9EEE3]"><ArrowLeft className="h-3.5 w-3.5" /> APY HQ</Link>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
      <GlassCard accent className="p-5 sm:p-6">
        <PawWatermark />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#7B432D]"><ShieldCheck className="h-4 w-4" /> Owner-only · aggregate reporting</div><h2 className="mt-2 font-display text-3xl font-bold leading-tight text-[#3D2E27]">Revenue reporting that keeps its confidence honest.</h2><p className="mt-2 text-sm leading-relaxed text-[#6D574A]">Every revenue value is labelled <strong>Estimated revenue</strong> until an authenticated Luma Stripe sales CSV is available. The dashboard returns no customer names, emails, phone numbers, payment details, or raw attendee records.</p></div>
          <div className="flex shrink-0 items-start gap-3"><div className="rounded-full border border-[#BE7755]/30 bg-white/65 px-3 py-2 font-mono text-xs text-[#75452F]">{data?.source.name ?? "Loading source"}</div><span className="rounded-full border border-[#D6C5B3] bg-white/80 px-3 py-2 text-xs font-semibold text-[#735E53]">Refreshes from Luma every 15 minutes</span></div>
        </div>
      </GlassCard>

      {overview.isLoading && <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-[#E6D8C7] bg-[#FFFCF7]" />)}</div>}

      {overview.error && <GlassCard className="border-rose-200 bg-rose-50 p-6"><div className="flex gap-3"><AlertCircle className="h-5 w-5 shrink-0 text-rose-700" /><div><h2 className="font-display text-xl text-rose-950">Dashboard access is unavailable</h2><p className="mt-1 text-sm text-rose-800">{overview.error.data?.code === "FORBIDDEN" ? "This route is restricted to the APY owner." : "Sign in through APY HQ with the owner account to open this private dashboard."}</p></div></div></GlassCard>}

      {data && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric icon={DollarSign} label="Estimated revenue" value={money(data.summary.estimatedRevenueCents)} note={data.summary.estimatedRevenueCents === null ? `${number(data.summary.estimatedRevenueEvents)}/${number(data.summary.pastEvents)} events fully covered` : "All eligible past classes covered"} accent="text-[#A95543]" />
          <Metric icon={Ticket} label="Tickets" value={number(data.summary.totalTickets)} note={data.summary.totalTickets === null ? `${number(data.summary.eventsWithTicketCount)}/${number(data.summary.pastEvents)} event counts available` : "All eligible past class counts"} accent="text-[#C96D56]" />
          <Metric icon={CalendarDays} label="Past classes" value={number(data.summary.pastEvents)} note="Public calendar records" accent="text-[#A96B33]" />
          <Metric icon={TrendingUp} label="Average tickets" value={data.summary.averageTicketsPerEvent?.toFixed(1) ?? "Not available"} note="Per eligible past class" accent="text-[#718367]" />
          <Metric icon={Clock3} label="Upcoming" value={number(data.summary.upcomingEvents)} note="Scheduled public classes" accent="text-[#5B8583]" />
        </div>

        <GlassCard className="border-amber-200 bg-[#FFF7E8] p-5"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="font-display text-lg text-[#5E3D1F]">Estimated revenue, not Stripe-confirmed revenue</h2><p className="mt-1 text-sm leading-relaxed text-[#72522E]">{data.source.revenueBasis} {data.source.note}</p></div></div></GlassCard>

        <div className="grid gap-4 xl:grid-cols-2">
          <GlassCard className="p-5"><PawWatermark /><h2 className="font-display text-xl font-bold">Monthly tickets</h2><p className="mt-1 text-xs text-[#806B60]">Public calendar ticket counts, latest 12 months</p><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="ticketsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#C96D56" stopOpacity={0.55} /><stop offset="95%" stopColor="#C96D56" stopOpacity={0.04} /></linearGradient></defs><CartesianGrid stroke="#E7DACB" strokeDasharray="3 3" /><XAxis dataKey="monthLabel" tick={{ fill: "#8C786C", fontSize: 10 }} tickLine={false} /><YAxis tick={{ fill: "#8C786C", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [number(value), "Tickets"]} /><Area type="monotone" dataKey="tickets" stroke="#C96D56" strokeWidth={2.5} fill="url(#ticketsFill)" /></AreaChart></ResponsiveContainer></div></GlassCard>
          <GlassCard className="p-5"><PawWatermark /><h2 className="font-display text-xl font-bold">Estimated revenue by month</h2><p className="mt-1 text-xs text-[#806B60]">Only shown where every class in the month has a usable public ticket price</p><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="#E7DACB" strokeDasharray="3 3" /><XAxis dataKey="monthLabel" tick={{ fill: "#8C786C", fontSize: 10 }} tickLine={false} /><YAxis tick={{ fill: "#8C786C", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`} /><Tooltip formatter={(value: number) => [money(value * 100), "Estimated revenue"]} /><Bar dataKey="estimatedRevenue" name="Estimated revenue" radius={[5, 5, 0, 0]} fill="#81916B" /></BarChart></ResponsiveContainer></div></GlassCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="p-5"><PawWatermark /><h2 className="font-display text-xl font-bold">Performance by location</h2><p className="mt-1 text-xs text-[#806B60]">Aggregate past class tickets only. {incompleteLocationCount ? `${incompleteLocationCount} location${incompleteLocationCount === 1 ? " is" : "s are"} withheld because a ticket count is unavailable.` : "All location ticket counts are available."}</p><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"><div className="h-52 w-full sm:w-1/2"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={locationData} dataKey="ticketValue" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={76} paddingAngle={4} strokeWidth={0}>{locationData.map(row => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip formatter={(value: number) => [number(value), "Tickets"]} /></PieChart></ResponsiveContainer></div><div className="space-y-2 sm:flex-1">{locationData.map(row => <div key={row.name} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />{row.name}</span><span className="font-mono text-xs text-[#806B60]">{number(row.tickets)} tickets</span></div>)}</div></div></GlassCard>
          <GlassCard className="p-5"><PawWatermark /><h2 className="font-display text-xl font-bold">Top breeds</h2><p className="mt-1 text-xs text-[#806B60]">Counted from public class titles, for internal planning. {incompleteBreedCount ? `${incompleteBreedCount} breed group${incompleteBreedCount === 1 ? " is" : "s are"} withheld for incomplete ticket data.` : ""}</p><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={breedData} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="#E7DACB" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fill: "#8C786C", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={120} tick={{ fill: "#6D574A", fontSize: 10 }} tickLine={false} /><Tooltip formatter={(value: number) => [number(value), "Tickets"]} /><Bar dataKey="ticketValue" name="Tickets" radius={[0, 5, 5, 0]}>{breedData.map((row, index) => <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div></GlassCard>
        </div>

        <GlassCard className="p-5"><PawWatermark /><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="font-display text-xl font-bold">Average ticket trend</h2><p className="mt-1 text-xs text-[#806B60]">Ticket count divided by public class records when every count is available</p></div><span className="font-mono text-xs text-[#806B60]">Public Luma calendar source</span></div><div className="mt-4 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="#E7DACB" strokeDasharray="3 3" /><XAxis dataKey="monthLabel" tick={{ fill: "#8C786C", fontSize: 10 }} tickLine={false} /><YAxis tick={{ fill: "#8C786C", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [value, "Average tickets"]} /><Line type="monotone" dataKey="averageTickets" stroke="#A95543" strokeWidth={3} dot={{ fill: "#D9A85D", r: 3, strokeWidth: 0 }} /></LineChart></ResponsiveContainer></div></GlassCard>

        <GlassCard className="p-5"><PawWatermark /><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Instagram className="h-5 w-5 text-[#C96D56]" /><h2 className="font-display text-xl font-bold">Instagram snapshot</h2></div><p className="mt-1 text-sm leading-relaxed text-[#806B60]">{data.instagram.message}</p></div><span className="rounded-full border border-[#E6D8C7] bg-[#F9EEE3] px-3 py-1 text-xs font-semibold text-[#735E53]">Verified data only</span></div></GlassCard>

        {data.upcomingEvents.length > 0 && <section><h2 className="mb-3 font-display text-2xl font-bold">Upcoming demand</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.upcomingEvents.map(event => <GlassCard key={event.id} className="p-4"><PawWatermark /><p className="font-mono text-[11px] text-[#A96B33]">{event.date}</p><p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{event.name}</p><p className="mt-3 flex items-center gap-1 text-xs text-[#806B60]"><MapPin className="h-3 w-3" />{event.location}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#806B60]"><Users className="h-3 w-3" />{event.breed}</p></GlassCard>)}</div></section>}

        <section><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-2xl font-bold">Recent past classes</h2><p className="mt-1 text-xs text-[#806B60]">Aggregate event rows with no customer or attendee fields</p></div><label className="text-xs font-semibold text-[#735E53]">Location <select value={selectedLocation} onChange={event => setSelectedLocation(event.target.value)} className="ml-2 rounded-lg border border-[#D6C5B3] bg-white px-2 py-1.5 text-[#3D2E27]"><option>All locations</option>{data.byLocation.map(location => <option key={location.name}>{location.name}</option>)}</select></label></div><GlassCard className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[#E6D8C7] bg-[#FBF5EE]"><tr className="text-[10px] uppercase tracking-widest text-[#806B60]"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Breed</th><th className="px-4 py-3 text-right">Tickets</th><th className="px-4 py-3 text-right">Estimated revenue</th></tr></thead><tbody>{recentEvents.map(event => <tr key={event.id} className="border-b border-[#F0E5D9] last:border-0"><td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#806B60]">{event.date}</td><td className="max-w-xs px-4 py-3 font-medium">{event.name}</td><td className="px-4 py-3 text-[#735E53]">{event.location}</td><td className="px-4 py-3 text-[#735E53]">{event.breed}</td><td className="px-4 py-3 text-right font-mono">{number(event.tickets)}</td><td className="px-4 py-3 text-right font-mono text-[#A95543]">{event.estimatedRevenueCents === null ? "Not available" : money(event.estimatedRevenueCents)}</td></tr>)}{recentEvents.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#806B60]">No past public class records match this location.</td></tr>}</tbody></table></div></GlassCard></section>

        <footer className="border-t border-[#E6D8C7] py-5 text-center text-xs text-[#806B60]">Private APY owner dashboard · {data.source.name} · Last refreshed {timestamp(data.source.refreshedAt)} · Revenue status: Estimated until an authenticated Luma Stripe CSV is available.</footer>
      </>}
    </main>
  </div>;
}
