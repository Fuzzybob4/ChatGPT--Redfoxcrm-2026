-- Applied to production 2026-11-08.
create table if not exists public.integration_import_exclusions (
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('hubspot','square')),
  external_id text not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (org_id, provider, external_id)
);
alter table public.integration_import_exclusions enable row level security;
