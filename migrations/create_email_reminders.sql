-- Email Reminder Settings for organization-wide email reminder configuration
CREATE TABLE IF NOT EXISTS email_reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('invoice_due', 'payment_received', 'overdue')),
  enabled BOOLEAN DEFAULT TRUE,
  reminder_intervals TEXT NOT NULL, -- JSON array of days: [2, 7, 14]
  email_template_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, reminder_type)
);

-- Email Reminder Queue for tracking sent reminders
CREATE TABLE IF NOT EXISTS invoice_email_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('invoice_sent', 'payment_reminder', 'overdue_notice')),
  reminder_day_offset INTEGER NOT NULL, -- days after invoice creation or due date
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  email_address VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(invoice_id, reminder_type, reminder_day_offset)
);

CREATE INDEX idx_invoice_email_reminders_org ON invoice_email_reminders(org_id);
CREATE INDEX idx_invoice_email_reminders_invoice ON invoice_email_reminders(invoice_id);
CREATE INDEX idx_invoice_email_reminders_scheduled ON invoice_email_reminders(scheduled_for) WHERE sent_at IS NULL;
