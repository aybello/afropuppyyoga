import { useMemo, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  DollarSign,
  Users,
  CalendarDays,
  TrendingUp,
  ExternalLink,
  Percent,
  ReceiptText,
  AlertTriangle,
} from "lucide-react";

const LOCATION_COLORS: Record<string, string> = {
  Kitchener: "#8B2252",
  Hamilton: "#C4627A",
  Oakville: "#E8A0B4",
  Waterloo: "#9A516F",
  Cambridge: "#B87790",
  Milton: "#D29AAF",
  Mississauga: "#E6BCCB",
  Other: "#D4B5C0",
};

function fmt(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtMonth(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
  });
}

function firstDayOfRange(months: number) {
  const now = new Date();
  if (months === 999) return "2024-08-22";
  const d = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return d.toISOString().slice(0, 10);
}

const RANGES = [
  { label: "Last 3 months", months: 3 },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "All time", months: 999 },
];

function KpiCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card className="bg-white border-[#F0D0DC] rounded-2xl">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#FFF0F4] flex items-center justify-center text-[#8B2252]">
            {icon}
          </div>
          <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">{label}</span>
        </div>
        <p className="font-display text-2xl text-[#1A0A12]">{value}</p>
        <p className="font-body text-xs text-[#9B7A69] mt-1">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

