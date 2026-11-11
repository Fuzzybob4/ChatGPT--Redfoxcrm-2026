"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SignupCardStep } from "@/components/signup/signup-card-step";
import { createAddCardSession, saveCardAndSubscribe } from "../card-actions";

/** Owner adds (or replaces) the card used for their RedFox subscription. */
export default function AddCardPage() {
  const [session, setSession] = useState<{ clientSecret: string; customerId: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ trialEndsAt: string | null } | null>(null);

  useEffect(() => {
    createAddCardSession().then((r) => (r.ok ? setSession(r) : setError(r.error)));
  }, []);

  const trialText = (iso: string | null) =>
    iso && new Date(iso).getTime() > Date.now()
      ? `Your free trial runs through ${new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Monthly billing starts after that.`
      : "Your subscription is active.";

  return (
    <div className="flex flex-col">
      <PageHeader title="Payment method" />
      <div className="mx-auto w-full max-w-md p-4 md:p-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            {done ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
                <p className="text-lg font-semibold">Card saved, you&apos;re all set</p>
                <p className="text-sm text-muted-foreground">{trialText(done.trialEndsAt)}</p>
                <Link href="/dashboard" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Go to dashboard
                </Link>
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !session ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SignupCardStep
                clientSecret={session.clientSecret}
                customerId={session.customerId}
                submitting={saving}
                title="No charge until your free trial ends"
                note="We keep your card securely with Stripe and bill monthly after your trial. Cancel anytime in Billing."
                buttonLabel="Save card"
                onComplete={async (card) => {
                  setSaving(true);
                  const r = await saveCardAndSubscribe(card.paymentMethodId);
                  setSaving(false);
                  if (r.ok) setDone({ trialEndsAt: r.trialEndsAt });
                  else setError(r.error);
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
