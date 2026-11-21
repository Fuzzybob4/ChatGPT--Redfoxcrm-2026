"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sun, Moon, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endDay, startDay, startLunch } from "@/app/field/actions";
import { ElapsedTimer } from "./elapsed-timer";

function currentLocation(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    // Never let a stuck location prompt block clocking in.
    const giveUp = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(giveUp); resolve(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`); },
      () => { clearTimeout(giveUp); resolve(null); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/** Start/end the work day: the payroll clock, from the shop or storage to the end of the day. */
export function DayClock({
  since,
  lunchSince = null,
  workedBeforeMs = 0,
  forCrew,
  hasJobsToday = false,
  dayDone = false,
}: {
  /** There are jobs today, so not being on the clock is worth a loud warning. */
  hasJobsToday?: boolean;
  /** They already ended today's work day. */
  dayDone?: boolean;
  since: string | null;
  lunchSince?: string | null;
  /** Already worked today before this stretch (e.g. the morning, before lunch). */
  workedBeforeMs?: number;
  forCrew: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [backAt, setBackAt] = useState("");
  const [showBackAt, setShowBackAt] = useState(false);
  // Re-check the clock every minute for the lunch and end-of-day reminders.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const lunchMinutes = lunchSince ? Math.floor((nowMs - new Date(lunchSince).getTime()) / 60_000) : 0;
  const hourNow = new Date(nowMs).getHours();
  const lateEvening = Boolean(since) && hourNow >= 18;
  const notClockedIn = !since && !lunchSince && !dayDone && hasJobsToday && hourNow >= 6 && hourNow < 18;

  const run = (fn: (loc: string | null) => Promise<{ error: string } | { ok: true }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      try {
        const r = await fn(await currentLocation());
        if ("error" in r) return setError(r.error);
        router.refresh();
      } catch {
        setError("That didn't go through. Check your signal and tap again. If it keeps failing, log out and back in.");
      }
    });
  };

  return (
    <div className={`rounded-xl border bg-card p-3 ${notClockedIn ? "border-destructive ring-1 ring-destructive" : "border-border"}`}>
      {since ? (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Worked today</p>
            <ElapsedTimer since={since} baseMs={workedBeforeMs} className="font-mono text-xl font-bold tabular-nums text-foreground" />
          </div>
          <Button variant="outline" className="h-12" disabled={pending}
            onClick={() => run(startLunch, "Clock out for lunch? Your job timer pauses too.")}>
            <Utensils className="size-4" />
            Lunch
          </Button>
          <Button variant="outline" className="h-12" disabled={pending}
            onClick={() => run(endDay, "End your work day? This clocks out only you.")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Moon className="size-4" />}
            End day
          </Button>
        </div>
      ) : lunchSince ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600">At lunch</p>
              <ElapsedTimer since={lunchSince} baseMs={0} className="font-mono text-xl font-bold tabular-nums text-foreground" />
            </div>
            <Button className="h-12" disabled={pending} onClick={() => run((loc) => startDay(loc))}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sun className="size-4" />}
              Back from lunch
            </Button>
          </div>
          {lunchMinutes >= 45 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-100 p-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              You&apos;ve been on lunch {lunchMinutes} min. Back to work? Tap Back from lunch so your time counts.
            </p>
          )}
          {showBackAt ? (
            <div className="flex items-center gap-2">
              <label htmlFor="back-at" className="text-sm text-muted-foreground">I got back at</label>
              <input id="back-at" type="time" value={backAt} onChange={(e) => setBackAt(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
              <Button size="sm" className="h-10" disabled={pending || !backAt} onClick={() => run((loc) => startDay(loc, backAt))}>
                Save
              </Button>
            </div>
          ) : (
            <button type="button" className="self-start text-xs font-medium text-primary underline" onClick={() => setShowBackAt(true)}>
              Forgot to tap? Enter the time you got back
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {notClockedIn ? (
            <p className="flex flex-1 items-start gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              You&apos;re not on the clock. Tap Start day so your hours count.
            </p>
          ) : (
            <p className="flex-1 text-sm text-muted-foreground">
              {dayDone ? "Your day is ended. Start day again only if you're back to work." : "Start your day when you get to the shop or storage. Everyone clocks in for themselves."}
            </p>
          )}
          <Button className="h-12" disabled={pending} onClick={() => run((loc) => startDay(loc))}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sun className="size-4" />}
            Start day
          </Button>
        </div>
      )}
      {lateEvening && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-100 p-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Still working? Tap End day when you&apos;re done. Days left open after 7 PM end automatically and the office checks them.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
