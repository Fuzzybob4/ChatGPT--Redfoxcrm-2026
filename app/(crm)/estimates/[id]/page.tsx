'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useData } from '@/lib/data-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ArrowLeft, Download, Mail, Pencil } from 'lucide-react';
import { EstimateApprovalPanel } from '@/components/estimates/estimate-approval-panel';
import { formatPropertyAddress } from '@/components/customers/property-picker';

const statusConfig: Record<string, { label: string; color: string }> = {
  Draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  Sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  Accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  Rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  Declined: { label: 'Declined', color: 'bg-red-100 text-red-800' },
  Viewed: { label: 'Viewed', color: 'bg-blue-100 text-blue-800' },
  Expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800' },
  Converted: { label: 'Converted', color: 'bg-purple-100 text-purple-800' },
};

export default function EstimateDetailPage() {
  const { id } = useParams() as { id: string };
  const { loading, getEstimateById, getCustomerById, refresh, properties } = useData();
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
  const property = properties.find((p) => p.id === (estimate as { propertyId?: string | null }).propertyId);
  const placeAddress = property ? formatPropertyAddress(property) : customer?.address || 'No address';
  // Saved total reflects what the customer approved (tax included).
  const total = (estimate as { total?: number }).total ?? 0;
  const config = statusConfig[estimate.status] ?? { label: estimate.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title={estimate.estimateNumber}
        description={`${customer?.name || 'Unknown'} • ${placeAddress}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/estimates" />} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {!(estimate as { invoiceId?: string | null }).invoiceId && estimate.status !== 'Accepted' && estimate.status !== 'Converted' && (
              <Button render={<Link href={`/estimates/${estimate.id}/edit`} />} variant="outline" size="sm">
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('estimate-approval')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Mail className="w-4 h-4 mr-2" />
              Send
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        }
      />

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto max-w-4xl">
        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{customer?.name}</CardTitle>
                  <CardDescription>
                    {property ? <><span className="font-medium text-foreground">{property.propertyName || 'Property'}</span> · </> : null}
                    {placeAddress}
                  </CardDescription>
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
                  <p className="font-medium text-foreground">{estimate.validUntil ? format(new Date(estimate.validUntil + 'T12:00:00'), 'PPP') : '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Send, pictures and opens: right under the header so it's easy to find */}
          <div id="estimate-approval" className="print:hidden">
            <EstimateApprovalPanel estimateId={estimate.id} onChanged={() => void refresh()} />
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Estimate Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border rounded-lg border border-border md:hidden">
                {estimate.lineItems.map((item) => (
                  <li key={item.id} className={`flex flex-col gap-1 p-3 ${item.selected === false ? 'opacity-50' : ''}`}>
                    <p className="whitespace-pre-line text-sm text-foreground">{item.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity} × ${item.unitPrice.toFixed(2)}
                        {item.selected === false && ' · customer skipped'}
                      </span>
                      <span className="font-semibold text-foreground">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden border border-border rounded-lg overflow-hidden md:block">
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
                      <TableRow key={item.id} className={item.selected === false ? 'opacity-50 line-through' : ''}>
                        <TableCell className="whitespace-pre-line text-foreground">
                          {item.description}
                          {item.selected === false && <span className="ml-2 text-xs no-underline">(customer skipped)</span>}
                        </TableCell>
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
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">{estimate.status === 'Accepted' ? 'Approved total' : 'Total'}</span>
                  <span className="font-bold text-lg text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {estimate.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal notes</CardTitle>
                <CardDescription>Only your team sees these. The customer never does.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-muted-foreground">{estimate.notes}</p>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
