-- Applied to production 2026-11-08.
alter table public.invoices add column if not exists estimate_id uuid references public.estimates(id) on delete set null;
create index if not exists invoices_estimate_id_idx on public.invoices(estimate_id);

alter table public.estimates
  add column if not exists approval_token text,
  add column if not exists deposit_percent numeric not null default 0 check (deposit_percent >= 0 and deposit_percent <= 100),
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_name text,
  add column if not exists approval_ip text,
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text,
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
create unique index if not exists estimates_approval_token_key on public.estimates(approval_token) where approval_token is not null;
