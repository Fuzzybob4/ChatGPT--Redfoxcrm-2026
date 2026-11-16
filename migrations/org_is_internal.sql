alter table public.organizations add column if not exists is_internal boolean not null default false;
-- RedFox's own/test orgs are left out of admin metrics.
update public.organizations set is_internal = true where name in ('Red Fox CRM','RedFox Demo Co','__v0_verify_org','The Simple Service','Heroes of the meta');
