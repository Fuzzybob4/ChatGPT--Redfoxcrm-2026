'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/data-context';
import { useLocation } from '@/lib/location-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectItem, SelectGroup } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewEstimatePage() {
  const router = useRouter();
  const { selectedLocationId } = useLocation();
  const { getLocationCustomers } = useData();
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Filter customers by location
  const locationCustomers = getLocationCustomers(selectedLocationId);

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

  const handleSave = async () => {
    if (!customerId) {
      alert('Please select a customer');
      return;
    }

    setIsSaving(true);
    // In production, this would call an API
    setTimeout(() => {
      router.push('/estimates');
    }, 500);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = subtotal - parseFloat(discount || '0');

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
                <Select value={customerId} onValueChange={(v) => setCustomerId(v || '')}>
                  <SelectGroup>
                    <SelectItem value="">Select a customer...</SelectItem>
                    {locationCustomers.map((cust) => (
                      <SelectItem key={cust.id} value={cust.id}>
                        {cust.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </Select>
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
