-- Contact preferences: a customer can ask not to be contacted for marketing.
-- do_not_contact = no promotional calls, texts or emails at all.
-- marketing_unsubscribed (email) and sms_opt_out (text) already exist.
alter table public.customers
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists do_not_contact_reason text;

create index if not exists customers_org_do_not_contact_idx
  on public.customers (org_id) where do_not_contact;

update public.customers set sms_opt_out = false where sms_opt_out is null;
