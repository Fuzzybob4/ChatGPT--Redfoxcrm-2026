-- Employees link to a crew record instead of a typed crew name, so the crew
-- picked on a job, on the schedule and on a team member is the same crew.
alter table public.employees add column if not exists crew_id uuid references public.crews(id) on delete set null;
create index if not exists employees_crew_idx on public.employees(crew_id);

insert into public.crews (org_id, name)
select distinct org_id, trim(crew_name) from public.employees where coalesce(trim(crew_name),'') <> ''
union
select distinct org_id, trim(crew_name) from public.scheduled_jobs where coalesce(trim(crew_name),'') <> '' and crew_name not like '%,%'
on conflict do nothing;

update public.employees e set crew_id = c.id, crew_name = c.name
from public.crews c
where c.org_id = e.org_id and lower(c.name) = lower(trim(e.crew_name)) and e.crew_id is null;

update public.scheduled_jobs j set crew_id = c.id, crew_name = c.name
from public.crews c
where c.org_id = j.org_id and lower(c.name) = lower(trim(j.crew_name)) and j.crew_id is null;
