"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ReportsOverview as Overview } from "@/lib/reports/overview";

const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
const short = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{usd(payload[0].value)} collected</p>
    </div>
  );
}

function CollectedChart({ data, xKey }: { data: Array<Record<string, string | number>>; xKey: string }) {
  const empty = data.every((d) => !Number(d.collected));
  if (empty) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No payments recorded yet.</p>;
  }
  return (
    <div className="h-56 text-[#2a78d6] dark:text-[#3987e5]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke="currentColor" className="text-border" strokeOpacity={1} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={short} tick={{ fill: "var(--muted-foreground)" }} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar dataKey="collected" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportsOverview({ data }: { data: Overview }) {
  const seasonLabel = `${data.season}–${String((data.season + 1) % 100).padStart(2, "0")} season`;
  const collectedPct = data.invoicedThisSeason > 0 ? Math.round((data.collectedThisSeason / data.invoicedThisSeason) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Collected · ${seasonLabel}`}
          value={usd(data.collectedThisSeason)}
          sub={collectedPct != null ? `${collectedPct}% of ${usd(data.invoicedThisSeason)} invoiced` : "Nothing invoiced yet"}
        />
        <Stat
          label="Outstanding balance"
          value={usd(data.outstanding)}
          sub={data.overdueCount ? `${usd(data.overdue)} overdue on ${data.overdueCount} invoice${data.overdueCount === 1 ? "" : "s"}` : "Nothing overdue"}
        />
        <Stat
          label="Estimate close rate"
          value={data.estimateCloseRate != null ? `${Math.round(data.estimateCloseRate * 100)}%` : "—"}
          sub={
            data.estimatesDecided
              ? `${data.estimatesDecided} decided · ${usd(data.openEstimateValue)} still open`
              : data.openEstimateValue
                ? `${usd(data.openEstimateValue)} waiting on customers`
                : "No estimates decided yet"
          }
        />
        <Stat
          label={`Installs · ${seasonLabel}`}
          value={`${data.installsDone} done`}
          sub={`${data.installsScheduled} scheduled · ${data.removalsOpen} removals open`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Collected by season</CardTitle>
            <CardDescription className="text-xs">Seasons run Aug 1 – Jul 31</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectedChart data={data.bySeason} xKey="season" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Collected by month</CardTitle>
            <CardDescription className="text-xs">Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectedChart data={data.byMonth} xKey="month" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Who owes you</CardTitle>
            <CardDescription className="text-xs">Overdue first, then largest balance</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.topOutstanding.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Every invoice is paid up.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.topOutstanding.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">
                        <Link href={`/invoices/${r.id}`} className="font-medium hover:underline">{r.customer}</Link>
                        <p className="text-xs text-muted-foreground">
                          {r.number}
                          {r.dueDate ? ` · due ${new Date(r.dueDate + "T12:00:00").toLocaleDateString()}` : ""}
                          {r.overdue && <span className="ml-1 font-medium text-destructive">· overdue</span>}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{usd(r.balance, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top customers</CardTitle>
            <CardDescription className="text-xs">Total paid, all time</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.topCustomers.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.topCustomers.map((c) => (
                    <tr key={c.name} className="border-t">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{usd(c.paid, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
