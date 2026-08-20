import { NextResponse } from 'next/server';
import { getPendingEmailReminders, markReminderAsSent, markReminderAsFailed } from '@/app/(crm)/invoices/billing-actions';
import { getOrCreatePortalToken } from '@/app/(crm)/customers/portal-actions';
import { sendEmail } from '@/lib/email/resend';
import { renderInvoiceReminderEmail } from '@/lib/email-templates/invoice-reminders-html';

function getPortalBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export async function GET(request: Request) {
  // Verify this is a valid cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const reminders = await getPendingEmailReminders();
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const reminder of reminders) {
      try {
        // Get email template based on reminder type
        let emailSubject = '';
        let daysPastDue = 0;

        // Generate (or reuse) this customer's portal link so the reminder
        // email can send them straight to their invoice, where they can also
        // add any optional extras the business has enabled.
        let paymentLink: string | undefined;
        try {
          const portalToken = await getOrCreatePortalToken(reminder.customer_id);
          paymentLink = `${getPortalBaseUrl()}/customer-portal/${portalToken}`;
        } catch (linkError) {
          console.error('[v0] Failed to generate portal link for reminder:', linkError);
        }

        const invoiceData = {
          customerName: reminder.customers?.name || 'Valued Customer',
          invoiceNumber: reminder.invoices?.invoice_number || 'Unknown',
          invoiceAmount: `$${reminder.invoices?.total_amount || 0}`,
          dueDate: reminder.invoices?.due_date 
            ? new Date(reminder.invoices.due_date).toLocaleDateString()
            : 'TBD',
          companyName: reminder.organizations?.name || 'Our Company',
          companyEmail: reminder.organizations?.email || 'billing@company.com',
          paymentLink,
        };

        switch (reminder.reminder_type) {
          case 'invoice_sent':
            emailSubject = `Invoice ${invoiceData.invoiceNumber} - Payment Due`;
            break;
          case 'payment_reminder':
            emailSubject = `Reminder: Invoice ${invoiceData.invoiceNumber} Payment Due Soon`;
            break;
          case 'overdue_notice':
            daysPastDue = Math.floor(
              (new Date().getTime() - new Date(reminder.invoices?.due_date || new Date()).getTime()) / 
              (1000 * 60 * 60 * 24)
            );
            emailSubject = `URGENT: Invoice ${invoiceData.invoiceNumber} is Overdue`;
            break;
        }

        if (!emailSubject) {
          throw new Error(`Unknown reminder type: ${reminder.reminder_type}`);
        }

        // Render and send email
        const html = renderInvoiceReminderEmail({
          type: reminder.reminder_type,
          data: invoiceData,
          daysPastDue,
        });
        
        await sendEmail({
          to: reminder.email_address,
          subject: emailSubject,
          html,
        });

        // Mark as sent
        await markReminderAsSent(reminder.id);
        results.sent++;
        console.log(`[v0] Sent ${reminder.reminder_type} reminder to ${reminder.email_address}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.errors.push(`Reminder ${reminder.id}: ${errorMessage}`);
        
        try {
          await markReminderAsFailed(reminder.id, errorMessage);
        } catch (markError) {
          console.error('[v0] Failed to mark reminder as failed:', markError);
        }
        
        console.error(`[v0] Failed to send reminder ${reminder.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${reminders.length} pending reminders`,
      results,
    });
  } catch (error) {
    console.error('[v0] Error in send-invoice-reminders cron job:', error);
    return NextResponse.json(
      {
        error: 'Failed to process reminders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Allow manual trigger from admin panel
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delegate to GET handler
  return GET(request);
}
