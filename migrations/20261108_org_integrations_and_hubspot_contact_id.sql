-- Applied to production 2026-11-08.
create table if not exists public.org_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('hubspot','square')),
  status text not null default 'connected',
  external_account_id text,
  external_account_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  connected_by uuid,
  last_sync_at timestamptz,
  last_sync_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);
alter table public.org_integrations enable row level security;
comment on table public.org_integrations is 'Server-only: holds OAuth tokens. Accessed via service role after app-level org checks. RLS deny-all is intentional.';
revoke all on public.org_integrations from anon, authenticated;

alter table public.customers add column if not exists hubspot_contact_id text;
create unique index if not exists customers_org_hubspot_contact_id_key
  on public.customers (org_id, hubspot_contact_id) where hubspot_contact_id is not null;
