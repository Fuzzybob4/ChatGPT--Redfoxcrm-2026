-- Square payments taken without a Square invoice (card, cash, payment links)
-- are imported as paid Red Fox invoices keyed by the Square payment ID.
alter table public.invoices add column if not exists square_payment_id text;
create unique index if not exists invoices_org_square_payment_uidx on public.invoices(org_id, square_payment_id) where square_payment_id is not null;
