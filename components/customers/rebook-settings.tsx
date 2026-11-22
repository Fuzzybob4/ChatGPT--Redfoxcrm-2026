"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveRebookSettings } from "@/app/(crm)/customers/rebook-actions";

/** When returning customers can book themselves, and how far out the first pick is. */
export function RebookSettingsCard({
  initial,
}: {
  initial: { enabled: boolean; windowStart: string | null; windowEnd: string | null; leadDays: number };
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [windowStart, setStart] = useState(initial.windowStart ?? "");
  const [windowEnd, setEnd] = useState(initial.windowEnd ?? "");
  const [leadDays, setLead] = useState(String(initial.leadDays));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await saveRebookSettings({ enabled, windowStart, windowEnd, leadDays: Number(leadDays) });
      if ("error" in r) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    });
  };

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${enabled ? "border-border bg-card" : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Online booking for returning customers</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Open. Booking links let customers pick a day." : "Off. Booking links say booking isn't open yet."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Open
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rb-start">First install day</Label>
          <Input id="rb-start" type="date" value={windowStart} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rb-end">Last install day</Label>
          <Input id="rb-end" type="date" value={windowEnd} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rb-lead">Days of notice</Label>
          <Input id="rb-lead" type="number" min={0} max={30} value={leadDays} onChange={(e) => setLead(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Customers see work days in this window with room on a crew, morning or afternoon. Days off on the schedule are skipped.
        Each crew&apos;s daily job limit (Settings → Season &amp; crews) decides when a day is full.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
