-- Applied to production 2026-11-08.
alter table public.org_integrations add column if not exists sync_started_at timestamptz;
