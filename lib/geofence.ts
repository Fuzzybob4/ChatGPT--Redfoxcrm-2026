/**
 * Geofence detection and state management for fleet tracking
 */

import { createAdminClient } from './supabase/admin';
import { sendFleetNotification } from './fleet-notifications';

export const GEOFENCE_RADIUS_METERS = 50;

/**
 * Calculate distance between two lat/lng points in meters (haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check for geofence state changes when employee location updates
 * Handles arrival/departure detection and updates work order status
 */
export async function handleGeofenceStateChange(
  org_id: string,
  employee_id: string,
  work_order_id: string,
  latitude: number,
  longitude: number
) {
  const supabase = createAdminClient();

  try {
    // Get work order and customer location
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select(`
        id,
        customer_id,
        status,
        customers (
          id,
          address,
          latitude,
          longitude
        )
      `)
      .eq('id', work_order_id)
      .single();

    if (woError || !workOrder) {
      console.error('[geofence] Work order not found:', woError);
      return;
    }

    // Supabase returns joins as arrays; extract first element
    const customer = Array.isArray(workOrder.customers)
      ? workOrder.customers[0]
      : workOrder.customers;

    const customerLat = customer?.latitude;
    const customerLng = customer?.longitude;

    if (!customerLat || !customerLng) {
      console.error('[geofence] Customer location not available');
      return;
    }

    // Calculate distance
    const distance = calculateDistance(latitude, longitude, customerLat, customerLng);
    const isInside = distance <= GEOFENCE_RADIUS_METERS;

    // Get previous geofence events to determine state
    const { data: prevEvents } = await supabase
      .from('geofence_events')
      .select('event_type, created_at')
      .eq('org_id', org_id)
      .eq('work_order_id', work_order_id)
      .eq('employee_id', employee_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastEvent = prevEvents?.[0]?.event_type;

    // Detect state transitions
    if (isInside && lastEvent !== 'arrived') {
      // Just arrived
      await recordGeofenceEvent(
        supabase,
        org_id,
        employee_id,
        work_order_id,
        'arrived',
        latitude,
        longitude,
        Math.round(distance)
      );

      // Update work order status
      await updateWorkOrderStatus(supabase, work_order_id, 'in_progress');

      // Notify customer
      sendFleetNotification({
        orgId: org_id,
        workOrderId: work_order_id,
        employeeId: employee_id,
        eventType: 'arrived',
      }).catch((err) => console.error('[geofence] Arrival notification error:', err));

      console.log(
        `[geofence] Employee ${employee_id} arrived at job ${work_order_id}`
      );
    } else if (!isInside && lastEvent === 'arrived') {
      // Just departed
      await recordGeofenceEvent(
        supabase,
        org_id,
        employee_id,
        work_order_id,
        'departed',
        latitude,
        longitude,
        Math.round(distance)
      );

      // Update work order status
      await updateWorkOrderStatus(supabase, work_order_id, 'completed');

      // Notify customer
      sendFleetNotification({
        orgId: org_id,
        workOrderId: work_order_id,
        employeeId: employee_id,
        eventType: 'completed',
      }).catch((err) => console.error('[geofence] Completion notification error:', err));

      console.log(
        `[geofence] Employee ${employee_id} departed from job ${work_order_id}`
      );
    }
  } catch (error) {
    console.error('[geofence] State change error:', error);
  }
}

/**
 * Record a geofence event (arrival/departure)
 */
async function recordGeofenceEvent(
  supabase: ReturnType<typeof createAdminClient>,
  org_id: string,
  employee_id: string,
  work_order_id: string,
  eventType: 'arrived' | 'departed',
  latitude: number,
  longitude: number,
  distance_meters: number
) {
  const { error } = await supabase.from('geofence_events').insert({
    org_id,
    employee_id,
    work_order_id,
    event_type: eventType,
    latitude,
    longitude,
    distance_meters,
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`[geofence] Failed to record ${eventType} event:`, error);
    return;
  }

  // Also log to fleet_events for timeline
  await supabase.from('fleet_events').insert({
    org_id,
    employee_id,
    work_order_id,
    event_type: eventType === 'arrived' ? 'arrival_detected' : 'departure_detected',
    metadata: { distance_meters },
    occurred_at: new Date().toISOString(),
  });
}

/**
 * Update work order status
 */
async function updateWorkOrderStatus(
  supabase: ReturnType<typeof createAdminClient>,
  work_order_id: string,
  status: string
) {
  const { error } = await supabase
    .from('work_orders')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', work_order_id);

  if (error) {
    console.error(`[geofence] Failed to update work order status:`, error);
  }
}
