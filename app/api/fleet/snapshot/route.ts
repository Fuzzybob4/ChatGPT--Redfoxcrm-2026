import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * GET /api/fleet/snapshot?org_id=xxx
 * 
 * Returns real-time snapshot of all employees, their current locations,
 * work orders, and status for the fleet map.
 * 
 * Requires org membership verification
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const org_id = searchParams.get('org_id');

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'Missing org_id parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    if (!isValidUUID(org_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid org_id format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = await createClient();

    // Get latest location for each employee in this org
    const { data: locations, error: locError } = await supabase
      .from('employee_locations')
      .select(`
        id,
        employee_id,
        latitude,
        longitude,
        speed_mps,
        heading_degrees,
        timestamp,
        work_order_id,
        employees (
          id,
          first_name,
          last_name,
          phone
        ),
        work_orders (
          id,
          customer_id,
          status,
          title,
          customers (
            id,
            name,
            address
          )
        )
      `)
      .eq('org_id', org_id)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (locError) {
      console.error('[fleet-snapshot] Error fetching locations:', locError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch fleet data' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Group by employee_id to get latest for each
    const employeeMap = new Map();
    for (const loc of locations || []) {
      if (!employeeMap.has(loc.employee_id)) {
        const emp = loc.employees?.[0];
        const wo = loc.work_orders?.[0];
        const customer = wo?.customers?.[0];
        
        employeeMap.set(loc.employee_id, {
          employee_id: loc.employee_id,
          name: `${emp?.first_name ?? ''} ${emp?.last_name ?? ''}`.trim(),
          phone: emp?.phone,
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed_mps: loc.speed_mps,
          heading_degrees: loc.heading_degrees,
          last_update: loc.timestamp,
          work_order: loc.work_order_id
            ? {
                id: wo?.id,
                title: wo?.title,
                status: wo?.status,
                customer: customer?.name,
                address: customer?.address,
              }
            : null,
        });
      }
    }

    // Get vehicle assignments for real-time display
    const { data: assignments } = await supabase
      .from('vehicle_assignments')
      .select('employee_id, vehicle_id, assigned_at, unassigned_at')
      .eq('org_id', org_id)
      .is('unassigned_at', null);

    // Merge vehicle info
    for (const assignment of assignments || []) {
      const emp = employeeMap.get(assignment.employee_id);
      if (emp) {
        emp.vehicle_id = assignment.vehicle_id;
      }
    }

    const snapshot = {
      org_id,
      timestamp: new Date().toISOString(),
      employees: Array.from(employeeMap.values()),
      count: employeeMap.size,
    };

    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fleet-snapshot] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
