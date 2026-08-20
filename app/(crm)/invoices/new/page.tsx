'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useData } from '@/lib/data-context';
import { useLocation } from '@/lib/location-context';
import { createInvoice } from '../actions';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Plus,
  Trash2,
  User,
  Percent,
  CalendarClock,
  Bell,
  Sparkles,
} from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface AddonItem {
  id: string;
  name: string;
  description: string;
  price: number;
  maxQuantity: number;
}

const REMINDER_OPTIONS = [2, 7, 14];

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedLocationId } = useLocation();
  const { getLocationCustomers } = useData();

  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [includeTax, setIncludeTax] = useState(true);
  const [taxRate, setTaxRate] = useState(8.5);
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full');
  const [depositPercentage, setDepositPercentage] = useState(50);

  const [enableEmailReminders, setEnableEmailReminders] = useState(true);
  const [reminderDays, setReminderDays] = useState<number[]>([2, 7]);

  const [allowAddons, setAllowAddons] = useState(false);
  const [addonItems, setAddonItems] = useState<AddonItem[]>([]);

  const locationCustomers = getLocationCustomers(selectedLocationId);

  useEffect(() => {
    const customerParam = searchParams.get('customer');
    if (customerParam) setCustomerId(customerParam);
  }, [searchParams]);

  const selectedCustomer = useMemo(
    () => locationCustomers.find((c) => c.id === customerId),
    [locationCustomers, customerId],
  );

  const addLineItem = () => {
    setLineItems((items) => [
      ...items,
      { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = includeTax ? (subtotal * taxRate) / 100 : 0;
  const total = subtotal + taxAmount;
  const depositAmount = paymentType === 'deposit' ? (total * depositPercentage) / 100 : 0;
  const balanceDue = paymentType === 'deposit' ? total - depositAmount : total;

  const toggleReminderDay = (day: number, checked: boolean) => {
    setReminderDays((days) =>
      checked ? [...days, day].sort((a, b) => a - b) : days.filter((d) => d !== day),
    );
  };

  const addAddonItem = () => {
    setAddonItems((items) => [
      ...items,
      { id: crypto.randomUUID(), name: '', description: '', price: 0, maxQuantity: 1 },
    ]);
  };

  const removeAddonItem = (id: string) => {
    setAddonItems((items) => items.filter((item) => item.id !== id));
  };

  const updateAddonItem = (id: string, field: keyof AddonItem, value: string | number) => {
    setAddonItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const validAddonItems = addonItems.filter((item) => item.name.trim() && item.price >= 0);

  const isValid =
    customerId &&
    title.trim() &&
    dueDate &&
    lineItems.every((item) => item.description.trim() && item.quantity > 0) &&
    total > 0 &&
    (!allowAddons || validAddonItems.length > 0);

  const handleSave = async () => {
    setError('');
    if (!customerId) {
      setError('Select a customer to continue.');
      return;
    }
    if (!title.trim()) {
      setError('Add a title for this invoice.');
      return;
    }
    if (!dueDate) {
      setError('Set a due date for this invoice.');
      return;
    }
    if (allowAddons && validAddonItems.length === 0) {
      setError('Add at least one optional item, or turn off optional add-ons.');
      return;
    }
    if (!isValid) {
      setError('Every line item needs a description, quantity, and total greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      const invoiceId = await createInvoice({
        customerId,
        locationId: selectedLocationId || undefined,
        title: title.trim(),
        notes: notes.trim() || undefined,
        subtotal,
        taxRate: includeTax ? taxRate : 0,
        taxAmount,
        totalAmount: total,
        depositAmount: paymentType === 'deposit' ? depositAmount : 0,
        dueDate,
        lineItems: lineItems.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        allowAddons,
        addonItems: allowAddons
          ? validAddonItems.map((item) => ({
              name: item.name.trim(),
              description: item.description.trim() || undefined,
              price: item.price,
              maxQuantity: item.maxQuantity,
            }))
          : undefined,
      });
      router.push(`/invoices/${invoiceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice.');
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader
        title="New Invoice"
        description="Build a professional invoice for your customer"
        actions={
          <Link href="/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Button>
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column: main invoice builder */}
          <div className="space-y-6 lg:col-span-2">
            {/* Customer + basics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Customer &amp; Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="customer">Customer</Label>
                    <Select value={customerId} onValueChange={(value) => setCustomerId(value ?? '')}>
                      <SelectTrigger id="customer" className="w-full">
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="due-date">Due Date</Label>
                    <Input
                      id="due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="title">Invoice Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Holiday Lighting Installation – Front & Back Yard"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {selectedCustomer && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p className="font-medium text-foreground">{selectedCustomer.name}</p>
                    <p className="text-muted-foreground">
                      {[selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(' · ')}
                    </p>
                    {selectedCustomer.address && (
                      <p className="text-muted-foreground">
                        {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.state]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Line Items</CardTitle>
                <Button onClick={addLineItem} size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                <div className="hidden grid-cols-[1fr_80px_120px_120px_36px] gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit Price</span>
                  <span className="text-right">Line Total</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_80px_120px_120px_36px] sm:border-0 sm:p-0"
                    >
                      <Input
                        placeholder="Service or product description"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="text-right"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-right"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                      />
                      <div className="text-right text-sm font-medium text-foreground">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                      <Button
                        onClick={() => removeLineItem(item.id)}
                        size="icon"
                        variant="ghost"
                        disabled={lineItems.length === 1}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove line item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes for Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add payment instructions, warranty details, or a thank-you note..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Payment terms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  Payment Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('full')}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      paymentType === 'full'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">Full Payment</p>
                    <p className="text-xs text-muted-foreground">Due in full by the due date</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('deposit')}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      paymentType === 'deposit'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">Deposit + Balance</p>
                    <p className="text-xs text-muted-foreground">Collect a deposit up front</p>
                  </button>
                </div>

                {paymentType === 'deposit' && (
                  <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
                    <Label htmlFor="deposit-pct">Deposit Percentage</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="deposit-pct"
                        type="number"
                        min="1"
                        max="99"
                        value={depositPercentage}
                        onChange={(e) => setDepositPercentage(parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(depositAmount)} due now, {formatCurrency(balanceDue)} due later
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email reminders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Email Reminders
                </CardTitle>
                <Switch
                  checked={enableEmailReminders}
                  onCheckedChange={setEnableEmailReminders}
                  aria-label="Enable email reminders"
                />
              </CardHeader>
              {enableEmailReminders && (
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Send automatic payment reminders after the invoice is sent
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {REMINDER_OPTIONS.map((day) => {
                      const active = reminderDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleReminderDay(day, !active)}
                          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          {day} days
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Optional add-ons for the customer */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    Optional Add-Ons
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Let the customer add these extras themselves when they view the emailed
                    invoice
                  </p>
                </div>
                <Switch
                  checked={allowAddons}
                  onCheckedChange={(checked) => {
                    setAllowAddons(checked);
                    if (checked && addonItems.length === 0) addAddonItem();
                  }}
                  aria-label="Allow customer add-ons"
                />
              </CardHeader>
              {allowAddons && (
                <CardContent className="space-y-3">
                  {addonItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.4fr_1.6fr_100px_90px_36px] sm:items-start"
                    >
                      <Input
                        placeholder="Add-on name (e.g. Extended Warranty)"
                        value={item.name}
                        onChange={(e) => updateAddonItem(item.id, 'name', e.target.value)}
                      />
                      <Input
                        placeholder="Short description shown to customer"
                        value={item.description}
                        onChange={(e) => updateAddonItem(item.id, 'description', e.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        className="text-right"
                        value={item.price}
                        onChange={(e) =>
                          updateAddonItem(item.id, 'price', parseFloat(e.target.value) || 0)
                        }
                      />
                      <Input
                        type="number"
                        min="1"
                        max="99"
                        step="1"
                        title="Max quantity a customer can add"
                        className="text-right"
                        value={item.maxQuantity}
                        onChange={(e) =>
                          updateAddonItem(
                            item.id,
                            'maxQuantity',
                            parseInt(e.target.value, 10) || 1,
                          )
                        }
                      />
                      <Button
                        onClick={() => removeAddonItem(item.id)}
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove optional add-on"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button onClick={addAddonItem} size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Optional Item
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Right column: sticky summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Tax</span>
                      <Switch
                        checked={includeTax}
                        onCheckedChange={setIncludeTax}
                        size="sm"
                        aria-label="Include tax"
                      />
                    </div>
                    {includeTax ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="h-7 w-16 text-right"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  {includeTax && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Tax amount</span>
                      <span>{formatCurrency(taxAmount)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between text-base font-semibold text-foreground">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>

                  {paymentType === 'deposit' && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Deposit due now
                          <Badge variant="secondary" className="ml-2">
                            {depositPercentage}%
                          </Badge>
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(depositAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Balance due later</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(balanceDue)}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !isValid}
                  className="w-full"
                  size="lg"
                >
                  {isSaving ? 'Creating Invoice...' : 'Create Invoice'}
                </Button>
                <Link href="/invoices" className="w-full">
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
