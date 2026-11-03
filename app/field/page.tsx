import Link from "next/link";
import { getAssignedJobs, getFieldContext, getOpenTimeEntry } from "@/lib/field";
import { FieldJobList } from "@/components/field/field-job-list";

export default async function FieldHomePage() {
  const { org, employee } = await getFieldContext();

  if (!employee) {
    const isOffice = ["owner", "admin", "manager"].includes(org.role);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground text-balance">No employee profile linked</h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          {isOffice
            ? "The field app shows jobs assigned to an employee. Add yourself on the Crew page with this login's email to try it."
            : "Ask the office to send a login invite to your email address on the Crew page."}
        </p>
        {isOffice && (
          <Link
            href="/crew"
            className="mt-2 flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Go to Crew
          </Link>
        )}
      </div>
    );
  }

  const [jobs, openEntry] = await Promise.all([
    getAssignedJobs(org.orgId, employee.id),
    getOpenTimeEntry(employee.id),
  ]);

  return <FieldJobList jobs={jobs} openEntry={openEntry} firstName={employee.name.split(" ")[0]} />;
}
