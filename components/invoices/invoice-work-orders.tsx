"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CrewSelect } from "@/components/crews/crew-select";
import type { Job } from "@/lib/data";
import { scheduleInvoiceJob } from "@/app/(crm)/jobs/actions";

const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** The invoice's work orders, and a quick way to put the install on the calendar. */
export function InvoiceWorkOrders({ invoiceId, jobs, onChanged }: { invoiceId: string; jobs: Job[]; onChanged: () => void }) {
  const hasInstall = jobs.some((j) => j.jobType === "install" && j.status !== "Cancelled");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const [crewId, setCrewId] = useState("");
  const [type, setType] = useState<"install" | "removal">(hasInstall ? "removal" : "install");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await scheduleInvoiceJob({ invoiceId, date, startTime: start, endTime: end, crewId, jobType: type });
      if (!r.ok) return setMsg(r.error);
      setOpen(false);
      setDate("");
      onChanged();
    });
  }

  return (
    <Card className="mt-4 print:hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="size-4" /> Work orders
        </CardTitle>
        {!open && (
          <Button size="sm" variant={hasInstall ? "outline" : "default"} className="gap-1" onClick={() => { setType(hasInstall ? "removal" : "install"); setOpen(true); }}>
            <CalendarPlus className="size-3.5" /> {hasInstall ? "Schedule another" : "Schedule install"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.length === 0 && !open && (
          <p className="text-sm text-muted-foreground">
            No work order yet. Schedule the install and it goes on the Work Orders calendar, the Crew Schedule and synced calendars.
          </p>
        )}
        {jobs.map((j) => (
          <Link key={j.id} href={`/field/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
            <span className="min-w-0">
              <span className="block truncate font-medium">{j.title}</span>
              <span className="text-xs text-muted-foreground">
                {day(j.scheduledDate)}
                {j.scheduledTime ? ` · ${j.scheduledTime}` : ""}
                {j.technicianName ? ` · ${j.technicianName}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{j.archivedAt ? "Archived" : j.status}</span>
          </Link>
        ))}
        {open && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-1">
              {(["install", "removal"] as const).map((t) => (
                <Button key={t} type="button" size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>
                  {t === "install" ? "Install" : "Removal"}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 space-y-1 sm:col-span-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Crew</Label>
              <CrewSelect value={crewId} onChange={setCrewId} />
            </div>
            {msg && <p className="text-sm text-destructive">{msg}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={pending || !date} onClick={save}>{pending ? "Saving…" : "Put it on the calendar"}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
