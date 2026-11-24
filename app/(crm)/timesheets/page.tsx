import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { loadBusinessRules } from "@/lib/schedule-server";
import { addDays } from "@/lib/schedule";
import { EditDayTimes } from "@/components/timesheets/edit-day-times";
import { TimeFixRequests } from "@/components/timesheets/time-fix-requests";

import { mergedHours } from "@/lib/time-math";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timesheets - RedFox CRM" };

type Entry = {
  id: string;
  edited_at: string | null;
  edit_note: string | null;
  original_clock_in: string | null;
  original_clock_out: string | null;
  employee_id: string;
  scheduled_job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
  location_clock_in: string | null;
  location_clock_out: string | null;
};

const mapLink = (loc: string | null) =>
  loc && /^-?\d+\.\d+,-?\d+\.\d+$/.test(loc) ? `https://www.google.com/maps?q=${encodeURIComponent(loc)}` : null;

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; week?: string; emp?: string }>;
}) {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");
  if (!["owner", "admin", "manager"].includes(String(org.role ?? "").toLowerCase())) redirect("/dashboard");
  const { days: daysParam, week: weekParam, emp: empFilter } = await searchParams;
  const days = Math.min(62, Math.max(7, Number(daysParam) || 14));

  const db = createAdminClient();
  const rules = await loadBusinessRules(db, org.orgId);
  const tz = rules.timezone;
  const since = addDays(rules.today, -days + 1);
  const [{ data: entries }, { data: employees }] = await Promise.all([
    db
      .from("time_entries")
      .select("id, employee_id, scheduled_job_id, clock_in, clock_out, total_hours, location_clock_in, location_clock_out, edited_at, edit_note, original_clock_in, original_clock_out")
      .eq("org_id", org.orgId)
      .gte("clock_in", `${addDays(since, -1)}T00:00:00Z`)
      .order("clock_in", { ascending: true })
      .limit(5000),
    db.from("employees").select("id, full_name, first_name, last_name, email, hourly_rate, is_active").eq("org_id", org.orgId),
  ]);
  const nameOf = new Map<string, string>(
    (employees ?? []).map((e: any) => [e.id, e.full_name?.trim() || [e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || "Employee"]),
  );
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  const hhmm = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
  const timeOf = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) : "—";
  const now = Date.now();

  // Group by day + employee.
  const rows = new Map<string, { day: string; employeeId: string; shifts: Entry[]; jobs: Entry[] }>();
  for (const e of (entries ?? []) as Entry[]) {
    const day = dayOf(e.clock_in);
    if (day < since) continue;
    const key = `${day}|${e.employee_id}`;
    const r = rows.get(key) ?? { day, employeeId: e.employee_id, shifts: [], jobs: [] };
    (e.scheduled_job_id ? r.jobs : r.shifts).push(e);
    rows.set(key, r);
  }
  const list = [...rows.values()].filter((r) => !empFilter || r.employeeId === empFilter).sort((a, b) => (a.day === b.day ? (nameOf.get(a.employeeId) ?? "").localeCompare(nameOf.get(b.employeeId) ?? "") : b.day.localeCompare(a.day)));
  const totals = new Map<string, number>();
  for (const r of list) {
    const h = mergedHours(r.shifts.length ? r.shifts : r.jobs, now);
    totals.set(r.employeeId, (totals.get(r.employeeId) ?? 0) + h);
  }

  // Pay week grid: Mon–Sun, one row per person, hours per day, total and pay.
  const weekday = new Date(`${rules.today}T12:00:00Z`).getUTCDay(); // 0 = Sun
  const thisMonday = addDays(rules.today, -((weekday + 6) % 7));
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? "") ? weekParam! : thisMonday;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { data: weekEntries } = await db
    .from("time_entries")
    .select("employee_id, scheduled_job_id, clock_in, clock_out, break_minutes")
    .eq("org_id", org.orgId)
    .gte("clock_in", `${addDays(weekStart, -1)}T00:00:00Z`)
    .lt("clock_in", `${addDays(weekStart, 8)}T12:00:00Z`)
    .limit(5000);
  const byPersonDay = new Map<string, { shifts: any[]; jobs: any[] }>();
  for (const e of weekEntries ?? []) {
    const d = dayOf(e.clock_in);
    if (d < weekDays[0] || d > weekDays[6]) continue;
    const k = `${e.employee_id}|${d}`;
    const v = byPersonDay.get(k) ?? { shifts: [], jobs: [] };
    (e.scheduled_job_id ? v.jobs : v.shifts).push(e);
    byPersonDay.set(k, v);
  }
  const rateOf = new Map<string, number>((employees ?? []).map((e: any) => [e.id, Number(e.hourly_rate ?? 0)]));
  const weekRows = [...new Set((weekEntries ?? []).map((e) => e.employee_id as string))]
    .map((id) => {
      const perDay = weekDays.map((d) => {
        const v = byPersonDay.get(`${id}|${d}`);
        if (!v) return { hours: 0, open: false };
        return { hours: mergedHours(v.shifts.length ? v.shifts : v.jobs, now), open: v.shifts.some((x) => !x.clock_out) };
      });
      const total = perDay.reduce((a, b) => a + Math.round(b.hours * 100) / 100, 0);
      const rate = rateOf.get(id) ?? 0;
      return { id, name: nameOf.get(id) ?? "Employee", perDay, total, rate, pay: total * rate };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const hm = (h: number) => {
    const m = Math.round(h * 60);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  };
  const weekLabel = `${new Date(`${weekDays[0]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(`${weekDays[6]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const { data: fixRows } = await db
    .from("time_fix_requests")
    .select("id, employee_id, day, start_time, end_time, lunch_start, lunch_end, reason")
    .eq("org_id", org.orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const clock = (t: string | null) => {
    if (!t) return "?";
    const [h, m] = t.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  const fixRequests = (fixRows ?? []).map((r: any) => ({
    id: r.id,
    employeeName: nameOf.get(r.employee_id) ?? "Employee",
    dayLabel: new Date(`${String(r.day).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    times: `${clock(r.start_time)} – ${clock(r.end_time)}${r.lunch_start ? ` · lunch ${clock(r.lunch_start)}–${clock(r.lunch_end)}` : ""}`,
    reason: r.reason,
  }));

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader title="Timesheets" description={`Last ${days} days · work day from Start day to End day`} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <TimeFixRequests requests={fixRequests} />
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 border-b border-border p-3">
              <a href={`/timesheets?week=${addDays(weekStart, -7)}`} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">‹ Prev</a>
              <div className="text-center">
                <p className="text-sm font-semibold">Week of {weekLabel}</p>
                {weekStart !== thisMonday && <a href="/timesheets" className="text-xs text-primary underline">This week</a>}
              </div>
              <a href={`/timesheets?week=${addDays(weekStart, 7)}`} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">Next ›</a>
            </div>
            {weekRows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No hours this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">Person</th>
                      {weekDays.map((d) => (
                        <th key={d} className={`px-2 py-2 text-center font-medium ${d === rules.today ? "text-primary" : ""}`}>
                          {new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
                          <br />
                          {new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekRows.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="sticky left-0 bg-card px-3 py-2.5 font-medium">
                          <a href={`/timesheets?days=14&emp=${r.id}#days`} className="hover:underline">{r.name}</a>
                        </td>
                        {r.perDay.map((d, i) => (
                          <td key={i} className={`px-2 py-2.5 text-center tabular-nums ${d.hours ? "" : "text-muted-foreground/50"}`}>
                            {d.hours ? hm(d.hours) : "–"}
                            {d.open && <span className="block text-[10px] font-semibold text-primary">on now</span>}
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{hm(r.total)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {r.rate ? <span className="font-semibold">{usd(r.pay)}</span> : <span className="text-xs text-muted-foreground">no rate</span>}
                          {r.rate ? <span className="block text-[10px] text-muted-foreground">${r.rate}/h</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td className="sticky left-0 bg-muted/50 px-3 py-2">Total</td>
                      {weekDays.map((_, i) => (
                        <td key={i} className="px-2 py-2 text-center tabular-nums">
                          {(() => {
                            const t = weekRows.reduce((a, r) => a + r.perDay[i].hours, 0);
                            return t ? hm(t) : "";
                          })()}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right tabular-nums">{hm(weekRows.reduce((a, r) => a + r.total, 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{usd(weekRows.reduce((a, r) => a + r.pay, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Hours are h:mm from the work-day clock (lunch not counted, overlaps counted once). Straight time. Tap a name to see their days below.
            </p>
          </CardContent>
        </Card>

        <div id="days" className="space-y-2">
          {empFilter && (
            <p className="flex items-center justify-between text-sm">
              <span>Showing <b>{nameOf.get(empFilter) ?? "one person"}</b>&apos;s days</span>
              <a href="/timesheets" className="text-primary underline">Show everyone</a>
            </p>
          )}
          {list.map((r) => {
            const shift = r.shifts[0];
            const lastShift = r.shifts[r.shifts.length - 1];
            // Overlapping punches count once.
            const dayHours = mergedHours(r.shifts, now);
            const jobHours = mergedHours(r.jobs, now);
            const open = r.shifts.some((e) => !e.clock_out);
            const edits = [...r.shifts, ...r.jobs].filter((e) => e.edited_at);
            const dayLabel = new Date(`${r.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            let lunchMin = 0;
            for (let i = 1; i < r.shifts.length; i++) {
              const prevOut = r.shifts[i - 1].clock_out;
              if (prevOut) lunchMin += Math.max(0, (new Date(r.shifts[i].clock_in).getTime() - new Date(prevOut).getTime()) / 60_000);
            }
            const startMap = mapLink(shift?.location_clock_in ?? r.jobs[0]?.location_clock_in ?? null);
            const endMap = mapLink(lastShift?.location_clock_out ?? r.jobs[r.jobs.length - 1]?.location_clock_out ?? null);
            return (
              <Card key={`${r.day}|${r.employeeId}`}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{nameOf.get(r.employeeId) ?? "Employee"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(`${r.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {" · "}
                      {shift ? `${timeOf(shift.clock_in)} – ${open ? "still on" : timeOf(lastShift.clock_out)}` : "No Start day (job time only)"}
                      {lunchMin > 0 ? ` · ${Math.round(lunchMin)} min lunch` : ""}
                    </p>
                    {edits.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                        <span className="rounded bg-emerald-100 px-1 font-semibold dark:bg-emerald-900/40">Edited</span>{" "}
                        {edits[edits.length - 1].edit_note}
                        {edits.some((e) => e.original_clock_in) && (
                          <span className="text-muted-foreground">
                            {" "}· was {edits.filter((e) => e.original_clock_in).map((e) => `${timeOf(e.original_clock_in)}–${timeOf(e.original_clock_out)}`).join(", ")}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-xs">
                      {startMap && <a className="text-primary underline" href={startMap} target="_blank" rel="noreferrer">Start spot</a>}
                      {startMap && endMap && " · "}
                      {endMap && <a className="text-primary underline" href={endMap} target="_blank" rel="noreferrer">End spot</a>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{(r.shifts.length ? dayHours : jobHours).toFixed(2)} h</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{jobHours.toFixed(2)} h on jobs</p>
                    {open && <p className="text-xs font-medium text-amber-600">Day not ended</p>}
                    <div className="mt-1">
                      <EditDayTimes
                        employeeId={r.employeeId}
                        employeeName={nameOf.get(r.employeeId) ?? "Employee"}
                        day={r.day}
                        dayLabel={dayLabel}
                        segments={r.shifts.map((e) => ({ id: e.id, clockIn: hhmm(e.clock_in), clockOut: hhmm(e.clock_out) }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
