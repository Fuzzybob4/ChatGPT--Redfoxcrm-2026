-- Owners and salaried people can be excluded from time tracking.
alter table public.employees add column if not exists track_time boolean not null default true;

create or replace function public.skip_untracked_time_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.employees e where e.id = new.employee_id and e.track_time = false) then
    return null; -- owner / salaried: no time recorded
  end if;
  return new;
end $$;
drop trigger if exists skip_untracked_time_entry on public.time_entries;
create trigger skip_untracked_time_entry before insert on public.time_entries
for each row execute function public.skip_untracked_time_entry();
revoke execute on function public.skip_untracked_time_entry() from anon, authenticated;
