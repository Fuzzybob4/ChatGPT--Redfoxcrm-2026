"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { QuoteOption, QuoteSettings } from "@/lib/quotes/pricing";
import type { MeasureResult } from "@/lib/quotes/measure";
import { satelliteUrl } from "@/lib/quotes/satellite";
import { saveQuoteSettings, testMeasureAddress } from "@/app/(crm)/settings/quote-actions";

/** Try the satellite measurement on homes you've already measured, before going live. */
function MeasurementTester({ mapboxToken, tolerance }: { mapboxToken: string; tolerance: number }) {
  const [address, setAddress] = useState("");
  const [actual, setActual] = useState("");
  const [result, setResult] = useState<MeasureResult | null>(null);
  const [solar, setSolar] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const actualFt = Number(actual);
  const diff = result?.feet && actualFt > 0 ? Math.round(((result.feet - actualFt) / actualFt) * 100) : null;

  function run() {
    setErr(null);
    start(async () => {
      const res = await testMeasureAddress(address);
      if (!res.ok) return setErr(res.error);
      setResult(res.result);
      setSolar(res.solarConfigured);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div>
        <p className="text-sm font-medium">Test the measurement</p>
        <p className="text-xs text-muted-foreground">
          Private to your team. Try homes you&apos;ve already measured and compare. Nothing is saved and no customer sees it.
        </p>
      </div>
      <div className="flex gap-2">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address, city, state"
          onKeyDown={(e) => { if (e.key === "Enter") run(); }} />
        <Button type="button" onClick={run} disabled={pending} className="shrink-0">{pending ? "Measuring…" : "Measure"}</Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{result.formattedAddress}</p>
          {mapboxToken && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={satelliteUrl(mapboxToken, result)} alt="Satellite view" className="w-full rounded-lg border" />
          )}
          {result.source === "satellite" ? (
            <p className="text-sm">Measured front roofline: <span className="font-semibold">{result.feet} ft</span> (yellow line)</p>
          ) : (
            <p className="text-sm text-amber-700">
              {solar
                ? "No roof data for this address, so customers would type their own footage here."
                : "Satellite roof measuring isn't switched on yet (Google Solar key not added), so this only finds the address."}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs">Your real measurement (ft)</Label>
            <Input type="number" min={0} className="w-28" value={actual} onChange={(e) => setActual(e.target.value)} />
            {diff !== null && (
              <span className={`text-sm font-medium ${Math.abs(diff) <= tolerance ? "text-emerald-700" : "text-destructive"}`}>
                {diff > 0 ? "+" : ""}{diff}% {Math.abs(diff) <= tolerance ? "· within tolerance" : "· too far off"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionList({ title, items, onChange }: { title: string; items: QuoteOption[]; onChange: (v: QuoteOption[]) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{title}</Label>
      {items.map((o, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={o.label}
            placeholder="Size"
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
          />
          <Input
            type="number"
            min={0}
            className="w-28"
            value={o.price}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))}
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...items, { label: "", price: 0 }])}>
        <Plus className="size-3.5" /> Add size
      </Button>
    </div>
  );
}

export function InstantQuoteSettings({ initial, suggestedSlug, mapboxToken }: { initial: QuoteSettings | null; suggestedSlug: string; mapboxToken: string }) {
  const [s, setS] = useState({
    enabled: initial?.enabled ?? false,
    slug: initial?.slug ?? suggestedSlug,
    pricePerFoot1Story: initial?.pricePerFoot1Story ?? 9,
    pricePerFoot2Story: initial?.pricePerFoot2Story ?? 10,
    depositPercent: initial?.depositPercent ?? 50,
    tolerancePercent: initial?.tolerancePercent ?? 15,
    minimumTotal: initial?.minimumTotal ?? 0,
    wreaths: initial?.wreaths ?? [
      { label: "24 inch", price: 75 },
      { label: "36 inch", price: 125 },
      { label: "48 inch", price: 175 },
      { label: "60 inch", price: 250 },
    ],
    trees: initial?.trees ?? [
      { label: "Up to 15 ft", price: 200 },
      { label: "15-25 ft", price: 350 },
      { label: "25-35 ft", price: 500 },
      { label: "35 ft+", price: 750 },
    ],
    intro: initial?.intro ?? "",
  });
  const [savedSlug, setSavedSlug] = useState(initial?.slug ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.redfoxcrm.com";
  const link = savedSlug ? `${origin}/quote/${savedSlug}` : null;

  const num = (k: keyof typeof s) => ({
    type: "number" as const,
    min: 0,
    value: s[k] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) }),
  });

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveQuoteSettings(s);
      if (!res.ok) return setMsg(res.error);
      setSavedSlug(res.slug);
      setS((p) => ({ ...p, slug: res.slug }));
      setMsg("Saved.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Instant online quote</CardTitle>
        <CardDescription>
          Customers enter their address, we measure the front roofline from satellite, they pick wreaths and trees, approve
          and pay the deposit — no back-and-forth. Each quote lands in Customers and Estimates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <MeasurementTester mapboxToken={mapboxToken} tolerance={s.tolerancePercent} />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Accept online quotes</p>
            <p className="text-xs text-muted-foreground">Leave off until the test above matches your real measurements.</p>
          </div>
          <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: Boolean(v) })} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="q-slug">Your quote link</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/quote/</span>
            <Input id="q-slug" value={s.slug} onChange={(e) => setS({ ...s, slug: e.target.value })} />
          </div>
          {link && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="break-all text-muted-foreground">{link}</span>
              <Button type="button" variant="outline" size="xs" className="gap-1" onClick={() => navigator.clipboard?.writeText(link)}>
                <Copy className="size-3" /> Copy
              </Button>
              <Button variant="outline" size="xs" className="gap-1" render={<a href={link} target="_blank" rel="noreferrer" />}>
                <ExternalLink className="size-3" /> Open
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Put this link on your website, Facebook page, and yard signs.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">1-story, $ per foot</Label>
            <Input step="0.25" {...num("pricePerFoot1Story")} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">2-story, $ per foot</Label>
            <Input step="0.25" {...num("pricePerFoot2Story")} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Deposit %</Label>
            <Input max={100} {...num("depositPercent")} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Re-measure tolerance %</Label>
            <Input max={100} {...num("tolerancePercent")} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Minimum order $</Label>
            <Input {...num("minimumTotal")} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <OptionList title="Wreaths (size and price)" items={s.wreaths} onChange={(wreaths) => setS({ ...s, wreaths })} />
          <OptionList title="Trees (size and price)" items={s.trees} onChange={(trees) => setS({ ...s, trees })} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="q-intro" className="text-xs">Intro line (optional)</Label>
          <Input
            id="q-intro"
            value={s.intro}
            placeholder="Get your holiday lighting price in about a minute, then book online."
            onChange={(e) => setS({ ...s, intro: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save quote settings"}</Button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
