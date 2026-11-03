import { notFound } from "next/navigation";
import { getAccessibleJob, getFieldContext } from "@/lib/field";
import { getCrewOptions } from "@/lib/field-homes";
import { NotAllowed, WorkOrderForm } from "@/components/field/work-order-form";

const toHHMM = (t: string | null) => (t ? t.slice(0, 5) : "");

export default async function EditFieldWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, employee, canManageWorkOrders } = await getFieldContext();
  if (!canManageWorkOrders) return <NotAllowed />;

  const [access, crew] = await Promise.all([
    getAccessibleJob(org.orgId, employee?.id ?? null, org.role, id, true),
    getCrewOptions(org.orgId),
  ]);
  if (!access) notFound();
  const { job, raw } = access;

  const rawType = String(raw.job_type ?? "install").toLowerCase();
  const jobType = rawType.includes("remov") ? "removal" : rawType.includes("service") || rawType.includes("repair") ? "service" : "install";

  return (
    <WorkOrderForm
      mode="edit"
      jobId={job.id}
      customerName={job.customerName}
      address={job.address}
      crew={crew}
      cancellable={job.status === "scheduled" || job.status === "en_route"}
      initial={{
        jobType,
        scheduledDate: job.scheduledDate,
        startTime: toHHMM(job.startTime) || "09:00",
        endTime: toHHMM(job.endTime) || "12:00",
        assignedEmployees: Array.isArray(raw.assigned_employees) ? raw.assigned_employees : [],
        notes: raw.notes ?? "",
      }}
    />
  );
}
