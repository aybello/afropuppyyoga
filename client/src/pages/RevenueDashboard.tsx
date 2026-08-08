import { useState, useMemo } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { DollarSign, Users, CalendarDays, TrendingUp, MapPin, ExternalLink } from "lucide-react";

const LOCATION_COLORS: Record<string, string> = {
  Kitchener: "#8B2252",
  Hamilton:  "#C4627A",
  Oakville:  "#E8A0B4",
  Other:     "#D4B5C0",
};

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtMonth(ym: string) {
  // "2026-08" → "Aug 2026"
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
}

const RANGES = [
  { label: "Last 3 months", months: 3 },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "All time", months: 999 },
];

export default function RevenueDashboard() {
  const [rangeMonths, setRangeMonths] = useState(6);

  const fromDate = useMemo(() => {
    if (rangeMonths === 999) return "2025-01-01";
    const d = new Date();
    d.setMonth(d.getMonth() - rangeMonths);
    return d.toISOString().slice(0, 10);
  }, [rangeMonths]);

  const { data, isLoading, error } = trpc.revenue.getSummary.useQuery(
    { fromDate },
    { staleTime: 5 * 60 * 1000 } // cache 5 min — Luma API is slow
  );

  const monthChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cents]) => ({ month: fmtMonth(month), revenue: cents / 100 }));
  }, [data]);

  const locationChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byLocation)
      .map(([loc, cents]) => ({ name: loc, value: cents / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const topTickets = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byTicketType)
      .map(([name, val]) => ({ name, count: val.count, revenue: val.revenueCents / 100 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [data]);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-[#1A0A12]">Revenue Dashboard</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">Live data from Luma — bookings, revenue, and class performance</p>
          </div>
          <Select value={String(rangeMonths)} onValueChange={v => setRangeMonths(Number(v))}>
            <SelectTrigger className="w-44 font-body border-[#F0D0DC]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map(r => (
                <SelectItem key={r.months} value={String(r.months)} className="font-body">{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-body text-sm mb-8">
            Failed to load revenue data: {error.message}
          </div>
        )}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#FFF0F4] flex items-center justify-center">
                      <DollarSign size={16} className="text-[#8B2252]" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Total Revenue</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">{fmt(data.totalRevenueCents)}</p>
                  <p className="font-body text-xs text-[#C4A0B0] mt-1">CAD incl. tax</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#FFF0F4] flex items-center justify-center">
                      <Users size={16} className="text-[#8B2252]" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Total Guests</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">{data.totalGuests.toLocaleString()}</p>
                  <p className="font-body text-xs text-[#C4A0B0] mt-1">{data.totalCheckedIn} checked in</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#FFF0F4] flex items-center justify-center">
                      <CalendarDays size={16} className="text-[#8B2252]" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Events</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">{data.totalEvents}</p>
                  <p className="font-body text-xs text-[#C4A0B0] mt-1">in selected period</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#FFF0F4] flex items-center justify-center">
                      <TrendingUp size={16} className="text-[#8B2252]" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Avg per Event</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">
                    {data.totalEvents > 0 ? fmt(Math.round(data.totalRevenueCents / data.totalEvents)) : "$0"}
                  </p>
                  <p className="font-body text-xs text-[#C4A0B0] mt-1">revenue per class</p>
                </CardContent>
              </Card>
            </div>

            {/* Public vs Private split */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-4 pb-4 flex items-center gap-4">
                  <div className="w-3 h-10 rounded-full bg-[#8B2252]" />
                  <div>
                    <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Public Classes</p>
                    <p className="font-display text-xl text-[#1A0A12]">{fmt(data.publicRevenueCents)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-4 pb-4 flex items-center gap-4">
                  <div className="w-3 h-10 rounded-full bg-[#E8A0B4]" />
                  <div>
                    <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Private Events</p>
                    <p className="font-display text-xl text-[#1A0A12]">{fmt(data.privateRevenueCents)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Monthly revenue bar chart */}
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base text-[#1A0A12]">Revenue by Month</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthChartData.length === 0 ? (
                    <p className="font-body text-sm text-[#C4A0B0] text-center py-8">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "inherit" }} />
                        <YAxis tick={{ fontSize: 11, fontFamily: "inherit" }} tickFormatter={v => `$${v}`} />
                        <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                        <Bar dataKey="revenue" fill="#8B2252" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Revenue by location pie */}
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base text-[#1A0A12]">Revenue by Location</CardTitle>
                </CardHeader>
                <CardContent>
                  {locationChartData.length === 0 ? (
                    <p className="font-body text-sm text-[#C4A0B0] text-center py-8">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={locationChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {locationChartData.map((entry) => (
                            <Cell key={entry.name} fill={LOCATION_COLORS[entry.name] ?? "#D4B5C0"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top ticket types */}
            <Card className="bg-white border-[#F0D0DC] rounded-2xl mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base text-[#1A0A12]">Top Ticket Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topTickets.map(t => (
                    <div key={t.name} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-body text-sm text-[#1A0A12] truncate">{t.name}</span>
                          <span className="font-body text-sm font-semibold text-[#8B2252] ml-2 shrink-0">{fmt(t.revenue * 100)}</span>
                        </div>
                        <div className="w-full bg-[#F0D0DC] rounded-full h-1.5">
                          <div
                            className="bg-[#8B2252] h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (t.revenue / (topTickets[0]?.revenue || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="outline" className="font-body text-xs border-[#F0D0DC] shrink-0">{t.count} sold</Badge>
                    </div>
                  ))}
                  {topTickets.length === 0 && <p className="font-body text-sm text-[#C4A0B0] text-center py-4">No ticket data yet</p>}
                </div>
              </CardContent>
            </Card>

            {/* Event breakdown table */}
            <Card className="bg-white border-[#F0D0DC] rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base text-[#1A0A12]">All Events</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full font-body text-sm">
                    <thead>
                      <tr className="border-b border-[#F0D0DC]">
                        <th className="text-left px-5 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide font-semibold">Event</th>
                        <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide font-semibold">Date</th>
                        <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide font-semibold">Location</th>
                        <th className="text-right px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide font-semibold">Guests</th>
                        <th className="text-right px-5 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide font-semibold">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map(ev => (
                        <tr key={ev.eventId} className="border-b border-[#F0D0DC] last:border-0 hover:bg-[#FFF8FB] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[#1A0A12] font-medium truncate max-w-[220px]">{ev.eventName}</span>
                              {ev.isPrivate && <Badge className="text-xs bg-[#F0D0DC] text-[#8B2252] border-0 shrink-0">Private</Badge>}
                              <a href={ev.eventUrl} target="_blank" rel="noopener noreferrer" className="text-[#C4A0B0] hover:text-[#8B2252] shrink-0">
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[#6B4C3B] whitespace-nowrap">
                            {new Date(ev.startAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 text-[#6B4C3B]">
                              <MapPin size={11} className="text-[#8B2252]" />{ev.location}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-[#6B4C3B]">{ev.totalGuests}</td>
                          <td className="px-5 py-3 text-right font-semibold text-[#8B2252]">{fmt(ev.revenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
