alter table public.estimates
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists view_count integer not null default 0,
  add column if not exists last_viewed_at timestamptz;
alter table public.invoices
  add column if not exists viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0;
create or replace function public.record_invoice_views(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update invoices set view_count = coalesce(view_count, 0) + 1, viewed_at = coalesce(viewed_at, now()), last_viewed_at = now() where id = any(p_ids);
$$;
revoke all on function public.record_invoice_views(uuid[]) from public, anon, authenticated;
