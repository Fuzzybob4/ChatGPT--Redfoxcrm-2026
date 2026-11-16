'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useData } from '@/lib/data-context';
import { getEditableEstimate, updateEstimate, type EditableEstimate } from '@/app/(crm)/estimates/edit-actions';

interface Row {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  optional: boolean;
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const newKey = () => Math.random().toString(36).slice(2);

export default function EditEstimatePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { refresh } = useData();
  const [est, setEst] = useState<EditableEstimate | null | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [deposit, setDeposit] = useState('50');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEditableEstimate(id)
      .then((e) => {
        setEst(e);
        if (!e) return;
        setTitle(e.title);
        setDescription(e.description);
        setNotes(e.notes);
        setDiscount(String(e.discount || 0));
        setTaxRate(String(e.taxRate || 0));
        setDeposit(String(e.depositPercent));
        setValidUntil(e.validUntil);
        setRows(
          (e.items.length ? e.items : [{ description: '', quantity: 1, unitPrice: 0, optional: true }]).map((i) => ({
            key: newKey(),
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: String(i.unitPrice),
            optional: i.optional,
          })),
        );
      })
      .catch(() => setEst(null));
  }, [id]);

  const update = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (idx: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = idx + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const itemsTotal = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);
  const subtotal = Math.max(0, itemsTotal - (Number(discount) || 0));
  const tax = Math.round(subtotal * (Number(taxRate) || 0)) / 100;
  const total = subtotal + tax;

  async function save() {
    setSaving(true);
    setError(null);
    const res = await updateEstimate(id, {
      title,
      description,
      notes,
      taxRate: Number(taxRate) || 0,
      depositPercent: Number(deposit) || 0,
      validUntil,
      discount: Number(discount) || 0,
      items: rows.map((r) => ({
        description: r.description,
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        optional: r.optional,
      })),
    });
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    await refresh();
    router.push(`/estimates/${id}`);
  }

  if (est === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (est === null) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">This estimate could not be found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader
        title={`Edit ${est.estimateNumber}`}
        description={est.customerName}
        actions={
          <Button render={<Link href={`/estimates/${id}`} />} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="max-w-4xl flex-1 overflow-auto p-4 sm:p-6">
        <div className="space-y-6">
          {est.locked ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              This estimate is already approved and has an invoice, so it can&apos;t be changed. Edit the invoice instead.
            </p>
          ) : est.customerHasSeenIt ? (
            <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              The customer has already opened this estimate. Their link stays the same and will show your changes, so
              let them know you updated it.
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>What the customer sees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="est-title" className="text-sm font-medium">Title</label>
                <Input id="est-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={est.locked} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="est-desc" className="text-sm font-medium">Description</label>
                <Textarea
                  id="est-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's included: lights, install, timers, service calls, removal…"
                  disabled={est.locked}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Items</CardTitle>
                  <CardDescription>
                    Items marked &ldquo;Customer can skip&rdquo; show a checkbox so they can pick what they want.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={est.locked}
                  onClick={() => setRows((r) => [...r, { key: newKey(), description: '', quantity: '1', unitPrice: '0', optional: true }])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((r, idx) => (
                <div key={r.key} className="space-y-2 rounded-lg border p-3">
                  <Textarea
                    rows={2}
                    value={r.description}
                    onChange={(e) => update(r.key, { description: e.target.value })}
                    placeholder="Description"
                    aria-label={`Item ${idx + 1} description`}
                    disabled={est.locked}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`q-${r.key}`} className="text-xs text-muted-foreground">Qty</label>
                      <Input
                        id={`q-${r.key}`}
                        inputMode="decimal"
                        value={r.quantity}
                        onChange={(e) => update(r.key, { quantity: e.target.value })}
                        className="h-9 w-20"
                        disabled={est.locked}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`p-${r.key}`} className="text-xs text-muted-foreground">Price $</label>
                      <Input
                        id={`p-${r.key}`}
                        inputMode="decimal"
                        value={r.unitPrice}
                        onChange={(e) => update(r.key, { unitPrice: e.target.value })}
                        className="h-9 w-28"
                        disabled={est.locked}
                      />
                    </div>
                    <span className="ml-auto text-sm font-semibold">
                      {usd((Number(r.quantity) || 0) * (Number(r.unitPrice) || 0))}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={r.optional}
                        onChange={() => update(r.key, { optional: !r.optional })}
                        disabled={est.locked}
                      />
                      Customer can skip
                    </label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-9" onClick={() => move(idx, -1)} disabled={est.locked || idx === 0} aria-label="Move up">
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9" onClick={() => move(idx, 1)} disabled={est.locked || idx === rows.length - 1} aria-label="Move down">
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive hover:text-destructive"
                        onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}
                        disabled={est.locked || rows.length === 1}
                        aria-label="Remove item"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded bg-muted p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items</span>
                  <span className="font-medium">{usd(itemsTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="disc" className="text-sm text-muted-foreground">Discount $</label>
                  <Input id="disc" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9 w-28" disabled={est.locked} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="tax" className="text-sm text-muted-foreground">Sales tax %</label>
                  <Input id="tax" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="h-9 w-28" disabled={est.locked} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="dep" className="text-sm text-muted-foreground">Deposit at approval %</label>
                  <Input id="dep" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="h-9 w-28" disabled={est.locked} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="valid" className="text-sm text-muted-foreground">Valid until</label>
                  <Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-9 w-40" disabled={est.locked} />
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-semibold">Total{tax > 0 ? ' (with tax)' : ''}</span>
                  <span className="text-lg font-bold text-primary">{usd(total)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="notes" className="text-sm font-medium">Internal notes (customer never sees these)</label>
                <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={est.locked} />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pb-6">
            <Button render={<Link href={`/estimates/${id}`} />} variant="outline">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || est.locked}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
