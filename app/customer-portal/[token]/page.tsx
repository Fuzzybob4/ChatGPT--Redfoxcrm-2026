import { notFound } from 'next/navigation';
import { verifyPortalToken } from '@/app/(crm)/customers/portal-actions';
import { CustomerPortalClient } from '@/components/customer-portal/customer-portal-client';

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

  return (
    <div className="min-h-screen bg-background">
      <CustomerPortalClient customer={customer} token={token} />
    </div>
  );
}
