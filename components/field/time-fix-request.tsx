"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestTimeFix } from "@/app/field/actions";

const input = "h-11 w-full rounded-md border border-input bg-background px-2 text-sm";

/** "My time is wrong": the crew member sends the right times; the office approves. */
export function TimeFixRequest({ days }: { days: Array<{ value: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(days[0]?.value ?? "");
  const [startT, setStartT] = useState("");
  const [endT, setEndT] = useState("");
  const [lunchStart, setLunchStart] = useState("");
  const [lunchEnd, setLunchEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <p className="rounded-xl border border-border bg-card p-3 text-sm">
        Sent. The office will approve it, and your hours update when they do.{" "}
        <button type="button" className="font-medium text-primary underline" onClick={() => { setSent(false); setOpen(true); }}>
          Send another
        </button>
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="outline" className="h-12 w-full" onClick={() => setOpen(true)}>
        Request a time fix
      </Button>
    );
  }

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await requestTimeFix({ day, start: startT, end: endT, lunchStart, lunchEnd, reason });
      if ("error" in r) return setError(r.error);
      setSent(true);
      setOpen(false);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Request a time fix</p>
      <label className="flex flex-col gap-1 text-sm">
        Day
        <select className={input} value={day} onChange={(e) => setDay(e.target.value)}>
          {days.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">Started<input type="time" className={input} value={startT} onChange={(e) => setStartT(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm">Ended<input type="time" className={input} value={endT} onChange={(e) => setEndT(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm">Lunch out<input type="time" className={input} value={lunchStart} onChange={(e) => setLunchStart(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm">Lunch back<input type="time" className={input} value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)} /></label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        What happened?
        <textarea className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm" maxLength={500}
          placeholder="Forgot to clock in at the shop, forgot to end lunch…" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="outline" className="h-12" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
        <Button className="h-12" disabled={pending} onClick={submit}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send to office
        </Button>
      </div>
    </div>
  );
}
