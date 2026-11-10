"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getRefundInfo, refundInvoice, type RefundInfo } from "@/app/(crm)/invoices/refund-actions";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function RefundDialog({ invoiceId, onComplete }: { invoiceId: string; onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<RefundInfo | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"card" | "manual">("card");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function show() {
    setOpen(true);
    setMsg(null);
    setInfo(null);
    start(async () => {
      try {
        const i = await getRefundInfo(invoiceId);
        setInfo(i);
        setMethod(i.cardRefundable > 0 ? "card" : "manual");
        setAmount((i.cardRefundable > 0 ? i.cardRefundable : i.paid).toFixed(2));
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Couldn't load this invoice.");
      }
    });
  }

  const max = info ? (method === "card" ? info.cardRefundable : info.paid) : 0;
  const value = Number(amount);
  const valid = value > 0 && value <= max + 0.001;

  function submit() {
    if (!confirm(method === "card" ? `Send ${usd(value)} back to the customer's card? This can't be undone.` : `Record a ${usd(value)} refund? No money moves; this only updates the invoice.`)) return;
    setMsg(null);
    start(async () => {
      const res = await refundInvoice(invoiceId, { amount: value, method, reason });
      if (!res.ok) return setMsg(res.error);
      setOpen(false);
      onComplete();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={show}>
        <Undo2 className="size-3.5" data-icon="inline-start" />
        Refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Refund payment</DialogTitle>
            <DialogDescription>
              {info ? `${usd(info.paid)} has been paid on this invoice.` : "Loading…"} Refunding the full amount cancels the invoice.
            </DialogDescription>
          </DialogHeader>
          {info && info.paid > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1">
                <Button type="button" size="sm" variant={method === "card" ? "default" : "outline"} disabled={info.cardRefundable <= 0}
                  onClick={() => { setMethod("card"); setAmount(info.cardRefundable.toFixed(2)); }}>
                  Back to card
                </Button>
                <Button type="button" size="sm" variant={method === "manual" ? "default" : "outline"}
                  onClick={() => { setMethod("manual"); setAmount(info.paid.toFixed(2)); }}>
                  Record only
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {method === "card"
                  ? `Returns the money to the customer's card through your Stripe account (up to ${usd(info.cardRefundable)}). It takes 5–10 business days to show on their statement.`
                  : "Use this when you gave the money back yourself (cash, check, Square, Venmo). No money moves."}
                {info.cardRefundable <= 0 && method === "manual" ? " This invoice wasn't paid by card through Red Fox, so it can't be refunded to a card here." : ""}
              </p>
              <div className="space-y-1">
                <Label htmlFor="refund-amount" className="text-xs">Amount</Label>
                <Input id="refund-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="refund-reason" className="text-xs">Reason (optional, for your records)</Label>
                <Input id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="destructive" disabled={pending || !valid} onClick={submit}>
                  {pending ? "Refunding…" : `Refund ${valid ? usd(value) : ""}`}
                </Button>
              </div>
            </div>
          )}
          {info && info.paid <= 0 && <p className="text-sm text-muted-foreground">Nothing has been paid on this invoice, so there's nothing to refund.</p>}
          {info && info.refunds.length > 0 && (
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Past refunds</p>
              {info.refunds.map((r) => (
                <p key={r.id}>
                  {usd(r.amount)} · {r.method === "stripe" ? "card" : "recorded"} · {new Date(r.createdAt).toLocaleDateString()}
                  {r.reason ? ` · ${r.reason}` : ""}
                </p>
              ))}
            </div>
          )}
          {msg && <p className="text-sm text-destructive">{msg}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
