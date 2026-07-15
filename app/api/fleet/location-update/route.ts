import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const locationUpdateSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  org_id: z.string().uuid('Invalid organization ID'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_meters: z.number().positive().optional(),
  speed_mps: z.number().nonnegative().optional(),
  heading_degrees: z.number().min(0).max(360).optional(),
  work_order_id: z.string().uuid('Invalid work order ID').optional(),
});

type LocationUpdate = z.infer<typeof locationUpdateSchema>;

/**
 * POST /api/fleet/location-update
 * 
 * Receives GPS location updates from mobile app every 30-60 seconds while employee is clocked in.
 * Stores location, detects geofence events, and updates work order status if near customer.
 * 
 * Expected from mobile app with auth header
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const locationData = locationUpdateSchema.parse(body);

    const supabase = createAdminClient();

    // Store the location update
    const { data: location, error: insertError } = await supabase
      .from('employee_locations')
      .insert({
        org_id: locationData.org_id,
        employee_id: locationData.employee_id,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy_meters: locationData.accuracy_meters,
        speed_mps: locationData.speed_mps,
        heading_degrees: locationData.heading_degrees,
        work_order_id: locationData.work_order_id,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[fleet-api] Failed to store location:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store location' }),
        { status: 500 }
      );
    }

    // Check for geofence events if work order is assigned
    if (locationData.work_order_id) {
      await checkGeofenceEvents(
        supabase,
        locationData.org_id,
        locationData.employee_id,
        locationData.work_order_id,
        locationData.latitude,
        locationData.longitude
      );
    }

    return new Response(
      JSON.stringify({ success: true, location_id: location.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: error.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.error('[fleet-api] Location update error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}

/**
 * Check if the employee is within 50m of the work order location
 * Trigger arrival/departure events and update work order status
 */
async function checkGeofenceEvents(
  supabase: ReturnType<typeof createAdminClient>,
  org_id: string,
  employee_id: string,
  work_order_id: string,
  latitude: number,
  longitude: number
) {
  try {
    // Get work order with customer location
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('id, customer_id, status, location')
      .eq('id', work_order_id)
      .single();

    if (woError || !workOrder) {
      console.error('[fleet-api] Work order not found:', woError);
      return;
    }

    // Get customer location (latitude/longitude stored in JSON)
    const customerLat = workOrder.location?.latitude;
    const customerLng = workOrder.location?.longitude;

    if (!customerLat || !customerLng) {
      console.error('[fleet-api] Customer location not available');
      return;
    }

    // Calculate distance using haversine formula
    const distance = calculateDistance(latitude, longitude, customerLat, customerLng);
    const GEOFENCE_RADIUS_M = 50;

    // Check if just arrived
    if (distance <= GEOFENCE_RADIUS_M && workOrder.status === 'assigned') {
      // Employee arrived
      const { error: eventError } = await supabase
        .from('geofence_events')
        .insert({
          org_id,
          employee_id,
          work_order_id,
          event_type: 'arrived',
          latitude,
          longitude,
          distance_meters: Math.round(distance),
          occurred_at: new Date().toISOString(),
        });

      if (!eventError) {
        // Update work order status to in_progress
        await supabase
          .from('work_orders')
          .update({ status: 'in_progress' })
          .eq('id', work_order_id);

        // Log fleet event
        await supabase.from('fleet_events').insert({
          org_id,
          employee_id,
          work_order_id,
          event_type: 'arrival_detected',
          metadata: { distance_meters: Math.round(distance) },
          occurred_at: new Date().toISOString(),
        });
      }
    }

    // Check if just departed (was in progress, now far away)
    if (distance > GEOFENCE_RADIUS_M && workOrder.status === 'in_progress') {
      // Employee departed
      const { error: eventError } = await supabase
        .from('geofence_events')
        .insert({
          org_id,
          employee_id,
          work_order_id,
          event_type: 'departed',
          latitude,
          longitude,
          distance_meters: Math.round(distance),
          occurred_at: new Date().toISOString(),
        });

      if (!eventError) {
        // Update work order status to completed
        await supabase
          .from('work_orders')
          .update({ status: 'completed' })
          .eq('id', work_order_id);

        // Log fleet event
        await supabase.from('fleet_events').insert({
          org_id,
          employee_id,
          work_order_id,
          event_type: 'departure_detected',
          metadata: { distance_meters: Math.round(distance) },
          occurred_at: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('[fleet-api] Geofence check error:', error);
  }
}

/**
 * Calculate distance between two lat/lng points in meters (haversine formula)
 */
function calculateDistance(
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
