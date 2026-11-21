-- Applied 2026-11-21: crew time-fix requests, job load-out checklist, auto-ended flag.
create table if not exists public.time_fix_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  day date not null,
  start_time text not null,
  end_time text,
  lunch_start text,
  lunch_end text,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists time_fix_requests_org_status on public.time_fix_requests (org_id, status);
alter table public.time_fix_requests enable row level security;
alter table public.scheduled_jobs add column if not exists materials_checked jsonb not null default '{}'::jsonb;
alter table public.time_entries add column if not exists auto_ended boolean not null default false;
