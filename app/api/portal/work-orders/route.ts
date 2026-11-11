import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPortalToken } from '@/app/(crm)/customers/portal-actions';
import { type NextRequest, NextResponse } from 'next/server';
import { createNotification } from '@/lib/notifications-server';

export async function POST(request: NextRequest) {
  try {
    const { customerId, token, title, description } = await request.json();

    // Verify the portal token
    const customer = await verifyPortalToken(token);
    if (!customer || customer.id !== customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerName =
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'A customer';

    const admin = createAdminClient();

    // Create work order request (customer "trouble call")
    const { data: workOrder, error: createError } = await admin
      .from('work_order_requests')
      .insert({
        customer_id: customerId,
        org_id: customer.org_id,
        title,
        description,
        status: 'new',
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

    // Notify the business (org comes from the verified portal token).
    try {
      await createNotification({
        orgId: customer.org_id,
        type: 'work_order_created',
        title: `New Work Order from ${customerName}`,
        message: `${customerName} submitted a work order: "${title}"`,
        relatedId: workOrder.id,
        customerId,
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
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
