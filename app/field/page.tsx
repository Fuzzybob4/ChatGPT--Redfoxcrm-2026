import { getAssignedJobs, getDayStatus, getFieldContext, jobsForViewer, getOpenTimeEntry } from "@/lib/field";
import { FieldJobList } from "@/components/field/field-job-list";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";
import { DayClock } from "@/components/field/day-clock";
import { CrewSwitcher } from "@/components/field/crew-switcher";

export default async function FieldHomePage() {
  const { org, employee, canRunJobs, admin } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const [jobs, openEntry, shift] = await Promise.all([
    getAssignedJobs(org.orgId, employee.id).then((all) => jobsForViewer(org.orgId, all, canRunJobs)),
    getOpenTimeEntry(employee.id),
    getDayStatus(org.orgId, employee.id),
  ]);
  const { data: crews } = await admin.from("crews").select("id, name").eq("org_id", org.orgId).eq("active", true).order("name");

  return (
    <>
      <div className="flex flex-col gap-2 px-4 pt-4">
        {employee.trackTime !== false && (
          <DayClock since={shift.since} lunchSince={shift.lunchSince} forCrew={canRunJobs && Boolean(employee.crewId)} />
        )}
        {(crews ?? []).length > 1 && (
          <CrewSwitcher crews={crews ?? []} currentCrewId={employee.crewId} homeCrewId={employee.homeCrewId ?? null} />
        )}
      </div>
      <FieldJobList jobs={jobs} openEntry={openEntry} firstName={employee.name.split(" ")[0]} />
    </>
  );
}
