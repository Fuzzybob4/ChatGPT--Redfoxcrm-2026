import { createNotification } from '@/app/(crm)/notifications/actions';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { ticketId, customerId, orgId, customerName, subject } = await request.json();

    // Create notification for the organization
    await createNotification({
      orgId,
      type: 'ticket_created',
      title: `New Support Ticket from ${customerName}`,
      message: `${customerName} submitted a support ticket: "${subject}"`,
      relatedId: ticketId,
      customerId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
