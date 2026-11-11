-- Per-business rules that used to be hard-coded for Lone Star.
alter table public.schedule_settings
  add column if not exists timezone text not null default 'America/Chicago',
  add column if not exists season_start_month smallint not null default 5 check (season_start_month between 1 and 12),
  add column if not exists season_start_day smallint not null default 1 check (season_start_day between 1 and 28),
  add column if not exists day_slots jsonb not null default '[["08:00","11:00"],["11:00","14:00"],["14:00","17:00"]]'::jsonb,
  add column if not exists job_size_points jsonb not null default '{"small":0.75,"standard":1,"large":1.5}'::jsonb,
  add column if not exists crew_hide_prices boolean not null default true;
