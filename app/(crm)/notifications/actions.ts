'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export async function getNotifications(orgId: string) {
  const admin = createAdminClient();

  const { data: notifications, error } = await admin
    .from('notifications')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return notifications || [];
}

export async function getUnreadNotificationCount(orgId: string) {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
}

export async function markNotificationAsRead(notificationId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(orgId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all as read:', error);
    throw error;
  }
}

export async function createNotification(data: {
  orgId: string;
  type: string;
  title: string;
  message?: string;
  relatedId?: string;
  customerId?: string;
}) {
  const admin = createAdminClient();

  const { error } = await admin.from('notifications').insert({
    org_id: data.orgId,
    type: data.type,
    title: data.title,
    message: data.message,
    related_id: data.relatedId,
    customer_id: data.customerId,
  });

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}
