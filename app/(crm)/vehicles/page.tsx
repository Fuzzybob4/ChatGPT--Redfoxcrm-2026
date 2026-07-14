import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { VehiclesList } from "@/components/vehicles/vehicles-list";

export const metadata = {
  title: "Fleet Management - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select(
      "id, name, make_model, license_plate, year, color, mileage, status, location_id, created_at"
    )
    .order("created_at", { ascending: true });

  const { data: assignments } = await supabase
    .from("vehicle_assignments")
    .select("vehicle_id, employee_id, assigned_at, unassigned_at")
    .is("unassigned_at", null);

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name");

  const employeeMap = Object.fromEntries(
    (employees ?? []).map((e) => [e.id, e.full_name])
  );

  const assignmentMap = Object.fromEntries(
    (assignments ?? []).map((a) => [a.vehicle_id, a.employee_id])
  );

  const vehiclesList = (vehicles ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    makeModel: v.make_model || "Unknown",
    licensePlate: v.license_plate || "—",
    year: v.year,
    color: v.color,
    mileage: v.mileage || 0,
    status: v.status,
    locationId: v.location_id,
    assignedTo: assignmentMap[v.id] ? employeeMap[assignmentMap[v.id]] : null,
  }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Fleet Management"
        description="Manage vehicles, track maintenance, and assign to crew members."
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <VehiclesList vehicles={vehiclesList} />
      </div>
    </div>
  );
}
