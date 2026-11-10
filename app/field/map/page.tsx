import { getAssignedJobs, getAssignedMapStops, getFieldContext } from "@/lib/field";
import { FieldMap } from "@/components/field/field-map";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";

/** The crew member's own stops (their jobs and their crew's), today first. */
export default async function FieldMapPage() {
  const { org, employee } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const jobs = (await getAssignedJobs(org.orgId, employee.id)).filter((j) => j.status !== "completed");
  const stops = await getAssignedMapStops(jobs);
  return <FieldMap stops={stops} unmappedCount={jobs.length - stops.length} />;
}
