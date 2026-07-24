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
import { Checkbox } from '@/components/ui/checkbox';
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

  // Tax and Payment Options
  const [includeTax, setIncludeTax] = useState(true);
  const [taxRate, setTaxRate] = useState(8.5); // default tax rate
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full');
  const [depositPercentage, setDepositPercentage] = useState(50);
  const [depositDueDate, setDepositDueDate] = useState('');
  
  // Email Reminder Options
  const [enableEmailReminders, setEnableEmailReminders] = useState(true);
  const [reminderDays, setReminderDays] = useState<number[]>([2, 7]); // default: 2 and 7 days

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
  const taxAmount = includeTax ? (subtotal * taxRate) / 100 : 0;
  const total = subtotal + taxAmount;
  const depositAmount = paymentType === 'deposit' ? (total * depositPercentage) / 100 : total;

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
                          {cust.name}
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

          {/* Tax Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Settings</CardTitle>
              <CardDescription>Configure tax for this invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={includeTax}
                  onChange={(e) => setIncludeTax(e.currentTarget.checked)}
                />
                <label className="text-sm font-medium text-foreground">Include Tax</label>
              </div>
              
              {includeTax && (
                <div className="space-y-1.5 pl-7">
                  <label className="text-sm font-medium text-foreground">Tax Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    placeholder="8.5"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
              <CardDescription>Set payment structure and due dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="full-payment"
                    name="payment-type"
                    value="full"
                    checked={paymentType === 'full'}
                    onChange={(e) => setPaymentType(e.target.value as 'full' | 'deposit')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="full-payment" className="text-sm font-medium text-foreground">
                    Full Payment
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="deposit-payment"
                    name="payment-type"
                    value="deposit"
                    checked={paymentType === 'deposit'}
                    onChange={(e) => setPaymentType(e.target.value as 'full' | 'deposit')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="deposit-payment" className="text-sm font-medium text-foreground">
                    50% Deposit + Balance
                  </label>
                </div>
              </div>

              {paymentType === 'deposit' && (
                <div className="space-y-3 pl-7">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Deposit Percentage</label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={depositPercentage}
                      onChange={(e) => setDepositPercentage(parseFloat(e.target.value) || 0)}
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Deposit Due Date</label>
                    <Input
                      type="date"
                      value={depositDueDate}
                      onChange={(e) => setDepositDueDate(e.target.value)}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    Deposit: ${depositAmount.toFixed(2)} | Balance: ${(total - depositAmount).toFixed(2)}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Full Payment Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Reminders */}
          <Card>
            <CardHeader>
              <CardTitle>Email Reminders</CardTitle>
              <CardDescription>Configure automatic payment reminders for customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={enableEmailReminders}
                  onChange={(e) => setEnableEmailReminders(e.currentTarget.checked)}
                />
                <label className="text-sm font-medium text-foreground">Enable Email Reminders</label>
              </div>

              {enableEmailReminders && (
                <div className="space-y-3 pl-7">
                  <label className="text-sm font-medium text-foreground">Reminder Schedule (days after invoice)</label>
                  <div className="space-y-2">
                    {[2, 7, 14].map((days) => (
                      <div key={days} className="flex items-center gap-3">
                        <Checkbox
                          checked={reminderDays.includes(days)}
                          onChange={(e) => {
                            if (e.currentTarget.checked) {
                              setReminderDays([...reminderDays, days].sort((a, b) => a - b));
                            } else {
                              setReminderDays(reminderDays.filter((d) => d !== days));
                            }
                          }}
                        />
                        <label className="text-sm text-foreground">{days} days</label>
                      </div>
                    ))}
                  </div>
                  {reminderDays.length === 0 && (
                    <p className="text-xs text-muted-foreground">At least one reminder should be selected</p>
                  )}
                </div>
              )}
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
                {includeTax && (
                  <div className="flex justify-end gap-4">
                    <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                    <span className="font-medium">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                {paymentType === 'deposit' && (
                  <>
                    <div className="flex justify-end gap-4 text-sm pt-2 border-t text-muted-foreground">
                      <span>Deposit ({depositPercentage}%):</span>
                      <span>${depositAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end gap-4 text-sm text-muted-foreground">
                      <span>Balance:</span>
                      <span>${(total - depositAmount).toFixed(2)}</span>
                    </div>
                  </>
                )}
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
