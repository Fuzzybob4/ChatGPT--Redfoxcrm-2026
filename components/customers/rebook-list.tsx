"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Box, House, Loader2, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emailBookingLinks, getBookingLink } from "@/app/(crm)/customers/rebook-actions";

export interface RebookRow {
  id: string;
  name: string;
  city: string;
  phone: string | null;
  email: string | null;
  kind: "past" | "customer_lights";
  booked: boolean;
}

export function bookingText(firstName: string, business: string, url: string) {
  return `Hi${firstName ? ` ${firstName}` : ""}, it's ${business}! Booking is open for this season's holiday lights. Returning customers get first pick, so grab your install day here: ${url}`;
}

/** Returning customers who haven't booked: text one at a time, or email the whole list. */
export function RebookList({ rows }: { rows: RebookRow[] }) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const shown = useMemo(() => rows.filter((r) => filter === "all" || !r.booked), [rows, filter]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const emailable = shown.filter((r) => r.email && !r.booked);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const text = (r: RebookRow) => {
    setMsg(null);
    setBusy(r.id);
    start(async () => {
      const link = await getBookingLink(r.id);
      setBusy(null);
      if ("error" in link) return setMsg({ ok: false, text: link.error });
      const body = bookingText(link.firstName, link.businessName, link.url);
      if (r.phone) window.location.href = `sms:${r.phone}?&body=${encodeURIComponent(body)}`;
      else {
        await navigator.clipboard?.writeText(body).catch(() => {});
        setMsg({ ok: true, text: "No phone on file, so the message was copied." });
      }
    });
  };

  const emailSelected = () => {
    const ids = [...selected].filter((id) => emailable.some((r) => r.id === id));
    if (!ids.length) return setMsg({ ok: false, text: "Pick customers with an email first." });
    if (!window.confirm(`Email booking links to ${ids.length} customer${ids.length === 1 ? "" : "s"}?`)) return;
    setMsg(null);
    start(async () => {
      const r = await emailBookingLinks(ids);
      if ("error" in r) return setMsg({ ok: false, text: r.error });
      setSelected(new Set());
      setMsg({ ok: true, text: `Sent ${r.sent}.${r.skipped ? ` Skipped ${r.skipped} (no email or opted out).` : ""}` });
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-muted p-0.5 text-sm font-medium">
          <button type="button" onClick={() => setFilter("open")} className={`rounded-md px-3 py-1.5 ${filter === "open" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            Not booked ({rows.filter((r) => !r.booked).length})
          </button>
          <button type="button" onClick={() => setFilter("all")} className={`rounded-md px-3 py-1.5 ${filter === "all" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            All returning ({rows.length})
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSelected(new Set(emailable.map((r) => r.id)))}>
          Select all with email ({emailable.length})
        </Button>
        <Button size="sm" disabled={pending || !selected.size} onClick={emailSelected}>
          {pending && !busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Email links ({selected.size})
        </Button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3">
            <input type="checkbox" className="size-5" aria-label={`Select ${r.name}`} disabled={!r.email || r.booked}
              checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
            <div className="min-w-0 flex-1">
              <Link href={`/customers/${r.id}`} className="block truncate font-medium hover:underline">{r.name}</Link>
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {r.kind === "past" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><Box className="size-3" /> Past · tote</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400"><House className="size-3" /> Customer lights</span>
                )}
                {r.city && <span>{r.city}</span>}
                {r.booked && <span className="font-medium text-foreground">Booked</span>}
                {!r.email && <span>no email</span>}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={pending || r.booked} onClick={() => text(r)}>
              {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
              Text
            </Button>
          </li>
        ))}
        {!shown.length && <li className="p-6 text-center text-sm text-muted-foreground">Everyone&apos;s booked.</li>}
      </ul>
    </div>
  );
}
