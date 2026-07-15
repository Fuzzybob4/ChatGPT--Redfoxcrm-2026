/**
 * Fleet customer notifications
 * Sends transactional emails to customers when crew arrives or departs a job
 */

import { getResendClient } from './email/resend';
import { createAdminClient } from './supabase/admin';

interface FleetNotificationContext {
  orgId: string;
  workOrderId: string;
  employeeId: string;
  eventType: 'on_the_way' | 'arrived' | 'completed';
}

/**
 * Send a fleet notification email to the customer for a given work order event
 */
export async function sendFleetNotification({
  orgId,
  workOrderId,
  employeeId,
  eventType,
}: FleetNotificationContext) {
  const supabase = createAdminClient();

  // Load work order, customer, employee, and org settings in parallel
  const [{ data: workOrder }, { data: employee }, { data: org }] =
    await Promise.all([
      supabase
        .from('work_orders')
        .select(`
          id,
          title,
          scheduled_date,
          customers (
            id,
            full_name,
            email,
            fleet_notifications_enabled
          )
        `)
        .eq('id', workOrderId)
        .single(),
      supabase
        .from('employees')
        .select('id, first_name, last_name, phone')
        .eq('id', employeeId)
        .single(),
      supabase
        .from('organizations')
        .select('name, email')
        .eq('id', orgId)
        .single(),
    ]);

  if (!workOrder || !employee || !org) {
    console.error('[fleet-notifications] Missing data for notification', {
      workOrder: !!workOrder,
      employee: !!employee,
      org: !!org,
    });
    return;
  }

  const customer = Array.isArray(workOrder.customers)
    ? workOrder.customers[0]
    : workOrder.customers;

  if (!customer?.email) {
    console.log('[fleet-notifications] Customer has no email — skipping');
    return;
  }

  // Respect customer opt-out (defaults to enabled if column missing)
  if (customer.fleet_notifications_enabled === false) {
    console.log('[fleet-notifications] Customer opted out of fleet notifications');
    return;
  }

  const techName = `${employee.first_name} ${employee.last_name}`;
  const customerName = customer.full_name ?? 'Valued Customer';
  const businessName = org.name ?? 'Your Service Provider';
  const fromEmail = `notifications@redfoxcrm.app`;
  const fromName = businessName;

  const { subject, body } = buildNotificationContent({
    eventType,
    techName,
    customerName,
    jobTitle: workOrder.title ?? 'your service',
    businessName,
  });

  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: customer.email,
      subject,
      html: buildFleetEmailHtml({ body, techName, businessName, eventType }),
    });
    console.log(`[fleet-notifications] Sent "${eventType}" notification to ${customer.email}`);
  } catch (error) {
    console.error('[fleet-notifications] Failed to send email:', error);
  }
}

function buildNotificationContent({
  eventType,
  techName,
  customerName,
  jobTitle,
  businessName,
}: {
  eventType: FleetNotificationContext['eventType'];
  techName: string;
  customerName: string;
  jobTitle: string;
  businessName: string;
}): { subject: string; body: string } {
  switch (eventType) {
    case 'on_the_way':
      return {
        subject: `${techName} is on the way`,
        body: `Hi ${customerName},\n\nYour ${businessName} technician ${techName} is on the way to your location for ${jobTitle}.\n\nWe will send another update when they arrive.\n\nThank you for choosing ${businessName}.`,
      };
    case 'arrived':
      return {
        subject: `${techName} has arrived`,
        body: `Hi ${customerName},\n\nYour ${businessName} technician ${techName} has arrived at your location to begin ${jobTitle}.\n\nThank you for choosing ${businessName}.`,
      };
    case 'completed':
      return {
        subject: `Your service has been completed`,
        body: `Hi ${customerName},\n\n${techName} from ${businessName} has completed ${jobTitle} at your location.\n\nIf you have any questions or concerns about today's service, please don't hesitate to reach out.\n\nThank you for choosing ${businessName}.`,
      };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildFleetEmailHtml({
  body,
  techName,
  businessName,
  eventType,
}: {
  body: string;
  techName: string;
  businessName: string;
  eventType: FleetNotificationContext['eventType'];
}) {
  const statusIcon =
    eventType === 'on_the_way'
      ? '&#x1F697;'
      : eventType === 'arrived'
      ? '&#x2705;'
      : '&#x2B50;';
  const statusColor =
    eventType === 'on_the_way'
      ? '#3b82f6'
      : eventType === 'arrived'
      ? '#22c55e'
      : '#f59e0b';

  const safeBusiness = escapeHtml(businessName);
  const safeTech = escapeHtml(techName);

  const bodyHtml = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map((l) => `<p style="margin:0 0 12px;line-height:1.6;color:#374151;">${l || '&nbsp;'}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header bar -->
        <tr><td style="background:${statusColor};padding:20px 40px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">${statusIcon}&nbsp; ${safeBusiness}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px 24px;">
          <div style="font-size:15px;">${bodyHtml}</div>
        </td></tr>
        <!-- Tech badge -->
        <tr><td style="padding:0 40px 32px;">
          <div style="display:inline-flex;align-items:center;gap:12px;background:#f9fafb;border-radius:8px;padding:12px 16px;border:1px solid #e5e7eb;">
            <div style="width:36px;height:36px;border-radius:50%;background:${statusColor};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;line-height:36px;text-align:center;">${escapeHtml(techName.charAt(0))}</div>
            <div>
              <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${safeTech}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Certified Technician &middot; ${safeBusiness}</p>
            </div>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:16px 40px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${safeBusiness} via RedFox CRM &mdash; Automated fleet notification</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
