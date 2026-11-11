import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-only helpers. Not server actions: callers must already know the org is
// legitimate (e.g. it came from a verified portal token or a signed-in user).

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

