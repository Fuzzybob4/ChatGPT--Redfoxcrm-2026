-- Tenant isolation hardening (Nov 10, 2026).
-- Found by testing as a signed-in user of a different business.

-- 1) Location scope policies were PERMISSIVE on three tables, which OR'd with
--    the org policies and let anyone (even signed-out) read rows with no
--    location. They are meant to narrow access, so make them RESTRICTIVE.
drop policy if exists location_scope_restrict on public.customer_properties;
create policy location_scope_restrict on public.customer_properties as restrictive for all
  using (user_has_location_access(location_id, (select c.org_id from public.customers c where c.id = customer_properties.customer_id)));
drop policy if exists location_scope_restrict on public.estimates;
create policy location_scope_restrict on public.estimates as restrictive for all
  using (user_has_location_access(location_id, org_id));
drop policy if exists location_scope_restrict on public.property_photos;
create policy location_scope_restrict on public.property_photos as restrictive for all
  using (user_has_location_access(location_id, org_id));

-- 2) Organizations: members (or the creator during signup) only.
drop policy if exists orgs_select_authenticated on public.organizations;
create policy orgs_select_members on public.organizations for select
  using (
    owner_user_id = auth.uid()
    or id in (select m.org_id from public.user_memberships m where m.user_id = auth.uid())
  );

-- Billing / plan / payment-account columns can only be changed by the server.
create or replace function public.guard_org_billing_columns()
returns trigger language plpgsql set search_path = public as $$
declare
  protected text[] := array[
    'plan','is_enterprise','enterprise_org_id','enterprise_upgraded_at','enterprise_stripe_session_id',
    'subscription_status','subscription_interval','subscription_current_period_end','trial_ends_at',
    'max_locations','location_count','active_addons','lifetime_access','lifetime_granted_at','lifetime_granted_by',
    'admin_plan_override','admin_notes','owner_user_id',
    'stripe_customer_id','default_payment_method_id','card_brand','card_last4',
    'stripe_account_id','stripe_account_status','stripe_onboarding_completed','stripe_charges_enabled','stripe_payouts_enabled',
    'square_access_token','square_merchant_id','quickbooks_access_token','quickbooks_refresh_token','quickbooks_token_expires_at'
  ];
  col text;
begin
  if current_user not in ('authenticated','anon') then
    return new; -- service role, postgres, migrations
  end if;
  if tg_op = 'INSERT' then
    new.subscription_status := 'trialing';
    new.trial_ends_at := least(coalesce(new.trial_ends_at, now() + interval '30 days'), now() + interval '31 days');
    new.is_enterprise := false;
    new.active_addons := '{}'::text[];
    new.lifetime_access := false;
    new.admin_plan_override := null;
    new.owner_user_id := auth.uid();
    new.stripe_account_id := null;
    new.stripe_charges_enabled := false;
    new.stripe_payouts_enabled := false;
    return new;
  end if;
  foreach col in array protected loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'Not allowed to change %', col using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_guard_org_billing_columns on public.organizations;
create trigger trg_guard_org_billing_columns before insert or update on public.organizations
  for each row execute function public.guard_org_billing_columns();

-- Subscriptions and paid add-ons are written by the server only.
drop policy if exists "Owners/Admins can update subscription" on public.subscriptions;
drop policy if exists "Users can create subscription on signup" on public.subscriptions;
drop policy if exists "addons manage for owners/admin" on public.org_addons;
drop policy if exists "Admins can manage org features" on public.org_features;

-- 3) Joining an org: only the org's creator can become its first owner.
create or replace function public.org_owned_by_me(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations o where o.id = target_org and o.owner_user_id = auth.uid());
$$;
revoke all on function public.org_owned_by_me(uuid) from public, anon;
grant execute on function public.org_owned_by_me(uuid) to authenticated;
drop policy if exists memberships_insert_first_owner on public.user_memberships;
create policy memberships_insert_first_owner on public.user_memberships for insert
  with check (user_id = auth.uid() and role = 'owner' and not org_has_members(org_id) and org_owned_by_me(org_id));

-- 4) Super-admin checks use platform_admins, never a self-editable profile field.
create or replace function public.is_super_admin(user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = is_super_admin.user_id and coalesce(pa.is_active, true));
$$;
create or replace function public.guard_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and new.role is distinct from old.role then
    raise exception 'Not allowed to change role' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Fix ambiguous column reference that made business_profiles reads error.
create or replace function public.is_my_company(org_id uuid, user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_memberships m
    where m.user_id = is_my_company.user_id and m.org_id = is_my_company.org_id
  );
$$;

-- 5) Over-broad policies.
drop policy if exists "Authenticated users can create business profiles" on public.business_profiles;
drop policy if exists admin_invites_update_policy on public.admin_invites;
create policy admin_invites_update_policy on public.admin_invites for update
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));
drop policy if exists admin_invitation_accept_policy on public.platform_admin_invitations;
create policy admin_invitation_admin_read on public.platform_admin_invitations for select
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));
drop policy if exists "Authenticated users can check platform admin status" on public.platform_admins;
create policy platform_admins_read_own on public.platform_admins for select using (user_id = auth.uid());
drop policy if exists "Authenticated users can view contact messages" on public.contact_messages;
drop policy if exists "Authenticated users can update contact messages" on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages for select
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));
create policy contact_messages_admin_update on public.contact_messages for update
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));
drop policy if exists "Employee portal users can be created" on public.employee_portal_users;
drop policy if exists "notif insert service role" on public.notification_outbox;
drop policy if exists "System can insert workflow transitions" on public.workflow_transitions;
drop policy if exists "Authenticated users can manage stripe price mappings" on public.stripe_price_map;

-- invitations: read the caller's email from the token, not auth.users.
drop policy if exists inv_select on public.invitations;
create policy inv_select on public.invitations for select using (
  is_org_admin(auth.uid(), org_id)
  or exists (select 1 from public.user_memberships um where um.user_id = auth.uid() and um.org_id = invitations.org_id)
  or lower(email) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
);

-- 6) Functions nobody should call directly over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_location_stats(uuid) from public, anon, authenticated;
revoke execute on function public.update_org_location_count() from public, anon, authenticated;
revoke execute on function public.provision_first_org(text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.redeem_invitation(uuid) from public, anon;
