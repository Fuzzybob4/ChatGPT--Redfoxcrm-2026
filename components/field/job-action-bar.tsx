"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Navigation, Pause, Play, RotateCcw, Square } from "lucide-react";

import { completeJob, markOnMyWay, needsReturnVisit, pauseJob, startJob } from "@/app/field/actions";
import { RETURN_REASONS, type ReturnReason } from "@/components/field/format";
import { Button } from "@/components/ui/button";
import { ElapsedTimer, formatElapsed } from "./elapsed-timer";

function currentLocation(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    );
  });
}

interface Props {
  jobId: string;
  status: string;
  clockedInSince: string | null;
  loggedMs: number;
  busyElsewhereJobId: string | null;
  nextJobId: string | null;
  /** Crew leads (and the office) run the job; installers only view and add photos. */
  canRun?: boolean;
}

type Mode = "main" | "finish" | "return";

const textareaCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function JobActionBar({ jobId, status, clockedInSince, loggedMs, busyElsewhereJobId, nextJobId, canRun = true }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("main");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [ended, setEnded] = useState<{ kind: "completed" | "return"; nextJobId: string | null } | null>(null);

  const run = (
    action: () => Promise<{ error: string } | { ok: true; nextJobId?: string | null }>,
    onDone?: (r: { nextJobId?: string | null }) => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onDone?.(result);
      setMode("main");
      router.refresh();
    });
  };

  const endedKind = ended?.kind ?? (status === "completed" ? "completed" : status === "needs_return" ? "return" : null);
  const nextId = ended ? ended.nextJobId : nextJobId;

  const timer = (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">On the clock</span>
      {clockedInSince ? (
        <ElapsedTimer since={clockedInSince} baseMs={loggedMs} className="font-mono text-2xl font-bold tabular-nums text-foreground" />
      ) : (
        <span className="font-mono text-2xl font-bold tabular-nums text-muted-foreground">
          {formatElapsed(loggedMs)}
          {loggedMs > 0 ? " · paused" : ""}
        </span>
      )}
    </div>
  );

  let body: React.ReactNode;

  if (endedKind) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {endedKind === "completed" ? (
            <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-5 text-fuchsia-600" aria-hidden="true" />
          )}
          {endedKind === "completed" ? "Job completed" : "Return visit needed. The office will reschedule it."}
          {loggedMs > 0 ? ` · ${formatElapsed(loggedMs)} logged` : ""}
        </p>
        {nextId ? (
          <Button render={<Link href={`/field/jobs/${nextId}`} />} className="h-14 w-full text-base font-semibold">
            Go to next job
          </Button>
        ) : (
          <Button render={<Link href="/field" />} variant="outline" className="h-14 w-full text-base font-semibold">
            Back to my jobs
          </Button>
        )}
      </div>
    );
  } else if (!canRun) {
    // Installers and helpers: see the clock, but the lead runs it.
    body = (
      <div className="flex items-center gap-4">
        {status === "in_progress" ? timer : null}
        <p className="flex-1 text-sm text-muted-foreground">
          {status === "in_progress"
            ? "Your crew lead runs the clock and finishes the job."
            : status === "en_route"
              ? "Your crew lead is on the way. They start the job when you arrive."
              : "Your crew lead starts this job. You can add photos any time."}
        </p>
      </div>
    );
  } else if (mode === "finish") {
    body = (
      <div className="flex flex-col gap-3">
        <label htmlFor="crew-notes" className="text-sm font-medium text-foreground">
          Notes for the office (optional)
        </label>
        <textarea id="crew-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000}
          placeholder="Anything they should know about this install" className={textareaCls} />
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="outline" className="h-14 px-5" disabled={isPending} onClick={() => setMode("main")}>
            Back
          </Button>
          <Button type="button" className="h-14 text-base font-semibold" disabled={isPending}
            onClick={() => run(async () => completeJob(jobId, notes, await currentLocation()), (r) => setEnded({ kind: "completed", nextJobId: r.nextJobId ?? null }))}>
            {isPending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
            Mark job complete
          </Button>
        </div>
      </div>
    );
  } else if (mode === "return") {
    body = (
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        <p className="text-sm font-semibold text-foreground">Why can&apos;t you finish today?</p>
        <div className="grid gap-2">
          {(Object.keys(RETURN_REASONS) as ReturnReason[]).map((key) => (
            <button key={key} type="button" onClick={() => setReason(key)}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm ${reason === key ? "border-primary bg-primary/10 font-medium" : "border-border bg-background"}`}>
              {RETURN_REASONS[key]}
            </button>
          ))}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000}
          placeholder={reason === "other" ? "What happened? (required)" : "What's left to do, what to bring next time (optional)"} className={textareaCls} />
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="outline" className="h-14 px-5" disabled={isPending} onClick={() => setMode("main")}>
            Back
          </Button>
          <Button type="button" className="h-14 text-base font-semibold" disabled={isPending || !reason}
            onClick={() =>
              reason &&
              run(async () => needsReturnVisit(jobId, reason, notes, await currentLocation()), (r) => setEnded({ kind: "return", nextJobId: r.nextJobId ?? null }))
            }>
            {isPending ? <Loader2 className="size-5 animate-spin" /> : <RotateCcw className="size-5" />}
            Stop &amp; schedule a return
          </Button>
        </div>
      </div>
    );
  } else if (status === "in_progress") {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          {timer}
          {clockedInSince ? (
            <Button type="button" className="h-14 flex-1 text-base font-semibold" disabled={isPending} onClick={() => { setNotes(""); setMode("finish"); }}>
              <Square className="size-5" />
              Finish job
            </Button>
          ) : (
            <Button type="button" className="h-14 flex-1 text-base font-semibold" disabled={isPending || !!busyElsewhereJobId}
              onClick={() => run(async () => startJob(jobId, await currentLocation()))}>
              {isPending ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
              Resume
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {clockedInSince ? (
            <Button type="button" variant="outline" className="h-11" disabled={isPending}
              onClick={() => run(async () => pauseJob(jobId, await currentLocation()))}>
              <Pause className="size-4" />
              Pause
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="outline" className="h-11" disabled={isPending} onClick={() => { setNotes(""); setReason(null); setMode("return"); }}>
            <RotateCcw className="size-4" />
            Can&apos;t finish today
          </Button>
        </div>
      </div>
    );
  } else if (busyElsewhereJobId) {
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">You&apos;re still clocked in on another job.</p>
        <Button render={<Link href={`/field/jobs/${busyElsewhereJobId}`} />} variant="outline" className="h-14 w-full text-base font-semibold">
          Go to current job
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-[auto_1fr] gap-3">
        {status === "scheduled" && (
          <Button type="button" variant="outline" className="h-14 px-4" disabled={isPending} onClick={() => run(() => markOnMyWay(jobId))}>
            <Navigation className="size-5" />
            On my way
          </Button>
        )}
        <Button type="button" className={status === "scheduled" ? "h-14 text-base font-semibold" : "col-span-2 h-14 text-base font-semibold"} disabled={isPending}
          onClick={() => run(async () => startJob(jobId, await currentLocation()))}>
          {isPending ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
          Start job
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3">
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {body}
      </div>
    </div>
  );
}
