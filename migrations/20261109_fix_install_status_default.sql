-- install_status defaulted to 'pending_install', which the pipeline treats as a
-- deliberate "pending install" marker, so every imported contact showed as a
-- pending install. New customers now start blank (stage comes from invoices/jobs),
-- and the column allows the manual dispositions the app offers.
create table if not exists public._backup_install_status_20261109 as
  select id, org_id, install_status from public.customers where install_status = 'pending_install';
alter table public._backup_install_status_20261109 enable row level security;

alter table public.customers alter column install_status drop default;
alter table public.customers alter column install_status drop not null;
alter table public.customers drop constraint if exists customers_install_status_check;
alter table public.customers add constraint customers_install_status_check check (
  install_status is null or install_status in ('pending_install','installed','pending_removal','removed','on_hold','not_interested','lost')
);

update public.customers c set install_status = null
where c.install_status = 'pending_install'
  and not exists (
    select 1 from public.invoices i
    where i.customer_id = c.id
      and (i.status = 'paid' or i.payment_state in ('paid','partially_paid') or coalesce(i.amount_paid,0) > 0)
  )
  and not exists (select 1 from public.scheduled_jobs j where j.customer_id = c.id);
