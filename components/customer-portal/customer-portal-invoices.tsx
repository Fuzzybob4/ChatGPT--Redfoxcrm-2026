'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CustomerPortalInvoicesProps {
  customerId: string;
}

export function CustomerPortalInvoices({ customerId }: CustomerPortalInvoicesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Invoices</h2>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No invoices yet</p>
          <p className="text-sm text-muted-foreground">
            Your invoices will appear here once they are issued
          </p>
        </Card>
      </div>
    </div>
  );
}