export default function RevenueDashboard() {
  const [rangeMonths, setRangeMonths] = useState(6);
  const fromDate = useMemo(() => firstDayOfRange(rangeMonths), [rangeMonths]);

  const { data, isLoading, error } = trpc.revenue.getSummary.useQuery(
    { fromDate },
    {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      retryDelay: 1500,
    },
  );

  const monthChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cents]) => ({ month: fmtMonth(month), sales: cents / 100 }));
  }, [data]);

  const locationChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byLocation)
      .map(([name, cents]) => ({ name, value: cents / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const topTickets = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byTicketType)
      .map(([name, value]) => ({
        name,
        count: value.count,
        sales: value.ticketSalesCents / 100,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [data]);

  const classSlots = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byClassSlot)
      .map(([slot, value]) => ({
        slot,
        tickets: value.tickets,
        sales: value.ticketSalesCents / 100,
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [data]);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl text-[#1A0A12]">Sales & Revenue</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">
              Operational sales analytics from captured Luma tickets
            </p>
          </div>
          <Select value={String(rangeMonths)} onValueChange={value => setRangeMonths(Number(value))}>
            <SelectTrigger className="w-44 font-body border-[#F0D0DC] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map(range => (
                <SelectItem key={range.months} value={String(range.months)} className="font-body">
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex gap-3">
          <AlertTriangle size={18} className="text-amber-700 mt-0.5 shrink-0" />
          <div className="font-body text-sm text-amber-900">
            <p className="font-semibold">This dashboard is operational sales analytics, not accounting net revenue.</p>
            <p className="mt-0.5">
              Captured ticket sales, discounts and tax come from Luma guest-ticket data. Refunds, Stripe/Luma fees and payout net are not included here.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(8)].map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-body text-sm mb-8">
            Revenue data was not loaded because Luma returned an error. No partial totals are being shown. {error.message}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard
                icon={<DollarSign size={16} />}
                label="Captured Ticket Sales"
                value={fmt(data.totalTicketSalesCents)}
                sublabel="after discounts, before tax"
              />
              <KpiCard
                icon={<ReceiptText size={16} />}
                label="Tax Collected"
                value={fmt(data.totalTaxCents)}
                sublabel={`customer paid ${fmt(data.totalCustomerPaidCents)}`}
              />
              <KpiCard
                icon={<Percent size={16} />}
                label="Discounts"
                value={fmt(data.totalDiscountCents)}
                sublabel="discount value recorded by Luma"
              />
              <KpiCard
                icon={<Users size={16} />}
                label="Guests"
                value={data.totalGuests.toLocaleString()}
                sublabel={`${data.totalCheckedIn.toLocaleString()} checked in · ${(data.attendanceRate * 100).toFixed(0)}% attendance`}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KpiCard
                icon={<CalendarDays size={16} />}
                label="Luma Events"
                value={data.totalEvents.toLocaleString()}
                sublabel="event listings in selected period"
              />
              <KpiCard
                icon={<CalendarDays size={16} />}
                label="Class Sessions"
                value={data.totalClassSessions.toLocaleString()}
                sublabel="time slots detected from ticket names"
              />
              <KpiCard
                icon={<TrendingUp size={16} />}
                label="Avg Ticket"
                value={fmt(data.avgTicketCents)}
                sublabel={`${data.totalCapturedTickets.toLocaleString()} captured tickets`}
              />
              <KpiCard
                icon={<TrendingUp size={16} />}
                label="Avg per Class"
                value={fmt(data.avgPerClassCents)}
                sublabel={data.avgPerClassCents == null ? "class slots could not be detected" : "captured ticket sales per detected class"}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base text-[#1A0A12]">Ticket Sales by Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={value => `$${Number(value).toLocaleString()}`} />
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Ticket sales"]} />
                      <Bar dataKey="sales" fill="#8B2252" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base text-[#1A0A12]">Ticket Sales by Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={locationChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={82}
                        label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {locationChartData.map(entry => (
                          <Cell key={entry.name} fill={LOCATION_COLORS[entry.name] ?? "#D4B5C0"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Ticket sales"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base text-[#1A0A12]">Top Ticket Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topTickets.map(ticket => (
                      <div key={ticket.name} className="flex items-center justify-between gap-4 border-b border-[#F6E6EC] pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="font-body text-sm text-[#1A0A12] truncate">{ticket.name}</p>
                          <p className="font-body text-xs text-[#9B7A69]">{ticket.count} captured</p>
                        </div>
                        <span className="font-display text-base text-[#8B2252] shrink-0">
                          ${ticket.sales.toLocaleString("en-CA", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                    {topTickets.length === 0 && <p className="font-body text-sm text-[#9B7A69]">No ticket data.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base text-[#1A0A12]">Class Time Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {classSlots.map(slot => (
                      <div key={slot.slot} className="flex items-center justify-between gap-4 border-b border-[#F6E6EC] pb-2 last:border-0">
                        <div>
                          <p className="font-display text-base text-[#1A0A12]">{slot.slot}</p>
                          <p className="font-body text-xs text-[#9B7A69]">{slot.tickets} captured tickets</p>
                        </div>
                        <span className="font-display text-base text-[#8B2252]">
                          ${slot.sales.toLocaleString("en-CA", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                    {classSlots.length === 0 && (
                      <p className="font-body text-sm text-[#9B7A69]">
                        No class times could be parsed from the ticket names in this period.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-[#F0D0DC] rounded-2xl mb-8">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="font-display text-base text-[#1A0A12]">Event Breakdown</CardTitle>
                <Badge variant="outline" className="font-body border-[#F0D0DC]">
                  {data.range.fromDate} → {data.range.toDate}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full font-body text-sm">
                    <thead>
                      <tr className="border-b border-[#F0D0DC]">
                        <th className="text-left px-5 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Event</th>
                        <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Date</th>
                        <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Location</th>
                        <th className="text-center px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Classes</th>
                        <th className="text-right px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Guests</th>
                        <th className="text-right px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Tax</th>
                        <th className="text-right px-5 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Ticket Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map(event => (
                        <tr key={event.eventId} className="border-b border-[#F0D0DC] last:border-0 hover:bg-[#FFF8FB]">
                          <td className="px-5 py-3 max-w-[310px]">
                            <div className="flex items-center gap-2">
                              <a
                                href={event.eventUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#1A0A12] hover:text-[#8B2252] truncate"
                              >
                                {event.eventName}
                              </a>
                              <ExternalLink size={12} className="text-[#C4A0B0] shrink-0" />
                            </div>
                            <p className="text-xs text-[#9B7A69] mt-0.5">{event.eventType} · {event.capturedTickets} captured tickets</p>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-[#6B4C3B]">
                            {new Date(event.startAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-3 py-3 text-[#6B4C3B]">{event.location}</td>
                          <td className="px-3 py-3 text-center text-[#6B4C3B]">{event.classSessions || "—"}</td>
                          <td className="px-3 py-3 text-right text-[#6B4C3B]">
                            {event.totalGuests}
                            <span className="text-xs text-[#B29182]"> / {event.checkedInGuests} in</span>
                          </td>
                          <td className="px-3 py-3 text-right text-[#6B4C3B]">{fmt(event.taxCents)}</td>
                          <td className="px-5 py-3 text-right font-semibold text-[#1A0A12]">{fmt(event.ticketSalesCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="font-body text-xs text-[#8E7467] pb-4">
              Generated {new Date(data.generatedAt).toLocaleString("en-CA")}. Event type is inferred from Luma visibility and event naming. Class count is inferred from distinct time slots in captured ticket names.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
