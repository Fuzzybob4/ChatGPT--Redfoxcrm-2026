import { redirect } from 'next/navigation';
import { getCurrentOrg } from '@/lib/org';
import { getNotifications } from './actions';
import { NotificationsClient } from './notifications-client';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect('/onboarding');

  const notifications = await getNotifications(org.orgId);

  return <NotificationsClient orgId={org.orgId} initialNotifications={notifications} />;
}
