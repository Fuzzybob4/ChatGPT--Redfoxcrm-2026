-- Applied to production 2026-11-08. Keeps a 'no-address' tag in sync on customers.
create or replace function public.customers_sync_no_address_tag()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(btrim(new.address), '') = '' and coalesce(btrim(new.address1), '') = '' then
    if not ('no-address' = any(coalesce(new.tags, '{}'))) then
      new.tags := array_append(coalesce(new.tags, '{}'), 'no-address');
    end if;
  else
    new.tags := array_remove(coalesce(new.tags, '{}'), 'no-address');
  end if;
  return new;
end;
$$;
drop trigger if exists customers_no_address_tag on public.customers;
create trigger customers_no_address_tag
  before insert or update of address, address1, tags on public.customers
  for each row execute function public.customers_sync_no_address_tag();
revoke execute on function public.customers_sync_no_address_tag() from public, anon, authenticated;
