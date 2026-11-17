'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getInvoiceShareInfo, markInvoiceShared, type InvoiceShareInfo } from '@/app/(crm)/invoices/actions';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Text or copy the customer's pay link: works when emails land in spam. */
export function InvoiceSharePanel({ invoiceId, onShared }: { invoiceId: string; onShared?: () => void }) {
  const [info, setInfo] = useState<InvoiceShareInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoiceShareInfo(invoiceId)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the link'));
  }, [invoiceId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!info) return null;

  const owing = info.depositDue > 0 ? `the ${usd(info.depositDue)} deposit` : info.amountDue > 0 ? usd(info.amountDue) : null;
  const message = `Hi ${info.customerFirstName}, here's your invoice${info.invoiceNumber ? ` ${info.invoiceNumber}` : ''} from ${info.businessName}${
    owing ? `. You can view it and pay ${owing} securely here` : '. You can view it here'
  }: ${info.link}`;
  const smsBody = encodeURIComponent(message);
  const phone = (info.customerPhone ?? '').replace(/[^\d+]/g, '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await markInvoiceShared(invoiceId);
      onShared?.();
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it.");
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Send the pay link</CardTitle>
        <CardDescription className="text-xs">
          Text it from your phone so it doesn&apos;t land in spam. They can view the invoice and pay online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="break-all rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground select-all">{info.link}</p>
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <Button
              size="sm"
              className="gap-2"
              render={<a href={`sms:${phone}?&body=${smsBody}`} />}
              onClick={() => void markInvoiceShared(invoiceId).then(() => onShared?.())}
            >
              <MessageSquare className="size-4" />
              Text to customer
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Add a phone number to the customer to text it.</p>
          )}
          <Button size="sm" variant="outline" className="gap-2" onClick={() => void copy()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
