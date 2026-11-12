"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CloudRain, MessageSquare, Phone, Settings2, Sparkles, Undo2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JOB_SIZES, addDays, jobPoints, weekdayOf, type JobSize, type PlanSlot } from "@/lib/schedule";
import {
  applyAutoSchedule,
  previewAutoSchedule,
  rainOutDay,
  reopenDay,
  saveCrew,
  saveScheduleSettings,
  undoScheduleBatch,
  updateScheduledJob,
  deleteScheduledJob,
  type MovedJob,
} from "@/app/(crm)/schedule/actions";

export interface BoardCrew {
  id: string;
  name: string;
  color: string;
  capacity: number;
  active: boolean;
}

export interface BoardJob {
  id: string;
  customerId: string | null;
  customerName: string;
  phone: string | null;
  address: string;
  date: string;
  /** "HH:MM" (24h) or null. */
  startTime?: string | null;
  crewId: string | null;
  size: JobSize;
  /** Load points for this job, using the business's job-size weights. */
  points?: number;
  customerType?: "new" | "past";
  /** What they're getting, e.g. "Front roof line". */
  service?: string | null;
  status: string;
  jobType: string;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtTime = (t?: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};
function ServiceLine({ job, compact = false }: { job: BoardJob; compact?: boolean }) {
  if (!job.customerType && !job.service) return null;
  return (
    <span className={`flex min-w-0 items-center gap-1 ${compact ? "text-[10px]" : "text-xs"}`}>
      {job.customerType && (
        <span
          className={`shrink-0 rounded px-1 font-medium ${
            job.customerType === "new" ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          }`}
        >
          {job.customerType === "new" ? "New" : "Past"}
        </span>
      )}
      {job.service && <span className="truncate text-foreground/80">{job.service}</span>}
    </span>
  );
}

const byTime = (a: BoardJob, b: BoardJob) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99");
const fmtPts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function ScheduleBoard({
  weekStart,
  today,
  crews,
  workDays,
  daysOff,
  notifyOnMove,
  emailConfigured,
  jobs,
  needs,
  removals = [],
  removalStart,
  canManage,
}: {
  weekStart: string;
  today: string;
  crews: BoardCrew[];
  workDays: number[];
  daysOff: string[];
  notifyOnMove: boolean;
  emailConfigured: boolean;
  jobs: BoardJob[];
  needs: { id: string; name: string; address: string; phone: string | null }[];
  /** Installed this season with no takedown booked yet. */
  removals?: { id: string; name: string; address: string; phone: string | null }[];
  /** First takedown day from Settings. */
  removalStart?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BoardJob | null>(null);
  const [rainConfirm, setRainConfirm] = useState<string | null>(null);
  const [rainResult, setRainResult] = useState<{ day: string; batchId: string; moved: MovedJob[] } | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [removalOpen, setRemovalOpen] = useState(false);
  const [crewsOpen, setCrewsOpen] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => workDays.includes(weekdayOf(d)) || jobs.some((j) => j.date === d)),
    [weekStart, workDays, jobs],
  );
  const offSet = useMemo(() => new Set(daysOff), [daysOff]);
  const activeCrews = crews.filter((c) => c.active || jobs.some((j) => j.crewId === c.id));
  const rows: (BoardCrew | null)[] = [...activeCrews, ...(jobs.some((j) => !j.crewId || !crews.some((c) => c.id === j.crewId)) ? [null] : [])];

  const cellJobs = (day: string, crewId: string | null) =>
    jobs
      .filter((j) => j.date === day && (crewId ? j.crewId === crewId : !j.crewId || !crews.some((c) => c.id === j.crewId)))
      .sort(byTime);

  // Phones show one day at a time: today if it's in this week, else the first day.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const mobileDay = pickedDay && days.includes(pickedDay) ? pickedDay : days.includes(today) ? today : days[0];

