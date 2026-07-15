'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org-context-server';

/**
 * Fetch geofence events for a specific work order
 * Shows arrival/departure timeline for fleet tracking
 */
export async function getWorkOrderGeofenceEvents(workOrderId: string) {
  const org = await getCurrentOrg();
  if (!org) throw new Error('Organization not found');

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('geofence_events')
    .select(`
      id,
      employee_id,
      event_type,
      distance_meters,
      occurred_at,
      employees (
        id,
        first_name,
        last_name
      )
    `)
    .eq('org_id', org.orgId)
    .eq('work_order_id', workOrderId)
    .order('occurred_at', { ascending: false });

  if (error) {
    console.error('[geofence-actions] Error fetching events:', error);
    throw error;
  }

  return data?.map((event) => ({
    id: event.id,
    employeeName: `${event.employees?.first_name} ${event.employees?.last_name}`,
    eventType: event.event_type as 'arrived' | 'departed',
    distance_meters: event.distance_meters,
    occurred_at: event.occurred_at,
  }));
}

/**
 * Fetch all fleet events for a specific work order
 * Shows full timeline including state changes
 */
export async function getWorkOrderFleetEvents(workOrderId: string) {
  const org = await getCurrentOrg();
  if (!org) throw new Error('Organization not found');

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('fleet_events')
    .select(`
      id,
      employee_id,
      event_type,
      metadata,
      occurred_at,
      employees (
        id,
        first_name,
        last_name
      )
    `)
    .eq('org_id', org.orgId)
    .eq('work_order_id', workOrderId)
    .order('occurred_at', { ascending: false });

  if (error) {
    console.error('[geofence-actions] Error fetching fleet events:', error);
    throw error;
  }

  return data?.map((event) => ({
    id: event.id,
    employeeName: `${event.employees?.first_name} ${event.employees?.last_name}`,
    eventType: event.event_type,
    metadata: event.metadata,
    occurred_at: event.occurred_at,
  }));
}
