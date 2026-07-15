import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleGeofenceStateChange } from '@/lib/geofence';
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
      await handleGeofenceStateChange(
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
        JSON.stringify({ error: 'Invalid request data', details: error.issues }),
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