  function act<T>(fn: () => Promise<T>, done?: (r: T) => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r && typeof r === "object" && "ok" in r && !(r as any).ok) setError((r as any).error);
      else {
        done?.(r);
        router.refresh();
      }
    });
  }

  const goWeek = (n: number) => router.push(`/schedule?week=${addDays(weekStart, n * 7)}`);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => goWeek(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push("/schedule")}>This week</Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => goWeek(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-sm font-medium">
          {shortDate(weekStart)} – {shortDate(addDays(weekStart, 6))}
        </span>
        <div className="ml-auto flex gap-2">
          {canManage && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setCrewsOpen(true)}>
              <Settings2 className="size-3.5" /> Crews & days
            </Button>
          )}
          {canManage && (
            <Button size="sm" className="gap-1" onClick={() => setAutoOpen(true)} disabled={!needs.length}>
              <Sparkles className="size-3.5" /> Needs scheduling ({needs.length})
            </Button>
          )}
          {canManage && removals.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setRemovalOpen(true)}>
              <Sparkles className="size-3.5" /> Removals ({removals.length})
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!crews.length && (
        <Card>
          <CardContent className="p-4 text-sm">
            No crews yet. Add your crews and how many jobs each can do per day under <b>Crews & days</b>.
          </CardContent>
        </Card>
      )}

      {/* Phone: one day at a time */}
      {mobileDay && (
        <MobileDayView
          days={days}
          day={mobileDay}
          today={today}
          onDay={setPickedDay}
          rows={rows}
          offSet={offSet}
          cellJobs={cellJobs}
          jobs={jobs}
          canManage={canManage}
          onPick={setEditing}
          onRain={(d) => setRainConfirm(d)}
          onReopen={(d) => act(() => reopenDay(d))}
        />
      )}

      {/* Board */}
      <div className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[760px] gap-px overflow-hidden rounded-lg border bg-border" style={{ gridTemplateColumns: `120px repeat(${days.length}, minmax(140px, 1fr))` }}>
          {/* Header row */}
          <div className="bg-muted/60 p-2 text-xs font-medium text-muted-foreground">Crew</div>
          {days.map((d) => {
            const isOff = offSet.has(d);
            const dayJobs = jobs.filter((j) => j.date === d);
            const pts = dayJobs.reduce((s, j) => s + (j.points ?? jobPoints(j.size)), 0);
            const cap = activeCrews.filter((c) => c.active).reduce((s, c) => s + c.capacity, 0);
            return (
              <div key={d} className={`p-2 ${isOff ? "bg-sky-50 dark:bg-sky-950/40" : "bg-muted/60"}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-semibold ${d === today ? "text-primary" : ""}`}>
                    {DAY[weekdayOf(d)]} {shortDate(d)}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{fmtPts(pts)}/{fmtPts(cap)}</span>
                </div>
                {canManage &&
                  (isOff ? (
                    <button className="mt-1 flex items-center gap-1 text-[11px] text-sky-700" onClick={() => act(() => reopenDay(d))}>
                      <CloudRain className="size-3" /> Rain day · reopen
                    </button>
                  ) : (
                    d >= today && (
                      <button className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setRainConfirm(d)}>
                        <CloudRain className="size-3" /> Rain day
                      </button>
                    )
                  ))}
              </div>
            );
          })}

          {/* Crew rows */}
          {rows.map((crew) => (
            <Row
              key={crew?.id ?? "none"}
              crew={crew}
              days={days}
              offSet={offSet}
              cellJobs={cellJobs}
              onPick={setEditing}
            />
          ))}
          {!rows.length && <div className="col-span-full bg-background p-6 text-center text-sm text-muted-foreground">Nothing scheduled this week.</div>}
        </div>
      </div>
      <p className="hidden text-xs text-muted-foreground md:block">
        Numbers show job load vs. crew limit. Standard install = 1, small = ¾, large = 1½. Tap a job to move it or change its size.
      </p>

      {/* Edit job */}
      <EditJobDialog
        job={editing}
        crews={crews}
        onClose={() => setEditing(null)}
        onSave={(patch) => editing && act(() => updateScheduledJob(editing.id, patch), () => setEditing(null))}
        onDelete={() => editing && act(() => deleteScheduledJob(editing.id), () => setEditing(null))}
        pending={pending}
      />

      {/* Rain confirm */}
      <Dialog open={Boolean(rainConfirm)} onOpenChange={(o) => !o && setRainConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rain day: {rainConfirm && longDate(rainConfirm)}?</DialogTitle>
            <DialogDescription>
              Every install on this day moves to the next work day, and every job after it moves back one work day so the order stays the
              same. You can undo this.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRainConfirm(null)}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() => {
                const d = rainConfirm!;
                act(() => rainOutDay(d), (r: any) => {
                  setRainConfirm(null);
                  setRainResult({ day: d, batchId: r.batchId, moved: r.moved });
                });
              }}
            >
              {pending ? "Moving…" : "Push schedule back"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rain result: who moved */}
      <Dialog open={Boolean(rainResult)} onOpenChange={(o) => !o && setRainResult(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rainResult?.moved.length ?? 0} installs moved</DialogTitle>
            <DialogDescription>
              {rainResult && rainResult.moved.some((m) => m.emailed)
                ? "Customers with an email address were sent their new date. Call or text the rest."
                : "Let these customers know their new date."}
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y">
            {rainResult?.moved.map((m) => (
              <div key={m.jobId} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {shortDate(m.from)} → <span className="font-medium text-foreground">{shortDate(m.to)}</span>
                    {m.emailed ? " · emailed" : ""}
                  </p>
                </div>
                {m.phone && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon-xs" variant="outline" aria-label="Call" render={<a href={`tel:${m.phone}`} />}>
                      <Phone className="size-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="outline"
                      aria-label="Text"
                      render={<a href={`sms:${m.phone}?&body=${encodeURIComponent(`Hi! Because of the weather we've moved your holiday lighting install to ${longDate(m.to)}. Reply if that day doesn't work.`)}`} />}
                    >
                      <MessageSquare className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button
              variant="outline"
              className="gap-1"
              disabled={pending}
              onClick={() => rainResult && act(() => undoScheduleBatch(rainResult.batchId), () => setRainResult(null))}
            >
              <Undo2 className="size-3.5" /> Undo
            </Button>
            <Button onClick={() => setRainResult(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AutoScheduleDialog open={autoOpen} onClose={() => setAutoOpen(false)} needs={needs} today={today} onDone={() => router.refresh()} />
      <AutoScheduleDialog
        kind="removal"
        defaultStart={removalStart && removalStart > today ? removalStart : undefined}
        open={removalOpen}
        onClose={() => setRemovalOpen(false)}
        needs={removals}
        today={today}
        onDone={() => router.refresh()}
      />
      <CrewsDialog
        open={crewsOpen}
        onClose={() => setCrewsOpen(false)}
        crews={crews}
        workDays={workDays}
        notifyOnMove={notifyOnMove}
        emailConfigured={emailConfigured}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function MobileDayView({
  days,
  day,
  today,
  onDay,
  rows,
  offSet,
  cellJobs,
  jobs,
  canManage,
  onPick,
  onRain,
  onReopen,
}: {
  days: string[];
  day: string;
  today: string;
  onDay: (d: string) => void;
  rows: (BoardCrew | null)[];
  offSet: Set<string>;
  cellJobs: (day: string, crewId: string | null) => BoardJob[];
  jobs: BoardJob[];
  canManage: boolean;
  onPick: (j: BoardJob) => void;
  onRain: (d: string) => void;
  onReopen: (d: string) => void;
}) {
  const idx = days.indexOf(day);
  const isOff = offSet.has(day);
  return (
    <div className="space-y-3 md:hidden">
      {/* Day picker: every day of the week fits on one row */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const count = jobs.filter((j) => j.date === d).length;
          const active = d === day;
          return (
            <button
              key={d}
              onClick={() => onDay(d)}
              className={`flex flex-col items-center rounded-lg border py-1.5 text-xs ${
                active ? "border-primary bg-primary text-primary-foreground" : offSet.has(d) ? "bg-sky-50 dark:bg-sky-950/40" : "bg-background"
              }`}
            >
              <span className={`font-medium ${!active && d === today ? "text-primary" : ""}`}>{DAY[weekdayOf(d)]}</span>
              <span className="text-[11px] opacity-80">{Number(d.slice(8))}</span>
              <span className={`mt-0.5 text-[10px] tabular-nums ${active ? "" : "text-muted-foreground"}`}>{count || "–"}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Previous day" disabled={idx <= 0} onClick={() => onDay(days[idx - 1])}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">{longDate(day)}</p>
          {canManage &&
            (isOff ? (
              <button className="mx-auto flex items-center gap-1 text-xs text-sky-700" onClick={() => onReopen(day)}>
                <CloudRain className="size-3" /> Rain day · reopen
              </button>
            ) : (
              day >= today && (
                <button className="mx-auto flex items-center gap-1 text-xs text-muted-foreground" onClick={() => onRain(day)}>
                  <CloudRain className="size-3" /> Rain day
                </button>
              )
            ))}
        </div>
        <Button variant="outline" size="icon" aria-label="Next day" disabled={idx >= days.length - 1} onClick={() => onDay(days[idx + 1])}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled this week.</p>}
      {rows.map((crew) => {
        const list = cellJobs(day, crew?.id ?? null);
        if (!crew && list.length === 0) return null;
        const pts = list.reduce((s, j) => s + (j.points ?? jobPoints(j.size)), 0);
        const over = crew ? pts > crew.capacity : false;
        return (
          <Card key={crew?.id ?? "none"}>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: crew?.color ?? "#9ca3af" }} />
                  <span className="text-sm font-semibold">{crew?.name ?? "No crew"}</span>
                </div>
                {crew && (
                  <span className={`text-xs tabular-nums ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                    {fmtPts(pts)}/{fmtPts(crew.capacity)} jobs{over ? " · over limit" : ""}
                  </span>
                )}
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">No jobs.</p>
              ) : (
                list.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => onPick(j)}
                    className={`flex w-full items-start gap-3 rounded-md border p-2 text-left active:bg-muted ${j.status === "completed" ? "opacity-60" : ""}`}
                    style={{ borderLeft: `3px solid ${crew?.color ?? "#9ca3af"}` }}
                  >
                    <span className="w-14 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{fmtTime(j.startTime) || "—"}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{j.customerName}</span>
                      <ServiceLine job={j} />
                      <span className="block truncate text-xs text-muted-foreground">
                        {j.jobType.includes("remov") ? "Removal · " : ""}
                        {j.size !== "standard" ? `${JOB_SIZES[j.size].label} · ` : ""}
                        {j.status === "completed" ? "Done · " : j.status === "needs_return" ? "Return needed · " : ""}
                        {j.address}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
      <p className="text-xs text-muted-foreground">Tap a job to move it or change its size.</p>
    </div>
  );
}

function Row({
  crew,
  days,
  offSet,
  cellJobs,
  onPick,
}: {
  crew: BoardCrew | null;
  days: string[];
  offSet: Set<string>;
  cellJobs: (day: string, crewId: string | null) => BoardJob[];
  onPick: (j: BoardJob) => void;
}) {
  return (
    <>
      <div className="flex items-start gap-1.5 bg-background p-2">
        <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: crew?.color ?? "#9ca3af" }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{crew?.name ?? "No crew"}</p>
          {crew && <p className="text-[11px] text-muted-foreground">{fmtPts(crew.capacity)} jobs/day</p>}
        </div>
      </div>
      {days.map((d) => {
        const list = cellJobs(d, crew?.id ?? null);
        const pts = list.reduce((s, j) => s + (j.points ?? jobPoints(j.size)), 0);
        const over = crew ? pts > crew.capacity : false;
        return (
          <div key={d} className={`min-h-20 space-y-1 p-1.5 ${offSet.has(d) ? "bg-sky-50/60 dark:bg-sky-950/20" : "bg-background"}`}>
            {crew && list.length > 0 && (
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${over ? "bg-destructive" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (pts / crew.capacity) * 100)}%` }} />
              </div>
            )}
            {list.map((j) => (
              <button
                key={j.id}
                onClick={() => onPick(j)}
                className={`block w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:bg-muted ${j.status === "completed" ? "opacity-60" : ""}`}
                style={{ borderLeft: `3px solid ${crew?.color ?? "#9ca3af"}` }}
              >
                <span className="block truncate font-medium">
                  {j.startTime ? <span className="font-normal text-muted-foreground">{fmtTime(j.startTime)} · </span> : null}
                  {j.customerName}
                </span>
                <ServiceLine job={j} compact />
                <span className="block truncate text-muted-foreground">
                  {j.jobType.includes("remov") ? "Removal · " : ""}
                  {j.size !== "standard" ? `${JOB_SIZES[j.size].label} · ` : ""}
                  {j.status === "completed" ? "Done · " : j.status === "needs_return" ? "Return needed · " : ""}
                  {j.address}
                </span>
              </button>
            ))}
            {over && <p className="text-[10px] font-medium text-destructive">Over limit</p>}
          </div>
        );
      })}
    </>
  );
}

function EditJobDialog({
  job,
  crews,
  onClose,
  onSave,
  onDelete,
  pending,
}: {
  job: BoardJob | null;
  crews: BoardCrew[];
  onClose: () => void;
  onSave: (patch: { date?: string; crewId?: string | null; size?: JobSize }) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [date, setDate] = useState("");
  const [crewId, setCrewId] = useState("");
  const [size, setSize] = useState<JobSize>("standard");
  const [lastId, setLastId] = useState<string | null>(null);
  if (job && job.id !== lastId) {
    setLastId(job.id);
    setConfirmDelete(false);
    setDate(job.date);
    setCrewId(job.crewId ?? "");
    setSize(job.size);
  }
  return (
    <Dialog open={Boolean(job)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{job?.customerName}</DialogTitle>
          <DialogDescription>{job?.address}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Install day</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Crew</Label>
            <select className={selectCls} value={crewId} onChange={(e) => setCrewId(e.target.value)}>
              <option value="">No crew</option>
              {crews.filter((c) => c.active || c.id === crewId).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Job size</Label>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(JOB_SIZES) as JobSize[]).map((s) => (
                <Button key={s} type="button" size="sm" variant={size === s ? "default" : "outline"} onClick={() => setSize(s)}>
                  {JOB_SIZES[s].label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            {job?.customerId ? (
              <Link href={`/customers/${job.customerId}`} className="text-xs text-primary underline-offset-2 hover:underline">
                Open customer
              </Link>
            ) : <span />}
            <Button
              disabled={pending || !job}
              onClick={() =>
                job &&
                onSave({
                  ...(date !== job.date ? { date } : {}),
                  ...(crewId !== (job.crewId ?? "") ? { crewId: crewId || null } : {}),
                  ...(size !== job.size ? { size } : {}),
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
          <div className="border-t pt-3">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Take this job off the schedule? The customer goes back to &ldquo;Needs scheduling&rdquo; if they have no other job.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={pending} onClick={onDelete}>
                    Yes, delete job
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" className="text-xs font-medium text-destructive hover:underline" onClick={() => setConfirmDelete(true)}>
                Delete job
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutoScheduleDialog({
  kind = "install",
  defaultStart,
  open,
  onClose,
  needs,
  today,
  onDone,
}: {
  kind?: "install" | "removal";
  defaultStart?: string;
  open: boolean;
  onClose: () => void;
  needs: { id: string; name: string; address: string }[];
  today: string;
  onDone: () => void;
}) {
  const [startDate, setStartDate] = useState(defaultStart ?? addDays(today, 1));
  const [plan, setPlan] = useState<PlanSlot[] | null>(null);
  const [unplaced, setUnplaced] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const grouped = useMemo(() => {
    const m = new Map<string, PlanSlot[]>();
    for (const p of plan ?? []) {
      const k = `${p.date}|${p.crewName}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()];
  }, [plan]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setPlan(null); setMsg(null); } }}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {kind === "removal" ? `${needs.length} installed homes need a takedown day` : `${needs.length} paid customers need an install day`}
          </DialogTitle>
          <DialogDescription>
            {kind === "removal"
              ? "Pick the first takedown day (usually early January). Red Fox fills each crew up to its daily limit, first installed first removed, and keeps each crew's day in one neighborhood. Rain days push removals back the same way."
              : "Red Fox fills each crew up to its daily limit, first come first served, and keeps each crew's day in one neighborhood."}{" "}
            You review it before anything is saved.
          </DialogDescription>
        </DialogHeader>
        {!plan ? (
          <div className="space-y-3">
            <div className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
              {needs.map((n) => (
                <div key={n.id} className="px-2 py-1.5">
                  <p className="font-medium">{n.name}</p>
                  <p className="text-xs text-muted-foreground">{n.address || "No address"}</p>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Start scheduling on</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setMsg(null);
                    const r = await previewAutoSchedule(startDate, kind);
                    if (!r.ok) return setMsg(r.error);
                    setPlan(r.plan);
                    setUnplaced(r.unplaced);
                  })
                }
              >
                {pending ? "Planning…" : "Plan it"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([k, slots]) => (
              <div key={k}>
                <p className="text-xs font-semibold">
                  {longDate(slots[0].date)} · {slots[0].crewName}
                </p>
                {slots.map((s) => (
                  <p key={s.customerId} className="truncate text-sm">
                    {s.name} <span className="text-xs text-muted-foreground">{s.address}</span>
                  </p>
                ))}
              </div>
            ))}
            {unplaced > 0 && <p className="text-xs text-muted-foreground">{unplaced} didn&apos;t fit in the next 90 work days.</p>}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setPlan(null)}>Back</Button>
              <Button
                disabled={pending || !plan.length}
                onClick={() =>
                  start(async () => {
                    const r = await applyAutoSchedule(plan, kind);
                    if (!r.ok) return setMsg(r.error);
                    setPlan(null);
                    onClose();
                    onDone();
                  })
                }
              >
                {pending ? "Saving…" : `Schedule ${plan.length} ${kind === "removal" ? "removals" : "installs"}`}
              </Button>
            </div>
          </div>
        )}
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </DialogContent>
    </Dialog>
  );
}

function CrewsDialog({
  open,
  onClose,
  crews,
  workDays,
  notifyOnMove,
  emailConfigured,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  crews: BoardCrew[];
  workDays: number[];
  notifyOnMove: boolean;
  emailConfigured: boolean;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<BoardCrew[]>(crews);
  const [days, setDays] = useState<number[]>(workDays);
  const [notify, setNotify] = useState(notifyOnMove);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [seen, setSeen] = useState(false);
  if (open && !seen) {
    setSeen(true);
    setDraft(crews);
    setDays(workDays);
    setNotify(notifyOnMove);
  }
  if (!open && seen) setSeen(false);

  function saveAll() {
    start(async () => {
      setMsg(null);
      for (const c of draft) {
        const orig = crews.find((o) => o.id === c.id);
        if (orig && orig.name === c.name && orig.capacity === c.capacity && orig.color === c.color && orig.active === c.active) continue;
        if (!c.name.trim()) continue;
        const r = await saveCrew({ id: c.id.startsWith("new-") ? undefined : c.id, name: c.name, color: c.color, capacity: c.capacity, active: c.active });
        if (!r.ok) return setMsg(r.error);
      }
      const r = await saveScheduleSettings({ workDays: days, notifyOnMove: notify });
      if (!r.ok) return setMsg(r.error);
      onClose();
      onDone();
    });
  }

  const palette = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="size-4" /> Crews & work days</DialogTitle>
          <DialogDescription>Set how many standard installs each crew can do in a day.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {draft.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={c.color}
                  aria-label="Crew color"
                  className="size-8 shrink-0 cursor-pointer rounded border"
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
                />
                <Input value={c.name} placeholder="Crew name" onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  className="w-16"
                  aria-label="Jobs per day"
                  value={c.capacity}
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, capacity: Number(e.target.value) } : x)))}
                />
                <Switch
                  checked={c.active}
                  aria-label="Active"
                  onCheckedChange={(v) => setDraft(draft.map((x, j) => (j === i ? { ...x, active: Boolean(v) } : x)))}
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft([...draft, { id: `new-${Date.now()}`, name: `Crew ${String.fromCharCode(65 + draft.length)}`, color: palette[draft.length % palette.length], capacity: 3, active: true }])
              }
            >
              Add crew
            </Button>
            <p className="text-xs text-muted-foreground">Number = installs per day. Switch off a crew that isn&apos;t working this season.</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Work days</Label>
            <div className="flex flex-wrap gap-1">
              {DAY.map((d, i) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={days.includes(i) ? "default" : "outline"}
                  onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Email customers when their install moves</p>
              <p className="text-xs text-muted-foreground">
                {emailConfigured ? "Sends their new date automatically." : "Turns on once email (Resend) is set up. Until then you'll get a call/text list."}
              </p>
            </div>
            <Switch checked={notify} onCheckedChange={(v) => setNotify(Boolean(v))} />
          </div>

          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={saveAll} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
