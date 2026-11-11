"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endDay, startDay } from "@/app/field/actions";
import { ElapsedTimer } from "./elapsed-timer";

function currentLocation(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/** Start/end the work day: the payroll clock, from the shop or storage to the end of the day. */
export function DayClock({ since, forCrew }: { since: string | null; forCrew: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (loc: string | null) => Promise<{ error: string } | { ok: true }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const r = await fn(await currentLocation());
      if ("error" in r) return setError(r.error);
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {since ? (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Work day</p>
            <ElapsedTimer since={since} baseMs={0} className="font-mono text-xl font-bold tabular-nums text-foreground" />
          </div>
          <Button variant="outline" className="h-12" disabled={pending}
            onClick={() => run(endDay, forCrew ? "End the day for your whole crew?" : "End your work day?")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Moon className="size-4" />}
            End day
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm text-muted-foreground">
            {forCrew ? "Start the day for your crew when you leave the shop." : "Start your day when you get to the shop."}
          </p>
          <Button className="h-12" disabled={pending} onClick={() => run(startDay)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sun className="size-4" />}
            Start day
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
