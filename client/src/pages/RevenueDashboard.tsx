import { useMemo, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  Wallet,
  MapPin,
  Calendar,
  Ticket,
  Clock,
  Users,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function fmt(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

function firstDayOfRange(months: number) {
  const now = new Date();
  if (months === 999) return undefined;
  const d = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return d.toISOString().slice(0, 10);
}

const RANGES = [
  { label: "Last 3 months", months: 3 },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "All time", months: 999 },
];

export default function RevenueDashboard() {
  const [rangeMonths, setRangeMonths] = useState(6);
  const fromDate = useMemo(() => firstDayOfRange(rangeMonths), [rangeMonths]);

  const { data, isLoading, error } = trpc.revenue.getSummary.useQuery(
    { fromDate },
    { staleTime: 5 * 60 * 1000, retry: 2 },
  );

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl text-[#1A0A12]">Sales & Revenue</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">
              Live data from Stripe{data ? ` · ${data.chargesAnalyzed} transactions analyzed` : ""}
            </p>
          </div>
          <Select value={String(rangeMonths)} onValueChange={v => setRangeMonths(Number(v))}>
            <SelectTrigger className="w-44 font-body border-[#F0D0DC] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map(r => (
                <SelectItem key={r.months} value={String(r.months)} className="font-body">{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-body text-sm mb-8">
            <p className="font-semibold">Failed to load revenue data</p>
            <p className="mt-1">{error.message}</p>
          </div>
        )}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign size={16} className="text-green-700" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Total Revenue</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">{fmt(data.summary.totalRevenueCents)}</p>
                  <p className="font-body text-xs text-[#9B7A69] mt-1">net: {fmt(data.summary.totalNetCents)}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <CreditCard size={16} className="text-blue-700" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Transactions</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">{data.summary.totalTransactions}</p>
                  <p className="font-body text-xs text-[#9B7A69] mt-1">refunded: {fmt(data.summary.totalRefundedCents)}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <TrendingUp size={16} className="text-purple-700" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Avg Transaction</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">{fmt(data.summary.avgTransactionCents)}</p>
                  <p className="font-body text-xs text-[#9B7A69] mt-1">per booking</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <Wallet size={16} className="text-amber-700" />
                    </div>
                    <span className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Stripe Balance</span>
                  </div>
                  <p className="font-display text-2xl text-[#1A0A12]">{fmt(data.summary.availableBalanceCents + data.summary.pendingBalanceCents)}</p>
                  <p className="font-body text-xs text-[#9B7A69] mt-1">{fmt(data.summary.pendingBalanceCents)} pending</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue by Location & Monthly */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base text-[#1A0A12] flex items-center gap-2">
                    <MapPin size={16} /> Revenue by Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.byLocation.map(loc => {
                      const pct = data.summary.totalRevenueCents > 0 ? (loc.revenueCents / data.summary.totalRevenueCents) * 100 : 0;
                      return (
                        <div key={loc.location}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{loc.location}</span>
                            <span className="text-[#6B4C3B]">{fmt(loc.revenueCents)} ({loc.transactions} txns)</span>
                          </div>
                          <div className="h-2 bg-[#F6E6EC] rounded-full overflow-hidden">
                            <div className="h-full bg-[#8B2252] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {data.byLocation.length === 0 && <p className="text-sm text-[#9B7A69]">No location data.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base text-[#1A0A12] flex items-center gap-2">
                    <Calendar size={16} /> Monthly Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.byMonth.slice(-6).map(m => {
                      const maxRevenue = Math.max(...data.byMonth.map(x => x.revenueCents), 1);
                      const pct = (m.revenueCents / maxRevenue) * 100;
                      const monthLabel = new Date(m.month + "-01").toLocaleDateString("en-CA", { month: "short", year: "numeric" });
                      return (
                        <div key={m.month}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{monthLabel}</span>
                            <span className="text-[#6B4C3B]">{fmt(m.revenueCents)} ({m.transactions} txns)</span>
                          </div>
                          <div className="h-2 bg-[#F6E6EC] rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {data.byMonth.length === 0 && <p className="text-sm text-[#9B7A69]">No monthly data.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Public vs Private */}
            {data.byEventType.length > 0 && (
              <Card className="bg-white border-[#F0D0DC] rounded-2xl mb-8">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base text-[#1A0A12]">Public vs Private Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {data.byEventType.map(et => (
                      <div key={et.type} className="text-center p-4 bg-[#FFF0F4] rounded-xl">
                        <p className="text-sm text-[#6B4C3B] capitalize">{et.type} Classes</p>
                        <p className="font-display text-xl text-[#1A0A12] mt-1">{fmt(et.revenueCents)}</p>
                        <p className="text-xs text-[#9B7A69]">{et.transactions} transactions</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ticket Types & Time Slots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {data.byTicketType && data.byTicketType.length > 0 && (
                <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base text-[#1A0A12] flex items-center gap-2">
                      <Ticket size={16} /> Top Ticket Types
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.byTicketType.slice(0, 8).map(t => (
                        <div key={t.name} className="flex items-center justify-between gap-4 border-b border-[#F6E6EC] pb-2 last:border-0">
                          <div className="min-w-0">
                            <p className="font-body text-sm text-[#1A0A12] truncate">{t.name}</p>
                            <p className="font-body text-xs text-[#9B7A69]">{t.count} sold</p>
                          </div>
                          <span className="font-display text-base text-[#8B2252] shrink-0">{fmt(t.revenueCents)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {data.byTimeSlot && data.byTimeSlot.length > 0 && (
                <Card className="bg-white border-[#F0D0DC] rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base text-[#1A0A12] flex items-center gap-2">
                      <Clock size={16} /> Class Time Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.byTimeSlot.map(s => (
                        <div key={s.slot} className="flex items-center justify-between gap-4 border-b border-[#F6E6EC] pb-2 last:border-0">
                          <div>
                            <p className="font-display text-base text-[#1A0A12]">{s.slot}</p>
                            <p className="font-body text-xs text-[#9B7A69]">{s.count} tickets sold</p>
                          </div>
                          <span className="font-display text-base text-[#8B2252]">{fmt(s.revenueCents)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent Transactions */}
            <Card className="bg-white border-[#F0D0DC] rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base text-[#1A0A12]">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full font-body text-sm">
                    <thead>
                      <tr className="border-b border-[#F0D0DC]">
                        <th className="text-left px-5 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Date</th>
                        <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Event</th>
                        <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Location</th>
                        <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Customer</th>
                        <th className="text-right px-5 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTransactions.map(tx => (
                        <tr key={tx.id} className="border-b border-[#F6E6EC] last:border-0 hover:bg-[#FFF8FA]">
                          <td className="px-5 py-3 text-[#9B7A69]">{new Date(tx.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</td>
                          <td className="px-3 py-3 max-w-[200px] truncate">{tx.description}</td>
                          <td className="px-3 py-3"><span className="px-2 py-0.5 bg-[#FFF0F4] rounded text-xs text-[#8B2252]">{tx.location}</span></td>
                          <td className="px-3 py-3 text-[#9B7A69] truncate max-w-[150px]">{tx.customerName || tx.customerEmail || "—"}</td>
                          <td className="px-5 py-3 text-right font-display text-[#8B2252]">{fmt(tx.amount)}</td>
                        </tr>
                      ))}
                      {data.recentTransactions.length === 0 && (
                        <tr><td colSpan={5} className="px-5 py-8 text-center text-[#9B7A69]">No transactions in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Luma Attendance Section */}
        <LumaAttendanceSection fromDate={fromDate} />
      </div>
    </div>
  );
}

function LumaAttendanceSection({ fromDate }: { fromDate: string | undefined }) {
  const { data, isLoading, error, refetch, isFetching } = trpc.revenue.getLumaAttendance.useQuery(
    { fromDate },
    { enabled: false, retry: 1 },
  );

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-xl text-[#1A0A12] flex items-center gap-2">
            <Users size={20} /> Luma Attendance
          </h2>
          <p className="font-body text-xs text-[#9B7A69] mt-1">Guest registrations and check-ins from Luma (fetched on demand)</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-[#F0D0DC] text-[#8B2252] hover:bg-[#FFF0F4]"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin mr-2" : "mr-2"} />
          {isFetching ? "Loading..." : data ? "Refresh" : "Load Luma Data"}
        </Button>
      </div>

      {isLoading && isFetching && (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-body text-sm">
          <p className="font-semibold">Luma data unavailable</p>
          <p className="mt-1">{error.message}</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-[#F0D0DC] rounded-2xl">
              <CardContent className="pt-5 pb-4">
                <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Events</p>
                <p className="font-display text-2xl text-[#1A0A12] mt-1">{data.totalEvents}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#F0D0DC] rounded-2xl">
              <CardContent className="pt-5 pb-4">
                <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Total Guests</p>
                <p className="font-display text-2xl text-[#1A0A12] mt-1">{data.totalGuests.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#F0D0DC] rounded-2xl">
              <CardContent className="pt-5 pb-4">
                <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Checked In</p>
                <p className="font-display text-2xl text-[#1A0A12] mt-1">{data.totalCheckedIn.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#F0D0DC] rounded-2xl">
              <CardContent className="pt-5 pb-4">
                <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wide">Attendance Rate</p>
                <p className="font-display text-2xl text-[#1A0A12] mt-1">{(data.attendanceRate * 100).toFixed(0)}%</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-[#F0D0DC] rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base text-[#1A0A12]">Event Attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full font-body text-sm">
                  <thead>
                    <tr className="border-b border-[#F0D0DC]">
                      <th className="text-left px-5 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Event</th>
                      <th className="text-left px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Date</th>
                      <th className="text-right px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Guests</th>
                      <th className="text-right px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Checked In</th>
                      <th className="text-center px-3 py-3 text-xs text-[#6B4C3B] uppercase tracking-wide">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.eventAttendance.map((ev, i) => (
                      <tr key={i} className="border-b border-[#F6E6EC] last:border-0 hover:bg-[#FFF8FA]">
                        <td className="px-5 py-3 max-w-[250px] truncate">{ev.name}</td>
                        <td className="px-3 py-3 text-[#9B7A69]">{new Date(ev.date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="px-3 py-3 text-right font-medium">{ev.guests}</td>
                        <td className="px-3 py-3 text-right font-medium">{ev.checkedIn}</td>
                        <td className="px-3 py-3 text-center">
                          {ev.url && (
                            <a href={`https://lu.ma/${ev.url}`} target="_blank" rel="noopener noreferrer" className="text-[#8B2252] hover:underline">
                              <ExternalLink size={14} className="inline" />
                            </a>
                          )}
                        </td>
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
  );
}
