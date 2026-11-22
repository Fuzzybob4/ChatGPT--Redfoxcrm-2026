"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bookMyInstall } from "./actions";

type Half = "am" | "pm";

const dayLong = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const dayShort = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function BookingClient({
  token,
  firstName,
  business,
  state,
  bookedDay,
  bookedHalf,
  days,
}: {
  token: string;
  firstName: string;
  business: { name: string; phone: string | null; email: string | null };
  state: "open" | "closed" | "not_returning" | "booked" | "full";
  bookedDay: string | null;
  bookedHalf: Half | null;
  days: Array<{ day: string; morning: boolean; afternoon: boolean }>;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [half, setHalf] = useState<Half | null>(null);
  const [done, setDone] = useState<{ day: string; half: Half } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const picked = days.find((d) => d.day === day);

  const contact = (
    <p className="text-sm text-muted-foreground">
      {business.phone && (
        <a className="inline-flex items-center gap-1 font-medium text-primary" href={`tel:${business.phone}`}>
          <Phone className="size-4" /> {business.phone}
        </a>
      )}
      {business.phone && business.email && " · "}
      {business.email && <a className="font-medium text-primary" href={`mailto:${business.email}`}>{business.email}</a>}
    </p>
  );

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-background p-6 shadow-sm">
        <p className="text-sm font-semibold text-muted-foreground">{business.name}</p>
        {children}
      </div>
    </main>
  );

  const confirmed = done ?? (state === "booked" && bookedDay ? { day: bookedDay, half: bookedHalf ?? "am" } : null);
  if (confirmed) {
    return shell(
      <>
        <CalendarCheck className="size-10 text-emerald-600" />
        <h1 className="text-2xl font-semibold">You&apos;re booked{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="text-base">
          {dayLong(confirmed.day)}, {confirmed.half === "am" ? "morning (8 AM–12 PM)" : "afternoon (1–5 PM)"}.
        </p>
        <p className="text-sm text-muted-foreground">We&apos;ll reach out before we arrive. Need a different day? Contact us:</p>
        {contact}
      </>,
    );
  }
  if (state !== "open") {
    const msg =
      state === "closed"
        ? "Online booking isn't open right now."
        : state === "not_returning"
          ? "Online booking is for returning customers. We'd love to get you set up. Reach out and we'll find you a day."
          : "Our online spots are full right now. Reach out and we'll find you a day.";
    return shell(
      <>
        <h1 className="text-2xl font-semibold">Book your install</h1>
        <p className="text-base">{msg}</p>
        {contact}
      </>,
    );
  }

  const submit = () => {
    if (!day || !half) return;
    setError(null);
    start(async () => {
      const r = await bookMyInstall(token, day, half);
      if ("error" in r) return setError(r.error);
      setDone({ day, half });
    });
  };

  return shell(
    <>
      <h1 className="text-2xl font-semibold">Welcome back{firstName ? `, ${firstName}` : ""}!</h1>
      <p className="text-base text-muted-foreground">Pick the day you&apos;d like your lights installed this season.</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => {
              setDay(d.day);
              setHalf(d.morning && !d.afternoon ? "am" : !d.morning && d.afternoon ? "pm" : null);
            }}
            className={`min-h-12 rounded-lg border px-2 py-2 text-sm font-medium ${day === d.day ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            {dayShort(d.day)}
          </button>
        ))}
      </div>

      {picked && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{dayLong(picked.day)}: what time works?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!picked.morning} onClick={() => setHalf("am")}
              className={`min-h-12 rounded-lg border text-sm font-medium disabled:opacity-40 ${half === "am" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
              Morning<br /><span className="text-xs font-normal">8 AM–12 PM</span>
            </button>
            <button type="button" disabled={!picked.afternoon} onClick={() => setHalf("pm")}
              className={`min-h-12 rounded-lg border text-sm font-medium disabled:opacity-40 ${half === "pm" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
              Afternoon<br /><span className="text-xs font-normal">1–5 PM</span>
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="h-12 text-base" disabled={!day || !half || pending} onClick={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Book {day && half ? `${dayShort(day)} ${half === "am" ? "morning" : "afternoon"}` : "my install"}
      </Button>
      <p className="text-xs text-muted-foreground">Questions? Contact us:</p>
      {contact}
    </>,
  );
}
