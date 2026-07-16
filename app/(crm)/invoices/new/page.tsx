'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/lib/data-context';
import { useLocation } from '@/lib/location-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectItem, SelectGroup } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedLocationId } = useLocation();
  const { getLocationCustomers } = useData();
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill customer if provided in query params
  useEffect(() => {
    const customerParam = searchParams.get('customer');
    if (customerParam) {
      setCustomerId(customerParam);
    }
  }, [searchParams]);

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
      router.push('/invoices');
    }, 500);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = subtotal;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="New Invoice"
        actions={
          <Link href="/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto max-w-4xl">
        <div className="space-y-6">
          {/* Customer & Details Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Select customer and set due date</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Customer *</label>
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v || '')}>
                    <SelectGroup>
                      <SelectItem value="">Select a customer...</SelectItem>
                      {locationCustomers.map((cust) => (
                        <SelectItem key={cust.id} value={cust.id}>
                          {cust.first_name} {cust.last_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Due Date</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
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
                  <CardDescription>Add invoice line items</CardDescription>
                </div>
                <Button onClick={addLineItem} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Description</label>
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(item.id, 'description', e.target.value)
                        }
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-xs text-muted-foreground">Qty</label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-muted-foreground">Unit Price</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-muted-foreground">Total</label>
                      <div className="text-sm font-medium py-2">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <Button
                      onClick={() => removeLineItem(item.id)}
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any additional notes for this invoice..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-right">
                <div className="flex justify-end gap-4">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 justify-end pb-6">
            <Link href="/invoices">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleSave}
              disabled={isSaving || !customerId}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? 'Saving...' : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
