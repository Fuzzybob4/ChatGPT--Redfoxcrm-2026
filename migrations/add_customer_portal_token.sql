-- Add portal_access_token column to customers table
-- This token allows customers to access their portal without authentication

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS portal_access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS portal_token_created_at TIMESTAMP WITH TIME ZONE;

-- Create an index for faster lookups by token
CREATE INDEX IF NOT EXISTS idx_customers_portal_access_token ON customers(portal_access_token)
WHERE portal_access_token IS NOT NULL;
