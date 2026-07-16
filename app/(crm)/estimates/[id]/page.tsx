'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getEstimateTotal } from '@/lib/data';
import { useData } from '@/lib/data-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ArrowLeft, Download, Mail, CheckCircle2 } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string }> = {
  Draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  Sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  Accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  Rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  Converted: { label: 'Converted', color: 'bg-purple-100 text-purple-800' },
};

export default function EstimateDetailPage() {
  const { id } = useParams() as { id: string };
  const { loading, getEstimateById, getCustomerById } = useData();
  const estimate = getEstimateById(id);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <PageHeader title="Estimate Not Found" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">This estimate could not be found.</p>
            <Button render={<Link href="/estimates" />} className="bg-primary hover:bg-primary/90">
              Back to Estimates
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const customer = getCustomerById(estimate.customerId);
  const total = getEstimateTotal(estimate);
  const config = statusConfig[estimate.status];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title={estimate.estimateNumber}
        description={`${customer?.name || 'Unknown'} • ${customer?.address || 'No address'}`}
        actions={
          <div className="flex gap-2">
            <Button render={<Link href="/estimates" />} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Button variant="outline" size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Send
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        }
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto max-w-4xl">
        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{customer?.name}</CardTitle>
                  <CardDescription>{customer?.address || 'No address'}</CardDescription>
                </div>
                <Badge className={`${config.color}`}>{config.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer Email</p>
                  <p className="font-medium text-foreground">{customer?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer Phone</p>
                  <p className="font-medium text-foreground">{customer?.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created Date</p>
                  <p className="font-medium text-foreground">{format(new Date(estimate.createdDate), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valid Until</p>
                  <p className="font-medium text-foreground">{format(new Date(estimate.validUntil), 'PPP')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Estimate Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimate.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-foreground">{item.description}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.quantity}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3 max-w-xs ml-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground font-medium">
                    ${(total + (estimate.discount || 0)).toFixed(2)}
                  </span>
                </div>
                {estimate.discount ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-600 font-medium">-${estimate.discount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="font-bold text-lg text-primary">${total.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="border-t border-border pt-3 flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-lg text-primary">${total.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {estimate.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{estimate.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {estimate.status === 'Sent' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <p className="font-semibold text-blue-900">Accept Estimate</p>
              </div>
              <p className="text-sm text-blue-800">
                Once the customer accepts this estimate, it will be converted to a job and invoice.
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700">Mark as Accepted</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
