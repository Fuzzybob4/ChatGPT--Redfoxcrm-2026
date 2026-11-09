-- Crew scheduling: crews with a daily job limit, work days, rain days, and a
-- move log (powers "who moved" lists and rain-day undo).

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  daily_capacity numeric not null default 3 check (daily_capacity > 0 and daily_capacity <= 20),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index if not exists crews_org_idx on public.crews(org_id);

create table if not exists public.schedule_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  work_days int[] not null default '{1,2,3,4,5,6}', -- 0 = Sunday … 6 = Saturday
  notify_customers_on_move boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_days_off (
  org_id uuid not null references public.organizations(id) on delete cascade,
  day date not null,
  reason text not null default 'rain',
  created_at timestamptz not null default now(),
  primary key (org_id, day)
);

create table if not exists public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null,
  job_id uuid not null references public.scheduled_jobs(id) on delete cascade,
  customer_id uuid,
  from_date date,
  to_date date,
  reason text not null default 'rain',
  notified_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists schedule_changes_org_batch_idx on public.schedule_changes(org_id, batch_id);

alter table public.scheduled_jobs
  add column if not exists job_size text not null default 'standard' check (job_size in ('small','standard','large')),
  add column if not exists crew_id uuid references public.crews(id) on delete set null;
create index if not exists scheduled_jobs_org_date_idx on public.scheduled_jobs(org_id, scheduled_date);

alter table public.crews enable row level security;
alter table public.schedule_settings enable row level security;
alter table public.schedule_days_off enable row level security;
alter table public.schedule_changes enable row level security;

create policy "org members manage crews" on public.crews for all to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = crews.org_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.user_memberships m where m.org_id = crews.org_id and m.user_id = auth.uid()));
create policy "org members read schedule_settings" on public.schedule_settings for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = schedule_settings.org_id and m.user_id = auth.uid()));
create policy "org members read schedule_days_off" on public.schedule_days_off for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = schedule_days_off.org_id and m.user_id = auth.uid()));
create policy "org members read schedule_changes" on public.schedule_changes for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = schedule_changes.org_id and m.user_id = auth.uid()));

-- Every org starts with one crew so scheduling works out of the box; existing
-- crew names on jobs and employees become real crews.
insert into public.crews (org_id, name)
select distinct org_id, trim(crew_name) from public.scheduled_jobs where coalesce(trim(crew_name), '') <> ''
union
select distinct org_id, trim(crew_name) from public.employees where coalesce(trim(crew_name), '') <> ''
on conflict do nothing;
update public.scheduled_jobs j set crew_id = c.id from public.crews c
  where c.org_id = j.org_id and c.name = trim(j.crew_name) and j.crew_id is null;
