"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPaymentAndWorkOrder } from "@/app/(crm)/invoices/actions";

export function MarkAsPaidDialog({ invoiceId, customerId, total, onComplete }: {
  invoiceId: string;
  customerId: string;
  total: number;
  onComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"full" | "deposit">("full");
  const [amount, setAmount] = useState(total.toFixed(2));
  const [createWorkOrder, setCreateWorkOrder] = useState(true);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const received = Number(amount);
    if (!Number.isFinite(received) || received <= 0 || received > total) return;
    startTransition(async () => {
      await createPaymentAndWorkOrder({
        invoiceId,
        customerId,
        paymentType,
        amountReceived: received,
        createWorkOrder: paymentType === "full" && createWorkOrder,
        notes,
      });
      setOpen(false);
      onComplete();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={pending} />}>
        <CheckCircle className="size-3.5" data-icon="inline-start" />
        Mark Payment
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record invoice payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            Invoice total: <strong>${total.toFixed(2)}</strong>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-type">Payment type</Label>
            <Select value={paymentType} onValueChange={(value) => {
              const next = value as "full" | "deposit";
              setPaymentType(next);
              if (next === "full") setAmount(total.toFixed(2));
            }}>
              <SelectTrigger id="payment-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full payment</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount-received">Amount received</Label>
            <Input id="amount-received" type="number" min="0.01" max={total} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {paymentType === "full" && (
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input type="checkbox" checked={createWorkOrder} onChange={(e) => setCreateWorkOrder(e.target.checked)} className="mt-0.5" />
              <span><strong>Move to Pending Installation</strong><br /><span className="text-muted-foreground">Create a work order for this customer after full payment.</span></span>
            </label>
          )}
          <div className="space-y-2">
            <Label htmlFor="payment-notes">Payment notes (optional)</Label>
            <Textarea id="payment-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Check number, payment method, or installation notes" rows={3} />
          </div>
          <Button className="w-full" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
            {pending ? "Saving..." : paymentType === "deposit" ? "Record Deposit" : "Record Full Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
