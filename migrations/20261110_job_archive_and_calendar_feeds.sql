-- Work orders can be archived (hidden from lists, kept for history), and each
-- business gets private calendar subscription links (whole company or one crew).
alter table public.scheduled_jobs add column if not exists archived_at timestamptz;

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  token text not null unique,
  crew_id uuid references public.crews(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  revoked_at timestamptz
);
create index if not exists calendar_feeds_org_idx on public.calendar_feeds(org_id);
alter table public.calendar_feeds enable row level security;
