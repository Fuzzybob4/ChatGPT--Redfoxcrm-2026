'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  MapPin,
  Clock,
  Zap,
  Gauge,
  Truck,
  CheckCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

interface FleetSidebarProps {
  employees: Employee[];
  selectedEmployee: Employee | null;
  onSelectEmployee: (employee: Employee) => void;
  loading: boolean;
}

export function FleetSidebar({
  employees,
  selectedEmployee,
  onSelectEmployee,
  loading,
}: FleetSidebarProps) {
  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'secondary' as const;
    if (status === 'in_progress') return 'default' as const;
    if (status === 'completed') return 'default' as const;
    return 'outline' as const;
  };

  const getStatusLabel = (status: string | null | undefined) => {
    if (!status) return 'Idle';
    return status === 'in_progress' ? 'Working' : status;
  };

  const getSpeedStatus = (speed: number | null) => {
    if (!speed) return { label: 'Offline', color: 'text-gray-500' };
    if (speed > 2) return { label: 'Driving', color: 'text-blue-600' };
    return { label: 'Idle', color: 'text-orange-600' };
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Selected Employee Details */}
      {selectedEmployee && (
        <Card className="border-2 border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{selectedEmployee.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedEmployee.vehicle_id
                    ? `Vehicle: ${selectedEmployee.vehicle_id.slice(0, 8)}`
                    : 'No vehicle assigned'}
                </p>
              </div>
              <Badge variant={getStatusColor(selectedEmployee.work_order?.status)}>
                {getStatusLabel(selectedEmployee.work_order?.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Phone */}
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-muted-foreground shrink-0" />
              <a
                href={`tel:${selectedEmployee.phone}`}
                className="text-primary hover:underline"
              >
                {selectedEmployee.phone}
              </a>
            </div>

            {/* Current Job */}
            {selectedEmployee.work_order && (
              <div className="flex items-start gap-2 text-sm p-2 bg-muted rounded">
                <Truck className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {selectedEmployee.work_order.customer}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedEmployee.work_order.address}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedEmployee.work_order.title}
                  </p>
                </div>
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                {selectedEmployee.latitude.toFixed(6)},{' '}
                {selectedEmployee.longitude.toFixed(6)}
              </span>
            </div>

            {/* Speed */}
            <div className="flex items-center gap-2 text-sm">
              <Gauge className="size-4 text-muted-foreground shrink-0" />
              <span className={getSpeedStatus(selectedEmployee.speed_mps).color}>
                {selectedEmployee.speed_mps
                  ? `${(selectedEmployee.speed_mps * 3.6).toFixed(1)} km/h`
                  : 'No speed data'}
              </span>
            </div>

            {/* Last Update */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(selectedEmployee.last_update), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Crew Members ({employees.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-96 overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">
                No crew members online
              </p>
            ) : (
              employees.map((emp) => (
                <button
                  key={emp.employee_id}
                  onClick={() => onSelectEmployee(emp)}
                  className={`w-full text-left p-3 hover:bg-accent transition-colors ${
                    selectedEmployee?.employee_id === emp.employee_id
                      ? 'bg-accent border-l-2 border-primary'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{emp.name}</p>
                      {emp.work_order && (
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.work_order.customer}
                        </p>
                      )}
                      <p
                        className={`text-xs mt-1 ${getSpeedStatus(emp.speed_mps).color}`}
                      >
                        {getSpeedStatus(emp.speed_mps).label}
                      </p>
                    </div>
                    {emp.work_order && (
                      <Badge variant={getStatusColor(emp.work_order.status)}>
                        {getStatusLabel(emp.work_order.status)}
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
