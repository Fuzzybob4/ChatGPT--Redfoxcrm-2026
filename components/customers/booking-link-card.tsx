"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Copy, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBookingLink } from "@/app/(crm)/customers/rebook-actions";
import { bookingText } from "@/components/customers/rebook-list";

/** Returning customers: text or copy their "pick your install day" link. */
export function BookingLinkCard({ customerId, bookedLabel }: { customerId: string; bookedLabel: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const go = (mode: "text" | "copy") => {
    setMsg(null);
    start(async () => {
      const r = await getBookingLink(customerId);
      if ("error" in r) return setMsg({ ok: false, text: r.error });
      const body = bookingText(r.firstName, r.businessName, r.url);
      if (mode === "text" && r.phone) {
        window.location.href = `sms:${r.phone}?&body=${encodeURIComponent(body)}`;
        return;
      }
      await navigator.clipboard?.writeText(mode === "copy" ? r.url : body).catch(() => {});
      setMsg({ ok: true, text: mode === "copy" ? "Link copied." : "No phone on file, so the message was copied." });
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarCheck className="size-4 text-muted-foreground" /> Booking link
      </p>
      <p className="text-xs text-muted-foreground">
        {bookedLabel ? `Already booked: ${bookedLabel}.` : "Returning customer: they can pick their own install day."}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go("text")}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
          Text link
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go("copy")}>
          <Copy className="size-4" /> Copy link
        </Button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}
