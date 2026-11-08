-- Applied to production 2026-11-08.
alter table public.customers add column if not exists square_customer_id text;
create unique index if not exists customers_org_square_customer_id_key on public.customers(org_id, square_customer_id) where square_customer_id is not null;
alter table public.invoices add column if not exists square_invoice_id text;
create unique index if not exists invoices_org_square_invoice_id_key on public.invoices(org_id, square_invoice_id) where square_invoice_id is not null;
