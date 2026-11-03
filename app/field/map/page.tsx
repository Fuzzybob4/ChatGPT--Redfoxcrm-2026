import { getAssignedJobs, getAssignedMapStops, getFieldContext, isOpenStatus } from "@/lib/field";
import { FieldMap } from "@/components/field/field-map";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";

export default async function FieldMapPage() {
  const { org, employee } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const jobs = (await getAssignedJobs(org.orgId, employee.id)).filter((j) => isOpenStatus(j.status));
  const stops = await getAssignedMapStops(jobs);

  return <FieldMap stops={stops} unmappedCount={jobs.length - stops.length} />;
}
