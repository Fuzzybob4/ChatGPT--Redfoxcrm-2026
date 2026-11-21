import { getAssignedJobs, getDayStatus, getFieldContext, getJobBadges, jobsForViewer, getOpenTimeEntry } from "@/lib/field";
import { FieldJobList } from "@/components/field/field-job-list";
import { NoEmployeeProfile } from "@/components/field/no-employee-profile";
import { DayClock } from "@/components/field/day-clock";
import { CrewSwitcher } from "@/components/field/crew-switcher";

export default async function FieldHomePage() {
  const { org, employee, canRunJobs, admin } = await getFieldContext();
  if (!employee) return <NoEmployeeProfile role={org.role} />;

  const [allJobs, openEntry, shift] = await Promise.all([
    getAssignedJobs(org.orgId, employee.id),
    getOpenTimeEntry(employee.id),
    getDayStatus(org.orgId, employee.id),
  ]);
  // Worked today, clocked out and not at lunch: the day is over for them.
  const dayDone = !shift.since && !shift.lunchSince && shift.workedBeforeMs > 0 && !openEntry;
  const jobs = await jobsForViewer(org.orgId, allJobs, canRunJobs, openEntry?.jobId ?? null, dayDone);
  const badges = await getJobBadges(org.orgId, jobs).catch(() => ({}));
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { today } = await loadBusinessRules(admin, org.orgId);
  const hasJobsToday = allJobs.some((j) => j.scheduledDate === today && j.status !== "cancelled" && j.status !== "completed");
  const { data: crews } = await admin.from("crews").select("id, name").eq("org_id", org.orgId).eq("active", true).order("name");

  return (
    <>
      <div className="flex flex-col gap-2 px-4 pt-4">
        {employee.trackTime !== false && (
          <DayClock since={shift.since} lunchSince={shift.lunchSince} workedBeforeMs={shift.workedBeforeMs} hasJobsToday={hasJobsToday} dayDone={dayDone} forCrew={canRunJobs && Boolean(employee.crewId)} />
        )}
        {(crews ?? []).length > 1 && (
          <CrewSwitcher crews={crews ?? []} currentCrewId={employee.crewId} homeCrewId={employee.homeCrewId ?? null} />
        )}
      </div>
      <FieldJobList dayDone={dayDone} badges={badges} jobs={jobs} openEntry={openEntry} firstName={employee.name.split(" ")[0]} />
    </>
  );
}
