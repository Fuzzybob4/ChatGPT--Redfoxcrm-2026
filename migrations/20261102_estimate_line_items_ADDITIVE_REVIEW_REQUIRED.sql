-- ⚠️ ADDITIVE MIGRATION — REVIEW BEFORE APPLYING. NOT APPLIED BY THIS DIFF.
--
-- Why: app/(crm)/estimates/actions.ts (createEstimate) saves real line items,
-- tax and discount. The repo has no CREATE TABLE for `estimates` or any
-- estimate line-items table (none in migrations/, scripts/, or git history),
-- and no code reads or writes `estimate_line_items`. Evidence for existing
-- `estimates` columns comes only from code that reads them:
--   lib/db/mappers.ts mapEstimate: id, estimate_number, customer_id,
--     location_id, status, created_at, valid_until, title, description, notes,
--     total_amount, subtotal
--   app/(crm)/invoices/actions.ts: org_id; app/(crm)/reports/page.tsx: title,
--     estimate_number, total_amount
-- Not evidenced anywhere (added below, IF NOT EXISTS so it is harmless if they
-- already exist): estimates.tax_rate, estimates.tax_amount,
-- estimates.discount_amount, and the estimate_line_items table.
--
-- Everything here is additive (IF NOT EXISTS / no drops / no data changes).
-- Check the live schema first (e.g. information_schema.columns for
-- 'estimates') and apply in Supabase before deploying createEstimate.

alter table public.estimates add column if not exists tax_rate numeric(5, 2) not null default 0;
alter table public.estimates add column if not exists tax_amount numeric(12, 2) not null default 0;
alter table public.estimates add column if not exists discount_amount numeric(12, 2) not null default 0;

create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_estimate_line_items_estimate on public.estimate_line_items(estimate_id);
create index if not exists idx_estimate_line_items_org on public.estimate_line_items(org_id);

alter table public.estimate_line_items enable row level security;

-- Same org-membership pattern as invoice_addon_products in
-- migrations/20260820_mvp_production_security.sql.
drop policy if exists estimate_line_items_org_read on public.estimate_line_items;
create policy estimate_line_items_org_read
on public.estimate_line_items for select to authenticated
using (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = estimate_line_items.org_id
));

drop policy if exists estimate_line_items_org_write on public.estimate_line_items;
create policy estimate_line_items_org_write
on public.estimate_line_items for all to authenticated
using (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = estimate_line_items.org_id
))
with check (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = estimate_line_items.org_id
));
