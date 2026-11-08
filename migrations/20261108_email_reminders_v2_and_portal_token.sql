-- Applied to production 2026-11-08.
alter table public.organizations add column if not exists invoice_reminders_enabled boolean not null default true;
alter table public.customers add column if not exists invoice_reminders_opt_out boolean not null default false;

create table if not exists public.invoice_reminder_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete cascade,
  kind text not null check (kind in ('invoice_sent','due_soon','overdue_1','overdue_2','overdue_3','estimate_sent','payment_receipt')),
  email_address text not null,
  status text not null default 'sent' check (status in ('sent','failed')),
  error text,
  provider_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists invoice_reminder_log_once on public.invoice_reminder_log(invoice_id, kind)
  where status = 'sent' and kind in ('due_soon','overdue_1','overdue_2','overdue_3');
create index if not exists invoice_reminder_log_org on public.invoice_reminder_log(org_id, created_at desc);
alter table public.invoice_reminder_log enable row level security;
create policy "org members read invoice_reminder_log" on public.invoice_reminder_log for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = invoice_reminder_log.org_id and m.user_id = auth.uid()));

-- From migrations/add_customer_portal_token.sql, which had never been applied.
alter table public.customers
  add column if not exists portal_access_token text unique,
  add column if not exists portal_token_created_at timestamptz;
create index if not exists idx_customers_portal_access_token on public.customers(portal_access_token)
  where portal_access_token is not null;
