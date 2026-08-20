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
  /** When true (default), also enqueue an email to the org's notification inbox. */
  sendEmail?: boolean;
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

  // Also enqueue an email to the business so they are alerted off-platform.
  if (data.sendEmail !== false) {
    try {
      await enqueueOrgEmail(data.orgId, data.title, data.message ?? data.title);
    } catch (emailError) {
      // Email is best-effort; never fail the in-app notification because of it.
      console.error('Error enqueuing notification email:', emailError);
    }
  }
}

/**
 * Resolve the best destination email for an organization and enqueue a message
 * into notification_outbox (picked up by the email-sending worker/cron).
 */
export async function enqueueOrgEmail(orgId: string, subject: string, body: string) {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('business_notification_email, business_reply_to_email, owner_user_id')
    .eq('id', orgId)
    .maybeSingle();

  let toEmail = org?.business_notification_email || org?.business_reply_to_email || null;

  // Fall back to the owner's auth email if no business email is configured.
  if (!toEmail && org?.owner_user_id) {
    const { data: ownerData } = await admin.auth.admin.getUserById(org.owner_user_id);
    toEmail = ownerData?.user?.email ?? null;
  }

  if (!toEmail) {
    console.error('No destination email found for org', orgId);
    return;
  }

  const { error } = await admin.from('notification_outbox').insert({
    org_id: orgId,
    to_email: toEmail,
    subject,
    body,
    status: 'pending',
  });

  if (error) {
    console.error('Error inserting into notification_outbox:', error);
    throw error;
  }
}

export async function deleteNotification(notificationId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

export async function deleteAllNotifications(orgId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('notifications')
    .delete()
    .eq('org_id', orgId);

  if (error) {
    console.error('Error deleting all notifications:', error);
    throw error;
  }
}
