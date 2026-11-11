"use client";

import { useEffect, useState, useTransition } from "react";
import { FileSignature, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContractView } from "@/lib/contracts";
import { endCustomerContract, getCustomerContract, saveCustomerContract } from "@/app/(crm)/customers/contract-actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function ContractBillingCard({ customerId }: { customerId: string }) {
  const [contract, setContract] = useState<ContractView | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextYear = new Date().getFullYear() + 1;
  const [form, setForm] = useState({ yearlyAmount: "", startYear: String(nextYear), years: "3", percent: "10", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], notes: "" });

  useEffect(() => {
    let alive = true;
    getCustomerContract(customerId).then((c) => alive && setContract(c)).catch(() => alive && setContract(null));
    return () => {
      alive = false;
    };
  }, [customerId]);

  function openEditor() {
    if (contract) {
      setForm({
        yearlyAmount: String(contract.yearlyAmount),
        startYear: String(contract.startYear),
        years: String(contract.years),
        percent: String(contract.percent),
        months: contract.months,
        notes: contract.notes ?? "",
      });
    }
    setError(null);
    setEditing(true);
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await saveCustomerContract(customerId, {
        yearlyAmount: Number(form.yearlyAmount),
        startYear: Number(form.startYear),
        years: Number(form.years),
        percent: Number(form.percent),
        months: form.months,
        notes: form.notes,
      });
      if (!r.ok) return setError(r.error);
      setContract(r.contract);
      setEditing(false);
    });
  }

  function end() {
    if (!window.confirm("End this contract? No new contract invoices will be created. Invoices already sent stay as they are.")) return;
    start(async () => {
      const r = await endCustomerContract(customerId);
      if (!r.ok) return setError(r.error);
      setContract(await getCustomerContract(customerId));
    });
  }

  if (contract === undefined) return null;

  const active = contract?.status === "active";
  const monthly = contract ? Math.round(contract.yearlyAmount * (contract.percent / 100) * 100) / 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileSignature className="size-4 text-primary" />
          Contract billing
          {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
        <CardDescription className="text-xs">
          Recurring customers (HOAs, commercial, multi-year): one invoice each year, paid in monthly installments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!editing && !contract && (
          <Button size="sm" variant="outline" onClick={openEditor}>Set up a contract</Button>
        )}

        {!editing && contract && (
          <>
            <div className="rounded-md bg-muted px-3 py-2">
              <p className="font-medium">
                {usd(contract.yearlyAmount)} a year · {contract.startYear}–{contract.startYear + contract.years - 1}
                <span className={`ml-2 text-xs ${active ? "text-emerald-600" : "text-muted-foreground"}`}>{active ? "Active" : "Ended"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {usd(monthly)} ({contract.percent}%) each {contract.months.map((m) => MONTHS[m - 1]).join(", ")}. Customer can pay ahead any time.
              </p>
              {contract.signedName && (
                <p className="text-xs text-muted-foreground">Signed online by {contract.signedName}{contract.signedDate ? ` on ${contract.signedDate}` : ""}</p>
              )}
              {contract.notes && <p className="mt-1 text-xs">{contract.notes}</p>}
            </div>
            {contract.invoices.length > 0 && (
              <div className="space-y-1">
                {contract.invoices.map((i) => (
                  <a key={i.id} href={`/invoices/${i.id}`} className="flex justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted">
                    <span className="truncate">{i.title || i.number}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {usd(i.paid)} of {usd(i.total)} paid
                    </span>
                  </a>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openEditor}>Edit</Button>
              {active && <Button size="sm" variant="ghost" onClick={end}>End contract</Button>}
            </div>
          </>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Yearly amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.yearlyAmount} onChange={(e) => setForm({ ...form, yearlyAmount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">First year billed</Label>
                <Input type="number" value={form.startYear} onChange={(e) => setForm({ ...form, startYear: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Years</Label>
                <Input type="number" min="1" max="10" value={form.years} onChange={(e) => setForm({ ...form, years: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">% per month</Label>
                <Input type="number" min="1" max="100" step="0.5" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Billing months</Label>
              <div className="grid grid-cols-6 gap-1">
                {MONTHS.map((m, i) => {
                  const on = form.months.includes(i + 1);
                  return (
                    <button key={m} type="button"
                      onClick={() => setForm({ ...form, months: on ? form.months.filter((x) => x !== i + 1) : [...form.months, i + 1].sort((a, b) => a - b) })}
                      className={`rounded border py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>Save contract</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {!editing && error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
