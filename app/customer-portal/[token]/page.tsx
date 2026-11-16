import { notFound } from 'next/navigation';
import { verifyPortalToken } from '@/app/(crm)/customers/portal-actions';
import { getPortalInvoices } from '@/app/(crm)/customers/portal-invoice-actions';
import { CustomerPortalClient } from '@/components/customer-portal/customer-portal-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { isStaffOf } from '@/lib/estimates/images';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function CustomerPortalPage({ params }: Props) {
  const { token } = await params;

  // Verify the token and get customer
  const customer = await verifyPortalToken(token);

  if (!customer) {
    notFound();
  }

  const invoices = await getPortalInvoices(token);

  // Record that the customer opened their invoices (the business previewing
  // the portal while signed in doesn't count). Only open balances matter.
  const open = invoices.filter((i) => !['paid', 'cancelled', 'void'].includes(String(i.status).toLowerCase())).map((i) => i.id);
  if (open.length && !(await isStaffOf(String((customer as { org_id?: string }).org_id ?? '')))) {
    await createAdminClient().rpc('record_invoice_views', { p_ids: open }).then(() => undefined, () => undefined);
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerPortalClient customer={customer} token={token} initialInvoices={invoices} />
    </div>
  );
}
