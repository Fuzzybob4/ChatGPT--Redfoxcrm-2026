"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Eye, Link2, MessageSquare, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getEstimateApprovalInfo,
  markEstimateAccepted,
  shareEstimate,
  type EstimateApprovalInfo,
} from "@/app/(crm)/estimates/approval-actions";

const when = (d: string | null) => (d ? new Date(d).toLocaleString() : "");

export function EstimateApprovalPanel({ estimateId, onChanged }: { estimateId: string; onChanged?: () => void }) {
  const [info, setInfo] = useState<EstimateApprovalInfo | null>(null);
  const [deposit, setDeposit] = useState("50");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getEstimateApprovalInfo(estimateId)
      .then((i) => {
        setInfo(i);
        if (i.link) setDeposit(String(i.depositPercent));
      })
      .catch(() => setError("Could not load approval status."));
  }, [estimateId]);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function createLink() {
    run(async () => {
      const { link } = await shareEstimate(estimateId, Number(deposit));
      setInfo(await getEstimateApprovalInfo(estimateId));
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onChanged?.();
    });
  }

  function accept() {
    if (!window.confirm("Mark this estimate accepted and create the invoice?")) return;
    run(async () => {
      await markEstimateAccepted(estimateId);
      setInfo(await getEstimateApprovalInfo(estimateId));
      onChanged?.();
    });
  }

  if (!info) {
    return error ? <p className="text-sm text-destructive">{error}</p> : null;
  }

  if (info.approvedAt) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">Approved</p>
              <p className="text-sm text-emerald-800">
                Signed by <strong>{info.approvedByName}</strong> · {when(info.approvedAt)}
              </p>
            </div>
          </div>
          {info.invoiceId && (
            <Button size="sm" variant="outline" render={<Link href={`/invoices/${info.invoiceId}`} />}>
              View invoice
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const smsBody = info.link ? encodeURIComponent(`Here's your estimate — you can review and approve it here: ${info.link}`) : "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4 text-primary" /> Send for online approval
        </CardTitle>
        <CardDescription>
          The customer opens a link, signs with their name, and can pay the deposit right away. An invoice is
          created automatically when they approve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {info.declinedAt && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
            <XCircle className="mt-0.5 size-4 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Customer declined · {when(info.declinedAt)}</p>
              {info.declineReason && <p className="text-red-800">&ldquo;{info.declineReason}&rdquo;</p>}
            </div>
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="deposit" className="text-xs">Deposit at approval</Label>
            <div className="flex items-center gap-1">
              <Input
                id="deposit"
                type="number"
                min={0}
                max={100}
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="h-9 w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <Button onClick={createLink} disabled={pending} className="gap-2">
            {copied ? <CheckCircle2 className="size-4" /> : <Link2 className="size-4" />}
            {copied ? "Link copied" : info.link ? "Update & copy link" : "Create & copy link"}
          </Button>
        </div>

        {info.link && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input readOnly value={info.link} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button
                size="icon"
                variant="outline"
                aria-label="Copy link"
                onClick={() => navigator.clipboard?.writeText(info.link!)}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {info.customerPhone && (
                <Button size="sm" variant="outline" className="gap-2" render={<a href={`sms:${info.customerPhone}?&body=${smsBody}`} />}>
                  <MessageSquare className="size-4" /> Text to customer
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-2" render={<a href={info.link} target="_blank" rel="noreferrer" />}>
                <Eye className="size-4" /> Preview
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {info.viewedAt ? `Customer opened it ${when(info.viewedAt)}.` : "Not opened by the customer yet."}
            </p>
          </div>
        )}

        <div className="border-t pt-3">
          <Button size="sm" variant="ghost" onClick={accept} disabled={pending}>
            Customer said yes by phone? Mark as accepted
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
