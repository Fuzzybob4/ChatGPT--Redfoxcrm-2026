begin;

-- Durable Stripe webhook idempotency. Only server-side service-role code may
-- access this table; no browser policies are intentionally defined.
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  stripe_account_id text,
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from anon, authenticated;
grant select, insert, update on table public.stripe_webhook_events to service_role;

create unique index if not exists payments_provider_payment_id_unique
  on public.payments (provider_payment_id)
  where provider_payment_id is not null;

-- The public schema is exposed through the Data API. Enabling RLS closes the
-- current unrestricted access. Tables without policies remain server-only.
alter table public.customer_portal_tokens enable row level security;
alter table public.customer_portal_users enable row level security;
alter table public.opportunity_history enable row level security;
alter table public.comment_attachments enable row level security;
alter table public.invoice_addon_products enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.employee_locations enable row level security;
alter table public.fleet_events enable row level security;
alter table public.daily_fleet_summary enable row level security;
alter table public.geofence_events enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Remove legacy policies that exposed portal tokens/password hashes to every
-- caller or authorized any signed-in user without checking organization.
drop policy if exists "Customers can view their portal tokens" on public.customer_portal_tokens;
drop policy if exists "Org staff can create portal tokens" on public.customer_portal_tokens;
drop policy if exists "Org staff can update portal tokens" on public.customer_portal_tokens;
drop policy if exists customer_portal_select_allow_service_role on public.customer_portal_tokens;
drop policy if exists "Portal users can be created" on public.customer_portal_users;
drop policy if exists "Users can access own portal account" on public.customer_portal_users;
drop policy if exists "Users can update own password" on public.customer_portal_users;

-- Business staff may manage only portal records belonging to their own org.
create policy customer_portal_tokens_org_members_select
on public.customer_portal_tokens for select to authenticated
using (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = customer_portal_tokens.org_id
));

create policy customer_portal_tokens_org_admin_write
on public.customer_portal_tokens for all to authenticated
using (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = customer_portal_tokens.org_id
    and membership.role in ('owner', 'admin')
))
with check (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = customer_portal_tokens.org_id
    and membership.role in ('owner', 'admin')
));

-- Keep the existing tenant-aware portal-user policies, but scope them to the
-- authenticated role instead of PUBLIC.
alter policy "cpu read for org members" on public.customer_portal_users to authenticated;
alter policy "cpu write for org owners/admin" on public.customer_portal_users to authenticated;

-- Invoice add-ons are part of the launch path and need normal org isolation.
create policy invoice_addon_products_org_read
on public.invoice_addon_products for select to authenticated
using (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = invoice_addon_products.org_id
));

create policy invoice_addon_products_org_write
on public.invoice_addon_products for all to authenticated
using (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = invoice_addon_products.org_id
))
with check (exists (
  select 1 from public.user_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.org_id = invoice_addon_products.org_id
));

-- Views in an exposed schema must execute with the caller's permissions so
-- their underlying tenant RLS remains effective.
alter view if exists public.user_org_roles set (security_invoker = true);
alter view if exists public.sales_pipeline_summary set (security_invoker = true);
alter view if exists public.customer_metrics_summary set (security_invoker = true);
alter view if exists public.activity_summary set (security_invoker = true);
alter view if exists public.task_summary set (security_invoker = true);

commit;
