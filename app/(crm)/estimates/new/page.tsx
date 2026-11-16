'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/data-context';
import { useLocation } from '@/lib/location-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerPicker } from '@/components/customers/customer-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';
import { ArrowLeft, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { createEstimate } from '@/app/(crm)/estimates/actions';
import { setEstimateItemImage } from '@/app/(crm)/estimates/edit-actions';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** A picture picked before saving; uploaded once the estimate exists. */
  file?: File;
  preview?: string;
}

export default function NewEstimatePage() {
  const router = useRouter();
  const { selectedLocationId } = useLocation();
  const { getLocationCustomers, refresh } = useData();
  const [customerId, setCustomerId] = useState('');
  // Opened from a customer's page (/estimates/new?customer=<id>): pre-pick them.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('customer');
    if (fromUrl) setCustomerId(fromUrl);
  }, []);
  const [discount, setDiscount] = useState('0');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [depositPercent, setDepositPercent] = useState('50');
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Filter customers by location
  // Customers without a location belong everywhere (otherwise they could never be picked).
  const locationCustomers = getLocationCustomers('').filter((c) => !selectedLocationId || !c.locationId || c.locationId === selectedLocationId);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const setItemFile = (id: string, file: File | undefined) => {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        if (item.preview) URL.revokeObjectURL(item.preview);
        return { ...item, file, preview: file ? URL.createObjectURL(file) : undefined };
      }),
    );
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = async () => {
    if (!customerId) {
      alert('Please select a customer');
      return;
    }

    setIsSaving(true);
    setError(null);
    // Same filter the server uses, so item positions line up for the photo uploads below.
    const kept = lineItems.filter((i) => i.description.trim() && i.quantity > 0);
    const res = await createEstimate({
      customerId,
      title,
      description,
      locationId: selectedLocationId || null,
      lineItems: kept.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      discount: parseFloat(discount || '0') || 0,
      taxRate: parseFloat(taxRate || '0') || 0,
      depositPercent: parseFloat(depositPercent || '0') || 0,
      notes,
    });
    if (!res.ok) {
      setError(res.error);
      setIsSaving(false);
      return;
    }
    // Upload item photos now that the estimate exists.
    for (const [idx, item] of kept.entries()) {
      if (!item.file) continue;
      try {
        const body = new FormData();
        body.append('file', item.file);
        const up = await fetch(`/api/estimates/${res.id}/item-image`, { method: 'POST', body });
        const json = await up.json().catch(() => ({}));
        if (up.ok && json.path) await setEstimateItemImage(res.id, idx, json.path);
      } catch {
        // A failed photo shouldn't lose the estimate; it can be added from Edit.
      }
    }
    await refresh();
    router.push(`/estimates/${res.id}`);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const afterDiscount = Math.max(0, subtotal - (parseFloat(discount || '0') || 0));
  const total = afterDiscount + Math.round(afterDiscount * (parseFloat(taxRate || '0') || 0)) / 100;

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
      <div className="flex-1 p-4 sm:p-6 overflow-auto max-w-4xl">
        <div className="space-y-6">
          {/* Customer & Property Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>Select which customer this estimate is for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomerPicker
                customers={locationCustomers.map((c) => ({ id: c.id, name: c.name, address: c.address, phone: c.phone, email: c.email }))}
                value={customerId}
                onChange={setCustomerId}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Estimate title</label>
                <Input placeholder="Holiday lighting 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="est-desc" className="text-sm font-medium text-foreground">Description (the customer sees this)</label>
                <Textarea
                  id="est-desc"
                  rows={3}
                  placeholder="What's included: lights and materials, install, timers, service calls, removal in January…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>List each service on its own line. Your customer can check the ones they want and approve just those.</CardDescription>
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
                  <div key={item.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex gap-3">
                      {item.preview ? (
                        <div className="relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.preview} alt={`Picture for item ${idx + 1}`} className="size-20 rounded-md border object-cover" />
                          <button
                            type="button"
                            onClick={() => setItemFile(item.id, undefined)}
                            aria-label="Remove picture"
                            className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex size-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center text-[11px] text-muted-foreground hover:bg-muted/50">
                          <ImagePlus className="size-4" />
                          Add photo
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              setItemFile(item.id, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                      <Textarea
                        rows={3}
                        placeholder={'First line: item name (e.g. 48" wreath)\nNext lines: details (colors, bulbs, where it goes)'}
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        aria-label={`Item ${idx + 1} description`}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor={`q-${item.id}`} className="text-xs text-muted-foreground">Qty</label>
                        <Input
                          id={`q-${item.id}`}
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="h-9 w-20"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label htmlFor={`p-${item.id}`} className="text-xs text-muted-foreground">Price $</label>
                        <Input
                          id={`p-${item.id}`}
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="h-9 w-28"
                        />
                      </div>
                      <span className="ml-auto text-sm font-semibold">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                      <Button
                        onClick={() => removeLineItem(item.id)}
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive hover:text-destructive"
                        disabled={lineItems.length === 1}
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
                  <label htmlFor="new-tax" className="text-sm text-muted-foreground">Sales tax (%)</label>
                  <Input id="new-tax" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-32" placeholder="0" />
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-muted-foreground">Deposit due at approval (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={depositPercent}
                    onChange={(e) => setDepositPercent(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg text-primary">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Internal notes (optional, customer never sees these)</label>
                <Textarea
                  placeholder="e.g. Gate code, who to call, options discussed…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 justify-end pb-6">
            <Button render={<Link href="/estimates" />} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
              {isSaving ? 'Saving...' : 'Save estimate'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
