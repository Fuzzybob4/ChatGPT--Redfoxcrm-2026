-- Applied to production 2026-11-08. Removes public/anon/authenticated EXECUTE on
-- SECURITY DEFINER functions that let any caller grant platform admin, join any org,
-- or read any org's business profile. service_role keeps access.
revoke execute on function public.add_platform_admin_by_email(text) from public, anon, authenticated;
revoke execute on function public.get_business_profile_for_super_admin(uuid) from public, anon, authenticated;
revoke execute on function public.provision_user_organization(uuid) from public, anon, authenticated;
revoke execute on function public.invite_user(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_team_invitation(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.add_platform_admin_by_email(text) to service_role;
grant execute on function public.get_business_profile_for_super_admin(uuid) to service_role;
grant execute on function public.provision_user_organization(uuid) to service_role;
grant execute on function public.invite_user(uuid, text, text) to service_role;
grant execute on function public.create_team_invitation(uuid, text, text, uuid) to service_role;
