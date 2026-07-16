import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPortalToken } from '@/app/(crm)/customers/portal-actions';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { customerId, token, title, description } = await request.json();

    // Verify the portal token
    const customer = await verifyPortalToken(token);
    if (!customer || customer.id !== customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Create work order request
    const { data: workOrder, error: createError } = await admin
      .from('work_order_requests')
      .insert({
        customer_id: customerId,
        org_id: customer.org_id,
        title,
        description,
        status: 'pending',
        created_from_portal: true,
      })
      .select()
      .single();

    if (createError || !workOrder) {
      console.error('Error creating work order:', createError);
      return NextResponse.json(
        { error: 'Failed to create work order' },
        { status: 500 }
      );
    }

    // Trigger notification to admin
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/work-order-created`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId: workOrder.id,
          customerId,
          orgId: customer.org_id,
          customerName: customer.first_name + ' ' + customer.last_name,
          title,
        }),
      }).catch((err) => console.error('Notification failed:', err));
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }

    return NextResponse.json({ success: true, workOrderId: workOrder.id });
  } catch (error) {
    console.error('Work order API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
