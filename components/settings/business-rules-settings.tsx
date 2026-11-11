"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveBusinessRules, type BusinessRulesInput } from "@/app/(crm)/settings/business-rules-actions";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
] as const;
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function BusinessRulesSettings({ initial, canEdit }: { initial: BusinessRulesInput; canEdit: boolean }) {
  const [rules, setRules] = useState<BusinessRulesInput>(initial);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof BusinessRulesInput>(k: K, v: BusinessRulesInput[K]) => {
    setRules((r) => ({ ...r, [k]: v }));
    setNote(null);
  };
  const zoneKnown = ZONES.some(([z]) => z === rules.timezone);

  function save() {
    start(async () => {
      const r = await saveBusinessRules(rules);
      setNote(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Season</CardTitle>
          <CardDescription>
            When your booking season starts each year. Invoices and estimates from before this date count as last season, so
            those customers show as "past customers" until they book again.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Season starts</Label>
            <div className="flex gap-2">
              <select className={selectCls} disabled={!canEdit} value={rules.seasonStartMonth} onChange={(e) => set("seasonStartMonth", Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select className={`${selectCls} w-20`} disabled={!canEdit} value={rules.seasonStartDay} onChange={(e) => set("seasonStartDay", Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Time zone</Label>
            <select className={selectCls} disabled={!canEdit} value={rules.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {!zoneKnown && <option value={rules.timezone}>{rules.timezone}</option>}
              {ZONES.map(([z, label]) => (
                <option key={z} value={z}>{label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">Used for "today" on the schedule and crew app.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Removal season & rebooking</CardTitle>
          <CardDescription>
            The first takedown day. The Removals planner on the schedule starts here, and (if turned on) every customer
            you installed gets an email that day offering the same setup next season at this season&apos;s price.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Removals start</Label>
            <div className="flex gap-2">
              <select className={selectCls} disabled={!canEdit} value={rules.removalStartMonth} onChange={(e) => set("removalStartMonth", Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select className={`${selectCls} w-20`} disabled={!canEdit} value={rules.removalStartDay} onChange={(e) => set("removalStartDay", Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Send rebook offers automatically</span>
              <span className="block text-xs text-muted-foreground">
                On the first removal day: next season&apos;s invoice at this season&apos;s price, emailed with a deposit link.
                Skips Do-not-contact customers, anyone unsubscribed, and contract customers. Needs email set up.
              </span>
            </span>
            <Switch checked={rules.rebookAuto} disabled={!canEdit} onCheckedChange={(v: boolean) => set("rebookAuto", v)} />
          </label>
          {rules.rebookAuto && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Deposit to rebook</Label>
              <Input type="number" min="0" max="100" step="5" className="h-9 w-24" disabled={!canEdit}
                value={rules.rebookDepositPercent} onChange={(e) => set("rebookDepositPercent", Number(e.target.value))} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Install time windows</CardTitle>
          <CardDescription>The windows auto-schedule gives each crew's stops, in order (1st job, 2nd job, …).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rules.daySlots.map(([a, b], i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-xs text-muted-foreground">Job {i + 1}</span>
              <Input type="time" className="h-9 w-32" disabled={!canEdit} value={a}
                onChange={(e) => set("daySlots", rules.daySlots.map((s, j) => (j === i ? [e.target.value, s[1]] : s)) as [string, string][])} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="time" className="h-9 w-32" disabled={!canEdit} value={b}
                onChange={(e) => set("daySlots", rules.daySlots.map((s, j) => (j === i ? [s[0], e.target.value] : s)) as [string, string][])} />
              {canEdit && rules.daySlots.length > 1 && (
                <Button variant="ghost" size="icon" aria-label="Remove window" onClick={() => set("daySlots", rules.daySlots.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
          {canEdit && rules.daySlots.length < 8 && (
            <Button variant="outline" size="sm" className="gap-1"
              onClick={() => {
                const last = rules.daySlots[rules.daySlots.length - 1]?.[1] ?? "08:00";
                const [h, m] = last.split(":").map(Number);
                const end = `${String(Math.min(h + 2, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                set("daySlots", [...rules.daySlots, [last, end]]);
              }}>
              <Plus className="size-3.5" /> Add window
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job sizes</CardTitle>
          <CardDescription>
            How much of a crew's day each size uses. A standard job counts as 1; a crew limit of 3 means three standard jobs a day.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          {(["small", "standard", "large"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs capitalize">{k}</Label>
              <Input type="number" step="0.25" min="0.25" max="10" className="h-9" disabled={!canEdit}
                value={rules.sizePoints[k]}
                onChange={(e) => set("sizePoints", { ...rules.sizePoints, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crew app privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Hide prices and payments from crews</span>
              <span className="block text-xs text-muted-foreground">
                Removes dollar amounts, balances and payment notes from what installers see. Install items always show.
              </span>
            </span>
            <Switch checked={rules.crewHidePrices} disabled={!canEdit} onCheckedChange={(v: boolean) => set("crewHidePrices", v)} />
          </label>
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          {note && <span className={`text-sm ${note.ok ? "text-emerald-600" : "text-destructive"}`}>{note.text}</span>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only owners and admins can change these.</p>
      )}
    </div>
  );
}
