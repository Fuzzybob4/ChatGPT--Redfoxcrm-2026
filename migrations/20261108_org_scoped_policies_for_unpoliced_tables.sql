-- Applied to production 2026-11-08. Org-scoped RLS policies for tables that had RLS enabled but no policies.
create policy "org members read employee_locations" on public.employee_locations for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = employee_locations.org_id and m.user_id = auth.uid()));
create policy "org members read fleet_events" on public.fleet_events for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = fleet_events.org_id and m.user_id = auth.uid()));
create policy "org members read geofence_events" on public.geofence_events for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = geofence_events.org_id and m.user_id = auth.uid()));
create policy "org members read daily_fleet_summary" on public.daily_fleet_summary for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = daily_fleet_summary.org_id and m.user_id = auth.uid()));
create policy "org members manage vehicle_assignments" on public.vehicle_assignments for all to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = vehicle_assignments.org_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.user_memberships m where m.org_id = vehicle_assignments.org_id and m.user_id = auth.uid()));
create policy "org members manage vehicle_maintenance" on public.vehicle_maintenance for all to authenticated
  using (exists (select 1 from public.vehicles v join public.user_memberships m on m.org_id = v.org_id where v.id = vehicle_maintenance.vehicle_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.vehicles v join public.user_memberships m on m.org_id = v.org_id where v.id = vehicle_maintenance.vehicle_id and m.user_id = auth.uid()));
create policy "org members read custom_field_definitions" on public.custom_field_definitions for select to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = custom_field_definitions.org_id and m.user_id = auth.uid()));
create policy "org admins manage custom_field_definitions" on public.custom_field_definitions for all to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = custom_field_definitions.org_id and m.user_id = auth.uid() and m.role in ('owner','admin')))
  with check (exists (select 1 from public.user_memberships m where m.org_id = custom_field_definitions.org_id and m.user_id = auth.uid() and m.role in ('owner','admin')));
create policy "org members manage custom_field_values" on public.custom_field_values for all to authenticated
  using (exists (select 1 from public.user_memberships m where m.org_id = custom_field_values.org_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.user_memberships m where m.org_id = custom_field_values.org_id and m.user_id = auth.uid()));
create policy "org members manage comment_attachments" on public.comment_attachments for all to authenticated
  using (exists (select 1 from public.comments c join public.user_memberships m on m.org_id = c.org_id where c.id = comment_attachments.comment_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.comments c join public.user_memberships m on m.org_id = c.org_id where c.id = comment_attachments.comment_id and m.user_id = auth.uid()));
create policy "org members read opportunity_history" on public.opportunity_history for select to authenticated
  using (exists (select 1 from public.opportunities o join public.user_memberships m on m.org_id = o.org_id where o.id = opportunity_history.opportunity_id and m.user_id = auth.uid()));
-- Server-only (deny-all intentional): admin_audit_log, stripe_webhook_events, newsletter_subscribers, customer_portal_reset_tokens
