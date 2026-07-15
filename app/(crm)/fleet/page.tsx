'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { useOrgContext } from '@/lib/org-context';
import { FleetMap } from '@/components/fleet/fleet-map';
import { FleetSidebar } from '@/components/fleet/fleet-sidebar';
import { Card } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Employee {
  employee_id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  speed_mps: number | null;
  heading_degrees: number | null;
  last_update: string;
  work_order: {
    id: string;
    title: string;
    status: string;
    customer: string;
    address: string;
  } | null;
  vehicle_id?: string;
}

export default function FleetPage() {
  const org = useOrgContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Poll fleet snapshot every 5 seconds
  useEffect(() => {
    const fetchFleetSnapshot = async () => {
      try {
        const response = await fetch(
          `/api/fleet/snapshot?org_id=${org.orgId}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();
        setEmployees(data.employees || []);
        setLastUpdate(new Date());
        setError(null);

        // Update selected employee if it's in the new data
        if (selectedEmployee) {
          const updated = data.employees?.find(
            (e: Employee) => e.employee_id === selectedEmployee.employee_id
          );
          if (updated) setSelectedEmployee(updated);
        }
      } catch (err) {
        console.error('[fleet] Snapshot error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch fleet data');
      } finally {
        setLoading(false);
      }
    };

    fetchFleetSnapshot();
    const interval = setInterval(fetchFleetSnapshot, 5000);
    return () => clearInterval(interval);
  }, [org.orgId, selectedEmployee]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Fleet Tracking"
        description="Real-time GPS tracking of your crew members and vehicles"
      />

      <div className="flex-1 min-h-0 flex gap-4 p-4 lg:p-6">
        {/* Main map area */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {error && (
            <Card className="bg-destructive/10 border-destructive/20 p-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            </Card>
          )}

          <div className="flex-1 min-h-0 rounded-lg border bg-muted overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <RefreshCw className="size-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading fleet data...</p>
                </div>
              </div>
            ) : (
              <FleetMap
                employees={employees}
                selectedEmployee={selectedEmployee}
                onSelectEmployee={setSelectedEmployee}
              />
            )}
          </div>

          {lastUpdate && (
            <p className="text-xs text-muted-foreground text-right">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Sidebar with employee list and details */}
        <div className="w-72 flex flex-col gap-4">
          <FleetSidebar
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={setSelectedEmployee}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
