-- A crew member can work with a different crew for one day ("Working with Crew B today").
alter table public.employees
  add column if not exists helping_crew_id uuid references public.crews(id) on delete set null,
  add column if not exists helping_date date;
