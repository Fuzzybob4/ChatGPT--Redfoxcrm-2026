-- Square invoices now import their real line items (from the Square order).
-- This marks invoices whose items have been pulled, so each is fetched once.
alter table public.invoices add column if not exists square_items_synced_at timestamptz;
