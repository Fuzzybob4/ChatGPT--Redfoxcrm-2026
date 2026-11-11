import { getAssignedJobs, getFieldContext, jobsForViewer, getOpenShift, getOpenTimeEntry } from "@/lib/field";
import { FieldJobList } from "@/components/field/field-job-list";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";
import { DayClock } from "@/components/field/day-clock";

export default async function FieldHomePage() {
  const { org, employee, canRunJobs } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const [jobs, openEntry, shift] = await Promise.all([
    getAssignedJobs(org.orgId, employee.id).then((all) => jobsForViewer(org.orgId, all, canRunJobs)),
    getOpenTimeEntry(employee.id),
    getOpenShift(employee.id),
  ]);

  return (
    <>
      <div className="px-4 pt-4">
        <DayClock since={shift?.clockIn ?? null} forCrew={canRunJobs && Boolean(employee.crewId)} />
      </div>
      <FieldJobList jobs={jobs} openEntry={openEntry} firstName={employee.name.split(" ")[0]} />
    </>
  );
}
