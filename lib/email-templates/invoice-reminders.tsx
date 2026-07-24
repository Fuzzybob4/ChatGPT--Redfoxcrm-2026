import React from 'react';

interface InvoiceEmailProps {
  customerName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  dueDate: string;
  companyName: string;
  companyEmail: string;
  paymentLink?: string;
}

export const InvoiceSentEmail: React.FC<InvoiceEmailProps> = ({
  customerName,
  invoiceNumber,
  invoiceAmount,
  dueDate,
  companyName,
  companyEmail,
  paymentLink,
}) => (
  <div style={{ fontFamily: 'Arial, sans-serif', color: '#333', lineHeight: '1.6' }}>
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>Invoice Sent</h1>
      
      <p>Hi {customerName},</p>
      
      <p>
        Thank you for your business! Your invoice has been sent and is ready for payment.
      </p>

      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px', 
        marginY: '20px' 
      }}>
        <p><strong>Invoice Number:</strong> {invoiceNumber}</p>
        <p><strong>Amount Due:</strong> {invoiceAmount}</p>
        <p><strong>Due Date:</strong> {dueDate}</p>
      </div>

      {paymentLink && (
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a 
            href={paymentLink}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              padding: '12px 30px',
              textDecoration: 'none',
              borderRadius: '4px',
              display: 'inline-block'
            }}
          >
            Pay Invoice
          </a>
        </div>
      )}

      <p>If you have any questions, please contact us at {companyEmail}.</p>
      
      <p>Best regards,<br />{companyName}</p>
    </div>
  </div>
);

export const PaymentReminderEmail: React.FC<InvoiceEmailProps> = ({
  customerName,
  invoiceNumber,
  invoiceAmount,
  dueDate,
  companyName,
  companyEmail,
  paymentLink,
}) => (
  <div style={{ fontFamily: 'Arial, sans-serif', color: '#333', lineHeight: '1.6' }}>
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ color: '#e74c3c', marginBottom: '20px' }}>Payment Reminder</h1>
      
      <p>Hi {customerName},</p>
      
      <p>
        This is a friendly reminder that your invoice payment is due soon.
      </p>

      <div style={{ 
        backgroundColor: '#fff3cd', 
        padding: '20px', 
        borderRadius: '8px', 
        marginY: '20px',
        borderLeft: '4px solid #ffc107'
      }}>
        <p><strong>Invoice Number:</strong> {invoiceNumber}</p>
        <p><strong>Amount Due:</strong> {invoiceAmount}</p>
        <p><strong>Due Date:</strong> {dueDate}</p>
      </div>

      {paymentLink && (
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a 
            href={paymentLink}
            style={{
              backgroundColor: '#f39c12',
              color: 'white',
              padding: '12px 30px',
              textDecoration: 'none',
              borderRadius: '4px',
              display: 'inline-block'
            }}
          >
            Pay Now
          </a>
        </div>
      )}

      <p>If you've already made payment, please disregard this message. Thank you!</p>
      
      <p>For any questions, reach out to {companyEmail}.</p>
      
      <p>Best regards,<br />{companyName}</p>
    </div>
  </div>
);

export const OverdueNoticeEmail: React.FC<InvoiceEmailProps & { daysPastDue: number }> = ({
  customerName,
  invoiceNumber,
  invoiceAmount,
  dueDate,
  companyName,
  companyEmail,
  paymentLink,
  daysPastDue,
}) => (
  <div style={{ fontFamily: 'Arial, sans-serif', color: '#333', lineHeight: '1.6' }}>
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ color: '#c0392b', marginBottom: '20px' }}>Payment Overdue</h1>
      
      <p>Hi {customerName},</p>
      
      <p>
        Your invoice is now {daysPastDue} days overdue. We would appreciate your immediate attention to this matter.
      </p>

      <div style={{ 
        backgroundColor: '#fadbd8', 
        padding: '20px', 
        borderRadius: '8px', 
        marginY: '20px',
        borderLeft: '4px solid #e74c3c'
      }}>
        <p><strong>Invoice Number:</strong> {invoiceNumber}</p>
        <p><strong>Amount Due:</strong> {invoiceAmount}</p>
        <p><strong>Original Due Date:</strong> {dueDate}</p>
      </div>

      {paymentLink && (
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a 
            href={paymentLink}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              padding: '12px 30px',
              textDecoration: 'none',
              borderRadius: '4px',
              display: 'inline-block'
            }}
          >
            Pay Immediately
          </a>
        </div>
      )}

      <p>Please remit payment as soon as possible. If payment has already been sent, please disregard this notice.</p>
      
      <p>Contact us immediately if you have any concerns: {companyEmail}.</p>
      
      <p>Thank you,<br />{companyName}</p>
    </div>
  </div>
);
