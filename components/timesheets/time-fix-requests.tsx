"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideTimeFix } from "@/app/(crm)/timesheets/actions";

export interface TimeFixRequestRow {
  id: string;
  employeeName: string;
  dayLabel: string;
  times: string;
  reason: string;
}

/** Crew time-fix requests waiting on the owner: approve or decline in one tap. */
export function TimeFixRequests({ requests }: { requests: TimeFixRequestRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!requests.length) return null;

  const decide = (id: string, approve: boolean) => {
    setError(null);
    setBusyId(id);
    start(async () => {
      const r = await decideTimeFix(id, approve);
      setBusyId(null);
      if ("error" in r) return setError(r.error);
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <p className="mb-2 text-sm font-semibold">Time fix requests ({requests.length})</p>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{r.employeeName} · {r.dayLabel}</p>
              <p className="tabular-nums">{r.times}</p>
              <p className="text-xs text-muted-foreground">{r.reason}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(r.id, false)}>
                {busyId === r.id && pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                Decline
              </Button>
              <Button size="sm" disabled={pending} onClick={() => decide(r.id, true)}>
                {busyId === r.id && pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
