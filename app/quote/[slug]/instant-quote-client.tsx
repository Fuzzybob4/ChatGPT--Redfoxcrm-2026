"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MapPin, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { computeQuote, type QuoteSettings } from "@/lib/quotes/pricing";
import type { MeasureResult } from "@/lib/quotes/measure";
import { satelliteUrl } from "@/lib/quotes/satellite";
import { lookupAddress, submitInstantQuote } from "./actions";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function Stepper({ value, onChange, min = 0, max = 50, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="icon" variant="outline" aria-label="Less" onClick={() => onChange(Math.max(min, value - step))}>
        <Minus className="size-4" />
      </Button>
      <span className="w-12 text-center font-semibold tabular-nums">{value}</span>
      <Button type="button" size="icon" variant="outline" aria-label="More" onClick={() => onChange(Math.min(max, value + step))}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

export function InstantQuoteClient({
  slug,
  settings,
  business,
  mapboxToken,
}: {
  slug: string;
  settings: QuoteSettings;
  business: { name: string; phone: string | null; email: string | null };
  mapboxToken: string;
}) {
  const [address, setAddress] = useState("");
  const [measure, setMeasure] = useState<MeasureResult | null>(null);
  const [stories, setStories] = useState<1 | 2>(1);
  const [feet, setFeet] = useState(0);
  const [wreaths, setWreaths] = useState<Record<number, number>>({});
  const [trees, setTrees] = useState<Record<number, number>>({});
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ portalUrl: string; deposit: number } | null>(null);
  const [looking, startLookup] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const quote = useMemo(
    () => computeQuote(settings, { feet, stories, wreaths, trees }),
    [settings, feet, stories, wreaths, trees],
  );

  function find() {
    setError(null);
    startLookup(async () => {
      const res = await lookupAddress(slug, address);
      if (!res.ok) return setError(res.error);
      setMeasure(res.result);
      setFeet(res.result.feet ?? 0);
    });
  }

  function submit() {
    if (!measure) return;
    setError(null);
    startSubmit(async () => {
      const res = await submitInstantQuote(slug, {
        selection: { feet, stories, wreaths, trees },
        measuredFeet: measure.feet,
        measurementSource: measure.source === "satellite" ? "satellite" : "customer",
        address: {
          formatted: measure.formattedAddress,
          street: measure.street,
          city: measure.city,
          state: measure.state,
          zip: measure.zip,
          lat: measure.lat,
          lng: measure.lng,
        },
        contact,
        signature,
        agreed,
        website,
      });
      if (!res.ok) setError(res.error);
      else setDone({ portalUrl: res.portalUrl, deposit: res.deposit });
    });
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="size-12 text-emerald-600" />
            <h1 className="text-xl font-semibold">You&apos;re almost booked!</h1>
            <p className="text-sm text-muted-foreground">
              Your quote is approved. Pay the {usd(done.deposit)} deposit to lock in your install with {business.name}.
            </p>
            <Button render={<a href={done.portalUrl} />} className="w-full">
              Pay deposit {usd(done.deposit)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          <p className="text-sm text-muted-foreground">
            {settings.intro || "Get your holiday lighting price in about a minute, then book online."}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">1. Your home</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") find(); }}
                placeholder="Street address, city, state"
                autoComplete="street-address"
              />
              <Button onClick={find} disabled={looking} className="shrink-0 gap-1">
                {looking ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />} Find
              </Button>
            </div>
            <div className="flex gap-2">
              {([1, 2] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={stories === s ? "default" : "outline"}
                  onClick={() => setStories(s)}
                  className="flex-1"
                >
                  {s}-story · {usd(s === 2 ? settings.pricePerFoot2Story : settings.pricePerFoot1Story)}/ft
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {measure && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2. Front roofline</CardTitle>
              <CardDescription className="text-xs">{measure.formattedAddress}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mapboxToken && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={satelliteUrl(mapboxToken, measure)}
                  alt="Satellite view of your home"
                  className="w-full rounded-lg border"
                />
              )}
              <p className="text-sm text-muted-foreground">
                {measure.source === "satellite"
                  ? `We measured about ${measure.feet} ft of front roofline (yellow line). Adjust it if it looks off.`
                  : "Enter roughly how many feet of front roofline you'd like lit. A typical single-story home is 60–120 ft."}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Feet of roofline</span>
                <Stepper value={feet} onChange={setFeet} max={1000} step={5} />
              </div>
            </CardContent>
          </Card>
        )}

        {measure && (settings.wreaths.length > 0 || settings.trees.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">3. Add-ons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.wreaths.map((o, i) => (
                <div key={`w${i}`} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Wreath · {o.label}</p>
                    <p className="text-xs text-muted-foreground">{usd(o.price)} each</p>
                  </div>
                  <Stepper value={wreaths[i] ?? 0} onChange={(n) => setWreaths((p) => ({ ...p, [i]: n }))} />
                </div>
              ))}
              {settings.trees.map((o, i) => (
                <div key={`t${i}`} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Tree · {o.label}</p>
                    <p className="text-xs text-muted-foreground">{usd(o.price)} each</p>
                  </div>
                  <Stepper value={trees[i] ?? 0} onChange={(n) => setTrees((p) => ({ ...p, [i]: n }))} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {measure && quote.total > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">4. Your quote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                {quote.lines.map((l) => (
                  <div key={l.label} className="flex justify-between gap-2">
                    <span>{l.label}{l.quantity > 1 && !l.label.includes(" ft") ? ` × ${l.quantity}` : ""}</span>
                    <span className="tabular-nums">{usd(l.total)}</span>
                  </div>
                ))}
                {quote.minimumApplied && (
                  <p className="text-xs text-muted-foreground">Minimum order {usd(settings.minimumTotal)} applies.</p>
                )}
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{usd(quote.total)}</span>
                </div>
                {settings.depositPercent > 0 && (
                  <div className="flex justify-between font-medium text-primary">
                    <span>Deposit today ({settings.depositPercent}%)</span>
                    <span className="tabular-nums">{usd(quote.deposit)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="fn" className="text-xs">First name</Label>
                  <Input id="fn" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} autoComplete="given-name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ln" className="text-xs">Last name</Label>
                  <Input id="ln" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} autoComplete="family-name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="em" className="text-xs">Email</Label>
                  <Input id="em" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ph" className="text-xs">Phone</Label>
                  <Input id="ph" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" />
                </div>
              </div>
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="hidden"
                aria-hidden="true"
                name="website"
              />
              <div className="space-y-1">
                <Label htmlFor="sig" className="text-xs">Type your full name to sign</Label>
                <Input id="sig" value={signature} onChange={(e) => setSignature(e.target.value)} className="text-lg" />
              </div>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                <span>
                  I approve this quote for {usd(quote.total)}. The price is final unless {business.name}&apos;s on-site
                  measurement differs by more than {settings.tolerancePercent}%. Typing my name counts as my signature.
                </span>
              </label>
              <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
                {submitting ? "Saving…" : settings.depositPercent > 0 ? `Approve & pay ${usd(quote.deposit)} deposit` : "Approve quote"}
              </Button>
            </CardContent>
          </Card>
        )}

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          {[business.phone, business.email].filter(Boolean).join(" · ")}
          {business.phone || business.email ? " · " : ""}Powered by Red Fox CRM
        </p>
      </div>
    </div>
  );
}
