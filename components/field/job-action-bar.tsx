"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Navigation, Play, Square } from "lucide-react";

import { completeJob, markOnMyWay, startJob } from "@/app/field/actions";
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
}

export function JobActionBar({ jobId, status, clockedInSince, loggedMs, busyElsewhereJobId, nextJobId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [notes, setNotes] = useState("");
  const [completedNextJobId, setCompletedNextJobId] = useState<string | null | undefined>(undefined);

  const run = (action: () => Promise<{ error: string } | { ok: true; nextJobId?: string | null }>, onDone?: (r: { nextJobId?: string | null }) => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onDone?.(result);
      router.refresh();
    });
  };

  const done = status === "completed" || completedNextJobId !== undefined;
  const nextId = completedNextJobId !== undefined ? completedNextJobId : nextJobId;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3">
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {done ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
              Job completed{loggedMs > 0 ? ` · ${formatElapsed(loggedMs)} logged` : ""}
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
        ) : status === "in_progress" ? (
          confirmingComplete ? (
            <div className="flex flex-col gap-3">
              <label htmlFor="crew-notes" className="text-sm font-medium text-foreground">
                Notes for the office (optional)
              </label>
              <textarea
                id="crew-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Anything they should know about this install"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 px-5"
                  disabled={isPending}
                  onClick={() => setConfirmingComplete(false)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-14 text-base font-semibold"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      async () => completeJob(jobId, notes, await currentLocation()),
                      (r) => setCompletedNextJobId(r.nextJobId ?? null),
                    )
                  }
                >
                  {isPending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
                  Mark job complete
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">On the clock</span>
                {clockedInSince ? (
                  <ElapsedTimer
                    since={clockedInSince}
                    baseMs={loggedMs}
                    className="font-mono text-2xl font-bold tabular-nums text-foreground"
                  />
                ) : (
                  <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{formatElapsed(loggedMs)}</span>
                )}
              </div>
              {clockedInSince ? (
                <Button
                  type="button"
                  className="h-14 flex-1 text-base font-semibold"
                  disabled={isPending}
                  onClick={() => setConfirmingComplete(true)}
                >
                  <Square className="size-5" />
                  Finish job
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-14 flex-1 text-base font-semibold"
                  disabled={isPending || !!busyElsewhereJobId}
                  onClick={() => run(async () => startJob(jobId, await currentLocation()))}
                >
                  {isPending ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
                  Clock in to this job
                </Button>
              )}
            </div>
          )
        ) : busyElsewhereJobId ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">You&apos;re still clocked in on another job.</p>
            <Button render={<Link href={`/field/jobs/${busyElsewhereJobId}`} />} variant="outline" className="h-14 w-full text-base font-semibold">
              Go to current job
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-3">
            {status === "scheduled" && (
              <Button
                type="button"
                variant="outline"
                className="h-14 px-4"
                disabled={isPending}
                onClick={() => run(() => markOnMyWay(jobId))}
              >
                <Navigation className="size-5" />
                On my way
              </Button>
            )}
            <Button
              type="button"
              className={status === "scheduled" ? "h-14 text-base font-semibold" : "col-span-2 h-14 text-base font-semibold"}
              disabled={isPending}
              onClick={() => run(async () => startJob(jobId, await currentLocation()))}
            >
              {isPending ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
              Start job
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
