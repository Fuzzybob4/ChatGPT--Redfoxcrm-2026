-- Track which version of the Terms / Privacy Policy each business accepted.
alter table public.organizations
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_accepted_by uuid;
create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip text,
  user_agent text
);
alter table public.terms_acceptances enable row level security;
create policy terms_acceptances_select_own_org on public.terms_acceptances for select
  using (org_id in (select org_id from public.user_memberships where user_id = auth.uid()));
