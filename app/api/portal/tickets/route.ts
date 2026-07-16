import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPortalToken } from '@/app/(crm)/customers/portal-actions';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { customerId, token, subject, message } = await request.json();

    // Verify the portal token
    const customer = await verifyPortalToken(token);
    if (!customer || customer.id !== customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Trigger notification to admin
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/ticket-created`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          customerId,
          orgId: customer.org_id,
          customerName: customer.first_name + ' ' + customer.last_name,
          subject,
        }),
      }).catch((err) => console.error('Notification failed:', err));
    } catch (err) {
      console.error('Failed to trigger notification:', err);
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
