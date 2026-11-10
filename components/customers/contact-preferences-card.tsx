"use client";

import { useEffect, useState } from "react";
import { Ban, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ContactPrefs } from "@/lib/contact-prefs";
import { getContactPrefs, saveContactPrefs } from "@/app/(crm)/customers/contact-prefs-actions";

export function ContactPreferencesCard({ customerId, onChanged }: { customerId: string; onChanged?: () => void }) {
  const [prefs, setPrefs] = useState<ContactPrefs | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getContactPrefs(customerId)
      .then((p) => {
        if (!alive) return;
        setPrefs(p);
        setReason(p.doNotContactReason ?? "");
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't load preferences."));
    return () => {
      alive = false;
    };
  }, [customerId]);

  async function save(next: Partial<ContactPrefs>, nextReason = reason) {
    if (!prefs) return;
    const merged = { ...prefs, ...next };
    setSaving(true);
    setError(null);
    try {
      const saved = await saveContactPrefs(customerId, {
        doNotContact: merged.doNotContact,
        reason: nextReason,
        emailOptOut: merged.emailOptOut,
        textOptOut: merged.textOptOut,
      });
      setPrefs(saved);
      setReason(saved.doNotContactReason ?? "");
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const dnc = prefs?.doNotContact ?? false;

  return (
    <Card className={dnc ? "border-destructive/50" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {dnc ? <Ban className="size-4 text-destructive" /> : <ShieldCheck className="size-4 text-primary" />}
          Contact preferences
          {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
        <CardDescription className="text-xs">
          Applies to promotions, rebooking texts and sales calls. Invoices and schedule updates for work they
          bought still go out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!prefs && !error && <p className="text-xs text-muted-foreground">Loading…</p>}
        {prefs && (
          <>
            {dnc && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <p className="font-semibold">Do not contact</p>
                <p>
                  Asked not to be contacted
                  {prefs.doNotContactAt
                    ? ` on ${new Date(prefs.doNotContactAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                  .
                </p>
              </div>
            )}

            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">Do not contact</span>
                <span className="block text-xs text-muted-foreground">No marketing calls, texts or emails</span>
              </span>
              <Switch checked={dnc} disabled={saving} onCheckedChange={(v: boolean) => save({ doNotContact: v })} />
            </label>

            {dnc && (
              <div className="flex gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="h-8 text-xs"
                  maxLength={500}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || reason === (prefs.doNotContactReason ?? "")}
                  onClick={() => save({}, reason)}
                >
                  Save
                </Button>
              </div>
            )}

            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">No marketing emails</span>
                <span className="block text-xs text-muted-foreground">Unsubscribed from email campaigns</span>
              </span>
              <Switch
                checked={dnc || prefs.emailOptOut}
                disabled={saving || dnc}
                onCheckedChange={(v: boolean) => save({ emailOptOut: v })}
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">No marketing texts</span>
                <span className="block text-xs text-muted-foreground">Opted out of promotional texts</span>
              </span>
              <Switch
                checked={dnc || prefs.textOptOut}
                disabled={saving || dnc}
                onCheckedChange={(v: boolean) => save({ textOptOut: v })}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
