import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { loadBusinessRules } from "@/lib/schedule-server";
import { addDays } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timesheets - RedFox CRM" };

type Entry = {
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

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");
  if (!["owner", "admin", "manager"].includes(String(org.role ?? "").toLowerCase())) redirect("/dashboard");
  const { days: daysParam } = await searchParams;
  const days = Math.min(62, Math.max(7, Number(daysParam) || 14));

  const db = createAdminClient();
  const rules = await loadBusinessRules(db, org.orgId);
  const tz = rules.timezone;
  const since = addDays(rules.today, -days + 1);
  const [{ data: entries }, { data: employees }] = await Promise.all([
    db
      .from("time_entries")
      .select("employee_id, scheduled_job_id, clock_in, clock_out, total_hours, location_clock_in, location_clock_out")
      .eq("org_id", org.orgId)
      .gte("clock_in", `${addDays(since, -1)}T00:00:00Z`)
      .order("clock_in", { ascending: true })
      .limit(5000),
    db.from("employees").select("id, full_name, first_name, last_name, email").eq("org_id", org.orgId),
  ]);
  const nameOf = new Map<string, string>(
    (employees ?? []).map((e: any) => [e.id, e.full_name?.trim() || [e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || "Employee"]),
  );
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  const timeOf = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) : "—";
  const now = Date.now();
  const hrs = (e: Entry) =>
    e.clock_out ? Number(e.total_hours ?? 0) : Math.max(0, (now - new Date(e.clock_in).getTime()) / 3_600_000);

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
  const list = [...rows.values()].sort((a, b) => (a.day === b.day ? (nameOf.get(a.employeeId) ?? "").localeCompare(nameOf.get(b.employeeId) ?? "") : b.day.localeCompare(a.day)));
  const totals = new Map<string, number>();
  for (const r of list) {
    const h = r.shifts.length ? r.shifts.reduce((s, e) => s + hrs(e), 0) : r.jobs.reduce((s, e) => s + hrs(e), 0);
    totals.set(r.employeeId, (totals.get(r.employeeId) ?? 0) + h);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader title="Timesheets" description={`Last ${days} days · work day from Start day to End day`} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold">Hours by person</p>
            {totals.size === 0 ? (
              <p className="text-sm text-muted-foreground">No time recorded yet. Crews tap Start day in the crew app when they leave the shop.</p>
            ) : (
              <div className="grid gap-1 text-sm sm:grid-cols-2">
                {[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id, h]) => (
                  <div key={id} className="flex justify-between gap-3">
                    <span>{nameOf.get(id) ?? "Employee"}</span>
                    <span className="tabular-nums font-medium">{h.toFixed(2)} h</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          {list.map((r) => {
            const shift = r.shifts[0];
            const lastShift = r.shifts[r.shifts.length - 1];
            const dayHours = r.shifts.reduce((s, e) => s + hrs(e), 0);
            const jobHours = r.jobs.reduce((s, e) => s + hrs(e), 0);
            const open = r.shifts.some((e) => !e.clock_out);
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
