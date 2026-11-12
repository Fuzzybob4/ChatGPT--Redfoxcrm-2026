"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveDayTimes } from "@/app/(crm)/timesheets/actions";

export interface EditableSegment {
  id: string;
  /** "HH:MM" in the business time zone. */
  clockIn: string;
  clockOut: string;
}

/** Office fixes one person's work-day times for a day, with a required reason. */
export function EditDayTimes({
  employeeId,
  employeeName,
  day,
  dayLabel,
  segments,
}: {
  employeeId: string;
  employeeName: string;
  day: string;
  dayLabel: string;
  segments: EditableSegment[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<(Omit<EditableSegment, "id"> & { id?: string })[]>(segments);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const update = (i: number, key: "clockIn" | "clockOut", v: string) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: v } : row)));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setRows(segments.length ? segments : [{ clockIn: "08:00", clockOut: "17:00" }]);
          setNote("");
          setError("");
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-8" />}>
        <Pencil className="size-3.5" />
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit time · {employeeName}</DialogTitle>
          <DialogDescription>{dayLabel}. Lunch is the gap between blocks and isn&apos;t paid.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{i === 0 ? "Clocked in" : "Back from lunch"}</Label>
                <Input type="time" value={r.clockIn} onChange={(e) => update(i, "clockIn", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{i < rows.length - 1 ? "Out to lunch" : "Clocked out"}</Label>
                <Input type="time" value={r.clockOut} onChange={(e) => update(i, "clockOut", e.target.value)} />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows((r) => [...r, { clockIn: r[r.length - 1]?.clockOut || "13:00", clockOut: "" }])}
          >
            <Plus className="size-3.5" />
            Add a time block
          </Button>
          <div className="space-y-1">
            <Label htmlFor={`note-${employeeId}-${day}`}>Why was it changed? (required)</Label>
            <Textarea
              id={`note-${employeeId}-${day}`}
              rows={2}
              placeholder="e.g. Forgot to clock out; helped Crew A until 6:15"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            disabled={pending || note.trim().length < 3}
            onClick={() =>
              start(async () => {
                const r = await saveDayTimes(employeeId, day, rows, note);
                if ("error" in r) setError(r.error);
                else {
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
