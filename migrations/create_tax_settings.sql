-- Tax Settings table for storing organization tax rates and defaults
CREATE TABLE IF NOT EXISTS tax_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tax_name VARCHAR(100) NOT NULL,
  tax_rate DECIMAL(5, 2) NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, tax_name)
);

-- Invoice Tax table for tracking which tax is applied to each invoice
CREATE TABLE IF NOT EXISTS invoice_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tax_setting_id UUID NOT NULL REFERENCES tax_settings(id),
  tax_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tax_settings_org ON tax_settings(org_id);
CREATE INDEX idx_invoice_taxes_invoice ON invoice_taxes(invoice_id);
