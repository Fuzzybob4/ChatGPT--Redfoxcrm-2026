'use client';

import { useState } from 'react';
import { CreditCard, FileText, Minus, Plus, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/status-badge';
import {
  createPortalInvoiceCheckout,
  setPortalInvoiceAddonSelection,
} from '@/app/(crm)/customers/portal-invoice-actions';
import type { PortalInvoice } from '@/app/(crm)/customers/portal-invoice-actions';

interface CustomerPortalInvoicesProps {
  token: string;
  initialInvoices: PortalInvoice[];
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function statusLabel(status: string): 'Draft' | 'Sent' | 'Paid' | 'Overdue' {
  const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
  if (capitalized === 'Draft' || capitalized === 'Sent' || capitalized === 'Paid' || capitalized === 'Overdue') {
    return capitalized;
  }
  return 'Sent';
}

export function CustomerPortalInvoices({ token, initialInvoices }: CustomerPortalInvoicesProps) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [pendingAddonId, setPendingAddonId] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [errorByInvoice, setErrorByInvoice] = useState<Record<string, string>>({});

  async function updateAddonQuantity(invoiceId: string, addonProductId: string, quantity: number) {
    setPendingAddonId(addonProductId);
    setErrorByInvoice((prev) => ({ ...prev, [invoiceId]: '' }));
    try {
      const { addonsTotal, grandTotal } = await setPortalInvoiceAddonSelection(
        token,
        invoiceId,
        addonProductId,
        quantity,
      );
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id !== invoiceId
            ? inv
            : {
                ...inv,
                addonsTotal,
                grandTotal,
                addons: inv.addons.map((a) =>
                  a.id === addonProductId ? { ...a, selectedQuantity: quantity } : a,
                ),
              },
        ),
      );
    } catch (err) {
      setErrorByInvoice((prev) => ({
        ...prev,
        [invoiceId]: err instanceof Error ? err.message : 'Failed to update selection.',
      }));
    } finally {
      setPendingAddonId(null);
    }
  }

  async function payInvoice(invoiceId: string) {
    setPendingPaymentId(invoiceId);
    setErrorByInvoice((prev) => ({ ...prev, [invoiceId]: '' }));
    try {
      const { url } = await createPortalInvoiceCheckout(token, invoiceId);
      window.location.assign(url);
    } catch (err) {
      setErrorByInvoice((prev) => ({
        ...prev,
        [invoiceId]: err instanceof Error ? err.message : 'Unable to start payment.',
      }));
      setPendingPaymentId(null);
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Invoices</h2>
          <Card className="p-8 text-center">
            <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-muted-foreground mb-1">No invoices yet</p>
            <p className="text-sm text-muted-foreground">
              Your invoices will appear here once they are issued
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Your Invoices</h2>
      <div className="flex flex-col gap-4">
        {invoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">{invoice.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {invoice.invoiceNumber}
                  {invoice.dueDate && (
                    <>
                      {' '}
                      &middot; Due{' '}
                      {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </>
                  )}
                </p>
              </div>
              <StatusBadge status={statusLabel(invoice.status)} />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Line items */}
              <div className="space-y-1.5 text-sm">
                {invoice.lineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-muted-foreground">
                    <span>
                      {item.description}
                      {item.quantity !== 1 && ` × ${item.quantity}`}
                    </span>
                    <span>{formatCurrency(item.lineTotal)}</span>
                  </div>
                ))}
                {invoice.taxAmount > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Tax ({invoice.taxRate}%)</span>
                    <span>{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                )}
              </div>

              {/* Optional add-ons the customer can choose to add */}
              {invoice.allowAddons && invoice.addons.length > 0 && (
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3.5">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Add optional extras</p>
                  </div>
                  <div className="space-y-2.5">
                    {invoice.addons.map((addon) => {
                      const isPending = pendingAddonId === addon.id;
                      return (
                        <div
                          key={addon.id}
                          className="flex items-center justify-between gap-3 rounded-md bg-background/60 p-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{addon.name}</p>
                            {addon.description && (
                              <p className="text-xs text-muted-foreground">{addon.description}</p>
                            )}
                            <p className="text-xs font-medium text-muted-foreground">
                              {formatCurrency(addon.price)}
                              {addon.maxQuantity > 1 ? ' each' : ''}
                            </p>
                          </div>
                          {addon.maxQuantity > 1 ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-7"
                                disabled={isPending || addon.selectedQuantity === 0}
                                onClick={() =>
                                  updateAddonQuantity(invoice.id, addon.id, addon.selectedQuantity - 1)
                                }
                                aria-label={`Remove one ${addon.name}`}
                              >
                                <Minus className="size-3.5" />
                              </Button>
                              <span className="w-4 text-center text-sm font-medium">
                                {addon.selectedQuantity}
                              </span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-7"
                                disabled={isPending || addon.selectedQuantity >= addon.maxQuantity}
                                onClick={() =>
                                  updateAddonQuantity(invoice.id, addon.id, addon.selectedQuantity + 1)
                                }
                                aria-label={`Add one more ${addon.name}`}
                              >
                                <Plus className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant={addon.selectedQuantity > 0 ? 'default' : 'outline'}
                              disabled={isPending}
                              onClick={() =>
                                updateAddonQuantity(
                                  invoice.id,
                                  addon.id,
                                  addon.selectedQuantity > 0 ? 0 : 1,
                                )
                              }
                            >
                              {addon.selectedQuantity > 0 ? 'Added' : 'Add'}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {errorByInvoice[invoice.id] && (
                    <p className="mt-2 text-xs text-destructive">{errorByInvoice[invoice.id]}</p>
                  )}
                </div>
              )}

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Invoice subtotal</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                {invoice.addonsTotal > 0 && (
                  <div className="flex items-center justify-between text-primary">
                    <span>Optional extras</span>
                    <span>+{formatCurrency(invoice.addonsTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.grandTotal)}</span>
                </div>
                {invoice.status !== 'paid' && (
                  <Button
                    className="mt-4 w-full"
                    disabled={pendingPaymentId === invoice.id}
                    onClick={() => payInvoice(invoice.id)}
                  >
                    <CreditCard className="mr-2 size-4" />
                    {pendingPaymentId === invoice.id
                      ? 'Opening secure checkout…'
                      : `Pay ${formatCurrency(Math.max(invoice.grandTotal - invoice.amountPaid, 0))}`}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
