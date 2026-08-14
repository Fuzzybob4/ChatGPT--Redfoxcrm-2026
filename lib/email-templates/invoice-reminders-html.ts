interface InvoiceReminderEmailData {
  customerName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  dueDate: string;
  companyName: string;
  companyEmail: string;
  paymentLink?: string;
}

type ReminderType = 'invoice_sent' | 'payment_reminder' | 'overdue_notice';

interface RenderInvoiceReminderEmailOptions {
  type: ReminderType;
  data: InvoiceReminderEmailData;
  daysPastDue?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paymentButton(paymentLink: string | undefined, label: string, backgroundColor: string): string {
  if (!paymentLink) {
    return '';
  }

  return `
    <div style="text-align:center;margin:30px 0">
      <a href="${escapeHtml(paymentLink)}" style="background-color:${backgroundColor};color:white;padding:12px 30px;text-decoration:none;border-radius:4px;display:inline-block">
        ${label}
      </a>
    </div>
  `;
}

function detailPanel(content: string, backgroundColor: string, borderLeft?: string): string {
  const border = borderLeft ? `border-left:${borderLeft};` : '';

  return `
    <div style="background-color:${backgroundColor};padding:20px;border-radius:8px;margin:20px 0;${border}">
      ${content}
    </div>
  `;
}

export function renderInvoiceReminderEmail({ type, data, daysPastDue = 0 }: RenderInvoiceReminderEmailOptions): string {
  const customerName = escapeHtml(data.customerName);
  const invoiceNumber = escapeHtml(data.invoiceNumber);
  const invoiceAmount = escapeHtml(data.invoiceAmount);
  const dueDate = escapeHtml(data.dueDate);
  const companyName = escapeHtml(data.companyName);
  const companyEmail = escapeHtml(data.companyEmail);

  let heading = '';
  let headingColor = '';
  let body = '';
  let panel = '';
  let button = '';
  let closing = '';

  switch (type) {
    case 'invoice_sent':
      heading = 'Invoice Sent';
      headingColor = '#2c3e50';
      body = `
        <p>Thank you for your business! Your invoice has been sent and is ready for payment.</p>
      `;
      panel = detailPanel(`
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p><strong>Amount Due:</strong> ${invoiceAmount}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
      `, '#f5f5f5');
      button = paymentButton(data.paymentLink, 'Pay Invoice', '#3498db');
      closing = `
        <p>If you have any questions, please contact us at ${companyEmail}.</p>
        <p>Best regards,<br />${companyName}</p>
      `;
      break;
    case 'payment_reminder':
      heading = 'Payment Reminder';
      headingColor = '#e74c3c';
      body = `
        <p>This is a friendly reminder that your invoice payment is due soon.</p>
      `;
      panel = detailPanel(`
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p><strong>Amount Due:</strong> ${invoiceAmount}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
      `, '#fff3cd', '4px solid #ffc107');
      button = paymentButton(data.paymentLink, 'Pay Now', '#f39c12');
      closing = `
        <p>If you've already made payment, please disregard this message. Thank you!</p>
        <p>For any questions, reach out to ${companyEmail}.</p>
        <p>Best regards,<br />${companyName}</p>
      `;
      break;
    case 'overdue_notice':
      heading = 'Payment Overdue';
      headingColor = '#c0392b';
      body = `
        <p>Your invoice is now ${Math.max(daysPastDue, 0)} days overdue. We would appreciate your immediate attention to this matter.</p>
      `;
      panel = detailPanel(`
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p><strong>Amount Due:</strong> ${invoiceAmount}</p>
        <p><strong>Original Due Date:</strong> ${dueDate}</p>
      `, '#fadbd8', '4px solid #e74c3c');
      button = paymentButton(data.paymentLink, 'Pay Immediately', '#e74c3c');
      closing = `
        <p>Please remit payment as soon as possible. If payment has already been sent, please disregard this notice.</p>
        <p>Contact us immediately if you have any concerns: ${companyEmail}.</p>
        <p>Thank you,<br />${companyName}</p>
      `;
      break;
  }

  return `
    <div style="font-family:Arial,sans-serif;color:#333;line-height:1.6">
      <div style="max-width:600px;margin:0 auto;padding:20px">
        <h1 style="color:${headingColor};margin-bottom:20px">${heading}</h1>
        <p>Hi ${customerName},</p>
        ${body}
        ${panel}
        ${button}
        ${closing}
      </div>
    </div>
  `;
}
