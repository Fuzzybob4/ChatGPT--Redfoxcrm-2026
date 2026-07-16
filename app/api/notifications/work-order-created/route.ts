import { createNotification } from '@/app/(crm)/notifications/actions';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { workOrderId, customerId, orgId, customerName, title } = await request.json();

    // Create notification for the organization
    await createNotification({
      orgId,
      type: 'work_order_created',
      title: `New Work Order from ${customerName}`,
      message: `${customerName} submitted a work order: "${title}"`,
      relatedId: workOrderId,
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
