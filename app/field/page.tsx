import { getAssignedJobs, getFieldContext, getOpenTimeEntry } from "@/lib/field";
import { FieldJobList } from "@/components/field/field-job-list";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";

export default async function FieldHomePage() {
  const { org, employee } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const [jobs, openEntry] = await Promise.all([
    getAssignedJobs(org.orgId, employee.id),
    getOpenTimeEntry(employee.id),
  ]);

  return <FieldJobList jobs={jobs} openEntry={openEntry} firstName={employee.name.split(" ")[0]} />;
}
