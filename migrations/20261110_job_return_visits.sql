-- Crew can stop a job that needs a return visit.
alter table public.scheduled_jobs
  add column if not exists return_reason text,
  add column if not exists return_requested_at timestamptz;
