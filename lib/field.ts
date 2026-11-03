import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";

export interface FieldEmployee {
  id: string;
  name: string;
}

export interface FieldJob {
  id: string;
  title: string;
  jobType: string;
  status: string;
  scheduledDate: string;
  startTime: string | null;
  endTime: string | null;
  address: string;
  notes: string;
  customerId: string | null;
  propertyId: string | null;
  customerName: string;
  customerPhone: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OpenTimeEntry {
  id: string;
  jobId: string | null;
  clockIn: string;
}

const JOB_COLUMNS =
  "id, location_id, title, job_type, status, scheduled_date, start_time, end_time, address, city, state, zip_code, notes, description, customer_id, property_id, assigned_employees, started_at, completed_at, customers(full_name, first_name, last_name, phone)";

/** Resolve the signed-in user, their business, and their employee record. */
export async function getFieldContext() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("id, full_name, first_name, last_name, email")
    .eq("org_id", org.orgId)
    .eq("user_id", org.userId)
    .maybeSingle();

  const fieldEmployee: FieldEmployee | null = employee
    ? {
        id: employee.id,
        name:
          employee.full_name?.trim() ||
          `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
          employee.email ||
          "Crew member",
      }
    : null;

  return { org, employee: fieldEmployee, admin };
}

type JobRow = Record<string, any>;

export function toFieldJob(row: JobRow): FieldJob {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  const customerName =
    customer?.full_name?.trim() ||
    `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() ||
    "Customer";
  return {
    id: row.id,
    title: row.title ?? "Job",
    jobType: row.job_type ?? "install",
    status: (row.status ?? "scheduled").toLowerCase().replace(/\s+/g, "_"),
    scheduledDate: row.scheduled_date ?? "",
    startTime: row.start_time ?? null,
    endTime: row.end_time ?? null,
    address: [row.address, row.city, row.state, row.zip_code].filter(Boolean).join(", "),
    notes: [row.description, row.notes].filter(Boolean).join("\n\n"),
    customerId: row.customer_id ?? null,
    propertyId: row.property_id ?? null,
    customerName,
    customerPhone: customer?.phone ?? "",
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Jobs assigned to this employee: anything in progress plus recent and upcoming work. */
export async function getAssignedJobs(orgId: string, employeeId: string): Promise<FieldJob[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("scheduled_jobs")
    .select(JOB_COLUMNS)
    .eq("org_id", orgId)
    .contains("assigned_employees", [employeeId])
    .neq("status", "cancelled")
    .or(`scheduled_date.gte.${daysAgo(3)},status.in.(en_route,in_progress)`)
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(100);
  return (data ?? []).map(toFieldJob);
}

/**
 * Load a job only if it is assigned to the employee (or the viewer works in
 * the office). Returns null otherwise so pages can 404 and actions can refuse.
 */
export async function getAccessibleJob(
  orgId: string,
  employeeId: string | null,
  role: string,
  jobId: string,
) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("scheduled_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;

  const assigned = employeeId != null && (data.assigned_employees ?? []).includes(employeeId);
  const office = ["owner", "admin", "manager"].includes(role);
  if (!assigned && !office) return null;

  return { job: toFieldJob(data), assigned, raw: data };
}

export async function getOpenTimeEntry(employeeId: string): Promise<OpenTimeEntry | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("time_entries")
    .select("id, scheduled_job_id, clock_in")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, jobId: data.scheduled_job_id, clockIn: data.clock_in } : null;
}

export function isOpenStatus(status: string): boolean {
  return ["scheduled", "en_route", "in_progress"].includes(status);
}
