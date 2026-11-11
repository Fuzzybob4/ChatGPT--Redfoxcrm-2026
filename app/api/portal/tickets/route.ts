import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPortalToken } from '@/app/(crm)/customers/portal-actions';
import { type NextRequest, NextResponse } from 'next/server';
import { createNotification } from '@/lib/notifications-server';

export async function POST(request: NextRequest) {
  try {
    const { customerId, token, subject, message } = await request.json();

    // Verify the portal token
    const customer = await verifyPortalToken(token);
    if (!customer || customer.id !== customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerName =
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'A customer';

    const admin = createAdminClient();

    // Create support ticket
    const { data: ticket, error: createError } = await admin
      .from('support_tickets')
      .insert({
        customer_id: customerId,
        org_id: customer.org_id,
        subject,
        description: message,
        status: 'open',
        priority: 'medium',
        created_from_portal: true,
      })
      .select()
      .single();

    if (createError || !ticket) {
      console.error('Error creating ticket:', createError);
      return NextResponse.json(
        { error: 'Failed to create support ticket' },
        { status: 500 }
      );
    }

    // Notify the business (org comes from the verified portal token).
    try {
      await createNotification({
        orgId: customer.org_id,
        type: 'ticket_created',
        title: `New Support Ticket from ${customerName}`,
        message: `${customerName} submitted a support ticket: "${subject}"`,
        relatedId: ticket.id,
        customerId,
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
    }

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch (error) {
    console.error('Ticket API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
