-- Payment Terms table for storing flexible payment options
CREATE TABLE IF NOT EXISTS payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('full', 'deposit')),
  deposit_percentage DECIMAL(3, 2),
  deposit_amount DECIMAL(10, 2),
  full_payment_amount DECIMAL(10, 2),
  deposit_due_date DATE,
  full_payment_due_date DATE,
  deposit_paid_date DATE,
  full_payment_paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_terms_invoice ON payment_terms(invoice_id);
CREATE INDEX idx_payment_terms_org ON payment_terms(org_id);
