import { getFieldContext, getMyHours } from "@/lib/field";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";

export const dynamic = "force-dynamic";

/** The crew member's own clock in / clock out history. */
export default async function MyHoursPage() {
  const { org, employee } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const { timezone, days } = await getMyHours(org.orgId, employee.id, 14);
  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }) : "now";
  const dayLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const hm = (h: number) => {
    const m = Math.round(h * 60);
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  };

  // This week = Monday through today.
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const t = new Date(`${todayStr}T12:00:00`);
  const monday = new Date(t);
  monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const mondayStr = monday.toLocaleDateString("en-CA");
  const weekHours = days.filter((d) => d.day >= mondayStr).reduce((s, d) => s + d.workedHours, 0);

  return (
    <div className="flex flex-col gap-4 px-4 pb-10 pt-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My hours</h1>
        <p className="text-sm text-muted-foreground">
          This week: <span className="font-semibold text-foreground tabular-nums">{hm(weekHours)}</span>
        </p>
      </div>

      {days.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No time yet. Tap Start day on My jobs when you get to the shop.
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {days.map((d) => (
          <li key={d.day} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-foreground">{dayLabel(d.day)}</p>
              <p className="font-mono text-lg font-bold tabular-nums text-foreground">{hm(d.workedHours)}</p>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {d.segments.map((s, i) => (
                <li key={i} className="flex justify-between gap-3 tabular-nums">
                  <span className="text-muted-foreground">{i === 0 ? "Clocked in" : "Back from lunch"}</span>
                  <span>
                    {time(s.in)} – {s.out ? time(s.out) : <span className="font-medium text-emerald-600">on the clock</span>}
                  </span>
                </li>
              ))}
            </ul>
            {d.lunchMinutes > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Lunch: {d.lunchMinutes} min (not paid)</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
