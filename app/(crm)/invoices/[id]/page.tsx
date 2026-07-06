import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle, Printer, Download } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  invoices,
  getCustomerById,
  getInvoiceTotal,
} from "@/lib/data";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const invoice = invoices.find((i) => i.id === id);
  if (!invoice) notFound();

  const customer = getCustomerById(invoice.customerId);
  const total = getInvoiceTotal(invoice);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title={invoice.invoiceNumber}
        description={customer?.name}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/invoices">
                <ArrowLeft className="size-3.5 mr-1" />
                Back
              </Link>
            </Button>
            {invoice.status === "Draft" && (
              <Button size="sm">
                <Send className="size-3.5 mr-1.5" />
                Send Invoice
              </Button>
            )}
            {invoice.status === "Sent" && (
              <Button size="sm">
                <CheckCircle className="size-3.5 mr-1.5" />
                Mark Paid
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            {/* Invoice header */}
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                      RF
                    </span>
                    <div>
                      <p className="font-semibold text-sm">RedFox CRM</p>
                      <p className="text-xs text-muted-foreground">
                        Austin, TX 78701
                      </p>
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold">
                    {invoice.invoiceNumber}
                  </CardTitle>
                </div>
                <StatusBadge status={invoice.status} />
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Bill to + dates */}
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Bill To
                  </p>
                  <p className="text-sm font-medium">{customer?.name}</p>
                  <p className="text-xs text-muted-foreground">{customer?.email}</p>
                  <p className="text-xs text-muted-foreground">{customer?.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Issued
                  </p>
                  <p className="text-sm">
                    {new Date(invoice.issuedDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Due Date
                  </p>
                  <p className="text-sm">
                    {new Date(invoice.dueDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Line items */}
              <div>
                <div className="grid grid-cols-12 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                  <span className="col-span-6">Description</span>
                  <span className="col-span-2 text-right">Qty</span>
                  <span className="col-span-2 text-right">Unit Price</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>
                <div className="flex flex-col divide-y divide-border border rounded-lg overflow-hidden">
                  {invoice.lineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 text-sm px-3 py-2.5 bg-card"
                    >
                      <span className="col-span-6 text-foreground">
                        {item.description}
                      </span>
                      <span className="col-span-2 text-right text-muted-foreground">
                        {item.quantity}
                      </span>
                      <span className="col-span-2 text-right text-muted-foreground">
                        ${item.unitPrice.toFixed(2)}
                      </span>
                      <span className="col-span-2 text-right font-medium">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="w-48">
                  <div className="flex justify-between text-sm py-1.5">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1.5">
                    <span className="text-muted-foreground">Tax (0%)</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base font-bold py-1">
                    <span>Total</span>
                    <span className="text-primary">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Notes
                    </p>
                    <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm">
                  <Printer className="size-3.5 mr-1.5" />
                  Print
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="size-3.5 mr-1.5" />
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
