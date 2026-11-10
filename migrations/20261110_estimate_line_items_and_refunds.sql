-- Estimates get real line items (customers pick which to approve), and
-- invoices get a refund log.
create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  optional boolean not null default true,
  selected boolean,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists estimate_line_items_estimate_idx on public.estimate_line_items(estimate_id);
alter table public.estimate_line_items enable row level security;
create policy "org members read estimate_line_items" on public.estimate_line_items for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = estimate_line_items.org_id and m.user_id = auth.uid()));

create table if not exists public.invoice_refunds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  reason text,
  method text not null default 'stripe',
  stripe_refund_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'succeeded',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists invoice_refunds_invoice_idx on public.invoice_refunds(invoice_id);
alter table public.invoice_refunds enable row level security;
create policy "org members read invoice_refunds" on public.invoice_refunds for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = invoice_refunds.org_id and m.user_id = auth.uid()));
alter table public.invoices add column if not exists amount_refunded numeric not null default 0;
