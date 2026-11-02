'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/data-context';
import { useLocation } from '@/lib/location-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useMemo, useState } from 'react';
import { createEstimate, getEstimateDefaults } from '../actions';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

/** Calendar date in the viewer's timezone, plus `days`. Avoids UTC off-by-one. */
function localDatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewEstimatePage() {
  const router = useRouter();
  const { selectedLocationId } = useLocation();
  // `customers` is location-scoped. The select label needs the full list.
  const { allCustomers, getLocationCustomers, refresh } = useData();
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState(localDatePlusDays(30));
  const [taxRate, setTaxRate] = useState('0');
  const [hasDefaultTax, setHasDefaultTax] = useState(true);
  const [discount, setDiscount] = useState('0');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Filter customers by location
  const locationCustomers = getLocationCustomers(selectedLocationId);

  // Base UI Select.Value needs labels, otherwise it shows the customer UUID.
  const customerItems = useMemo(
    () => allCustomers.map((c) => ({ value: c.id, label: c.name || 'Unnamed customer' })),
    [allCustomers],
  );

  // Org default tax rate (or 0) and a +30 day valid-until date.
  useEffect(() => {
    let cancelled = false;
    getEstimateDefaults()
      .then((d) => {
        if (cancelled) return;
        setTaxRate(String(d.taxRate));
        setHasDefaultTax(d.hasDefaultTax);
        setValidUntil((current) => current || d.validUntil);
      })
      .catch((err) => console.error('[NewEstimatePage] failed to load defaults', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Preview only; createEstimate recomputes every amount on the server.
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountValue = Math.max(parseFloat(discount || '0') || 0, 0);
  const taxRateValue = Math.min(Math.max(parseFloat(taxRate || '0') || 0, 0), 100);
  const taxAmount = Math.round(Math.max(subtotal - discountValue, 0) * taxRateValue) / 100;
  const total = subtotal - discountValue + taxAmount;

  const handleSave = async () => {
    setError('');
    if (!customerId) {
      setError('Select a customer to continue.');
      return;
    }
    if (lineItems.some((item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)) {
      setError('Every line item needs a description and a quantity greater than zero.');
      return;
    }
    if (discountValue > subtotal) {
      setError('Discount cannot be more than the subtotal.');
      return;
    }
    if (total <= 0) {
      setError('Estimate total must be greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createEstimate({
        customerId,
        locationId: selectedLocationId || undefined,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        validUntil: validUntil || undefined,
        discount: discountValue,
        taxRate: taxRateValue,
        lineItems: lineItems.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        setIsSaving(false);
        return;
      }
      // The detail page reads from the client data context; reload it first.
      await refresh();
      router.push(`/estimates/${result.id}`);
      router.refresh();
    } catch (err) {
      console.error('[NewEstimatePage] createEstimate failed', err);
      setError(err instanceof Error ? err.message : 'Failed to create estimate.');
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="New Estimate"
        actions={
          <Button render={<Link href="/estimates" />} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto max-w-4xl">
        <div className="space-y-6">
          {/* Customer & Property Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>Select which customer this estimate is for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Customer</label>
                <Select items={customerItems} value={customerId} onValueChange={(v) => setCustomerId(v || '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locationCustomers.map((cust) => (
                      <SelectItem key={cust.id} value={cust.id}>
                        {cust.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="estimate-title" className="text-sm font-medium text-foreground">Title (optional)</label>
                  <Input
                    id="estimate-title"
                    placeholder="e.g. Holiday lighting – front of house"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="estimate-valid-until" className="text-sm font-medium text-foreground">Valid until</label>
                  <Input
                    id="estimate-valid-until"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Add services and products to this estimate</CardDescription>
                </div>
                <Button onClick={addLineItem} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {lineItems.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      className="col-span-5"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      className="col-span-2"
                    />
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="col-span-3"
                    />
                    <Button
                      onClick={() => removeLineItem(item.id)}
                      variant="outline"
                      size="sm"
                      disabled={lineItems.length === 1}
                      className="col-span-2 justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Totals & Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-muted-foreground">Discount</label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-32"
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-muted-foreground">Tax rate (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-32"
                    placeholder="0"
                  />
                </div>
                {!hasDefaultTax && (
                  <p className="text-xs text-muted-foreground">
                    No default tax rate set. Set one in{' '}
                    <Link href="/settings/tax-settings" className="underline">Settings</Link>.
                  </p>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg text-primary">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                <Textarea
                  placeholder="Add any notes for the customer..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pb-6">
            <Button render={<Link href="/estimates" />} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
              {isSaving ? 'Saving...' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
