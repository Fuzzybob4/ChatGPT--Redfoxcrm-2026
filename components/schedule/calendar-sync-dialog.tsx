"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createCrewCalendarFeed,
  getCalendarFeeds,
  revokeCalendarFeed,
  type CalendarFeed,
} from "@/app/(crm)/jobs/calendar-actions";

export function CalendarSyncDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [crews, setCrews] = useState<{ id: string; name: string }[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function load() {
    start(async () => {
      try {
        const r = await getCalendarFeeds();
        setFeeds(r.feeds);
        setCrews(r.crews);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Couldn't load calendar links.");
      }
    });
  }
  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  const company = feeds.find((f) => !f.crewId);
  const crewFeeds = feeds.filter((f) => f.crewId);
  const missing = crews.filter((c) => !crewFeeds.some((f) => f.crewId === c.id));

  const Row = ({ f, label }: { f: CalendarFeed; label: string }) => (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (!confirm("Reset this link? Calendars using the old link stop updating, and you'll need to add the new one.")) return;
            start(async () => {
              await revokeCalendarFeed(f.id);
              load();
            });
          }}
        >
          <RotateCcw className="size-3" /> Reset
        </button>
      </div>
      <p className="break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">{f.url}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(f.url)}>
          {copied === f.url ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied === f.url ? "Copied" : "Copy link"}
        </Button>
        <Button size="sm" variant="outline" render={<a href={f.url.replace(/^https?:/, "webcal:")} />}>
          Add to iPhone / Mac
        </Button>
        <Button
          size="sm"
          variant="outline"
          render={<a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(f.url.replace(/^https?:/, "webcal:"))}`} target="_blank" rel="noreferrer" />}
        >
          Add to Google
        </Button>
      </div>
      {f.lastFetchedAt && (
        <p className="text-[11px] text-muted-foreground">Last checked by a calendar {new Date(f.lastFetchedAt).toLocaleString()}</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync work orders to your calendar</DialogTitle>
          <DialogDescription>
            Add this link once and every scheduled work order shows in Google Calendar or your iPhone calendar, with the address, phone
            and notes. Changes in Red Fox (rain days, reschedules, cancellations) update there automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {company && <Row f={company} label="Whole company" />}
          {crewFeeds.map((f) => (
            <Row key={f.id} f={f} label={`${f.crewName} only`} />
          ))}
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Link for one crew:</span>
              {missing.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await createCrewCalendarFeed(c.id);
                      load();
                    })
                  }
                >
                  + {c.name}
                </Button>
              ))}
            </div>
          )}
          <div className="space-y-1 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <p>
              <b className="text-foreground">How fast it updates:</b> iPhone checks about every hour (Settings → Calendar → Accounts →
              Fetch New Data can make it faster). Google Calendar checks every few hours, and Google decides when.
            </p>
            <p>
              <b className="text-foreground">Keep the link private.</b> Anyone with it can see your schedule. If it gets shared by
              mistake, tap Reset.
            </p>
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
