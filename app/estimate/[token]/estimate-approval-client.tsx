"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { approveEstimate, declineEstimate } from "./actions";

interface Props {
  token: string;
  business: { name: string; phone: string | null; email: string | null };
  customer: { name: string; address: string };
  estimate: {
    number: string;
    title: string;
    description: string | null;
    notes: string | null;
    subtotal: number;
    taxAmount: number;
    total: number;
    depositPercent: number;
    depositAmount: number;
    validUntil: string | null;
    createdAt: string | null;
    approvedAt: string | null;
    approvedByName: string | null;
    declinedAt: string | null;
  };
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (d: string | null) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

export function EstimateApprovalClient({ token, business, customer, estimate }: Props) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState<{ portalUrl: string; hasDeposit: boolean } | null>(null);
  const [declined, setDeclined] = useState(Boolean(estimate.declinedAt));
  const [pending, startTransition] = useTransition();

  const alreadyApproved = Boolean(estimate.approvedAt) && !approved;

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const res = await approveEstimate(token, { name, agreed });
      if (!res.ok) setError(res.error);
      else setApproved({ portalUrl: res.portalUrl, hasDeposit: res.hasDeposit });
    });
  }

  function onDecline() {
    setError(null);
    startTransition(async () => {
      const res = await declineEstimate(token, reason);
      if (!res.ok) setError(res.error ?? "Could not save your response.");
      else setDeclined(true);
    });
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Estimate from</p>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          {(business.phone || business.email) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[business.phone, business.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <CardTitle className="text-lg">{estimate.title}</CardTitle>
              {estimate.number && <span className="text-sm text-muted-foreground">#{estimate.number}</span>}
            </div>
            <p className="text-sm text-muted-foreground">
              For {customer.name}
              {customer.address ? ` · ${customer.address}` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {estimate.description && <p className="whitespace-pre-line text-sm">{estimate.description}</p>}

            <div className="space-y-1 rounded-lg border bg-background p-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{usd(estimate.subtotal)}</span>
              </div>
              {estimate.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{usd(estimate.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{usd(estimate.total)}</span>
              </div>
              {estimate.depositPercent > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Deposit due at approval ({estimate.depositPercent}%)</span>
                  <span>{usd(estimate.depositAmount)}</span>
                </div>
              )}
            </div>

            {estimate.notes && (
              <div className="text-sm">
                <p className="font-medium">Notes</p>
                <p className="whitespace-pre-line text-muted-foreground">{estimate.notes}</p>
              </div>
            )}
            {estimate.validUntil && (
              <p className="text-xs text-muted-foreground">Valid until {day(estimate.validUntil)}</p>
            )}
          </CardContent>
        </Card>

        {approved ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <CheckCircle2 className="size-10 text-emerald-600" />
              <p className="text-lg font-semibold">Approved — thank you!</p>
              <p className="text-sm text-muted-foreground">
                {approved.hasDeposit
                  ? "Your invoice is ready. Pay the deposit to lock in your spot."
                  : `${business.name} will be in touch to schedule your install.`}
              </p>
              <Button render={<a href={approved.portalUrl} />} className="w-full sm:w-auto">
                {approved.hasDeposit ? `Pay deposit ${usd(estimate.depositAmount)}` : "View your invoice"}
              </Button>
            </CardContent>
          </Card>
        ) : alreadyApproved ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-6 text-center text-sm">
              Approved by <strong>{estimate.approvedByName}</strong> on {day(estimate.approvedAt)}.
              Contact {business.name} with any questions.
            </CardContent>
          </Card>
        ) : declined ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center text-sm">
              <XCircle className="size-8 text-muted-foreground" />
              You declined this estimate. {business.name} has been notified and may follow up.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{declining ? "Decline this estimate" : "Approve and sign"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {declining ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Anything you'd like {business.name} to know? (optional)</Label>
                    <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="destructive" onClick={onDecline} disabled={pending}>
                      {pending ? "Saving…" : "Decline estimate"}
                    </Button>
                    <Button variant="ghost" onClick={() => setDeclining(false)} disabled={pending}>
                      Back
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sig">Type your full name to sign</Label>
                    <Input
                      id="sig"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      autoComplete="name"
                      className="text-lg"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                    <span>
                      I approve this estimate for {usd(estimate.total)} and agree to {business.name}&apos;s terms.
                      Typing my name counts as my electronic signature.
                    </span>
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={onApprove} disabled={pending} className="sm:flex-1">
                      {pending ? "Saving…" : "Approve estimate"}
                    </Button>
                    <Button variant="outline" onClick={() => setDeclining(true)} disabled={pending}>
                      Decline
                    </Button>
                  </div>
                </>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">Powered by Red Fox CRM</p>
      </div>
    </div>
  );
}
