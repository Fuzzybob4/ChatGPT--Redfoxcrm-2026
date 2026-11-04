import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";

export interface FieldEmployee {
  id: string;
  name: string;
  locationId: string | null;
  /** Crew leads (or anyone granted work-order access) can see every home and manage work orders. */
  canManageWorkOrders: boolean;
}

export const OFFICE_ROLES = ["owner", "admin", "manager"];

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
    .select("id, full_name, first_name, last_name, email, role, position, can_access_work_orders, location_id")
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
        locationId: employee.location_id ?? null,
        canManageWorkOrders:
          employee.role === "crew_lead" ||
          employee.can_access_work_orders === true ||
          /\blead\b/i.test(employee.position ?? ""),
      }
    : null;

  const canManageWorkOrders = OFFICE_ROLES.includes(org.role) || Boolean(fieldEmployee?.canManageWorkOrders);

  /** Editing or cancelling an existing work order is reserved for the owner and office managers. */
  const canEditWorkOrders = OFFICE_ROLES.includes(org.role);

  return { org, employee: fieldEmployee, admin, canManageWorkOrders, canEditWorkOrders };
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
  canManageWorkOrders = false,
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
  const office = OFFICE_ROLES.includes(role) || canManageWorkOrders;
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

export interface FieldMapStop {
  job: FieldJob;
  lat: number;
  lng: number;
}

export interface FieldCustomer {
  id: string;
  name: string;
  phone: string;
  address: string;
  nextJob: FieldJob | null;
  lastJob: FieldJob | null;
}

/** Pin each assigned job to its property, or the customer's primary property when none is set. */
export async function getAssignedMapStops(jobs: FieldJob[]): Promise<FieldMapStop[]> {
  const customerIds = Array.from(new Set(jobs.map((j) => j.customerId).filter(Boolean))) as string[];
  if (customerIds.length === 0) return [];

  const admin = createAdminClient();
  const [{ data: properties }, { data: customers }] = await Promise.all([
    admin
      .from("customer_properties")
      .select("id, customer_id, is_primary, lat, lng")
      .in("customer_id", customerIds)
      .not("lat", "is", null)
      .not("lng", "is", null),
    admin.from("customers").select("id, lat, lng").in("id", customerIds).not("lat", "is", null).not("lng", "is", null),
  ]);

  const byId = new Map((properties ?? []).map((p) => [p.id, p]));
  const primaryByCustomer = new Map<string, { lat: number; lng: number }>();
  for (const c of customers ?? []) primaryByCustomer.set(c.id, c);
  const seenProperty = new Set<string>();
  for (const p of properties ?? []) {
    if (p.is_primary || !seenProperty.has(p.customer_id)) primaryByCustomer.set(p.customer_id, p);
    seenProperty.add(p.customer_id);
  }

  return jobs.flatMap((job) => {
    const point = (job.propertyId && byId.get(job.propertyId)) || (job.customerId && primaryByCustomer.get(job.customerId));
    if (!point) return [];
    return [{ job, lat: Number(point.lat), lng: Number(point.lng) }];
  });
}

/** Customers this employee has been assigned to, with their next and most recent visit. */
export async function getAssignedCustomers(orgId: string, employeeId: string): Promise<FieldCustomer[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("scheduled_jobs")
    .select(JOB_COLUMNS)
    .eq("org_id", orgId)
    .contains("assigned_employees", [employeeId])
    .neq("status", "cancelled")
    .not("customer_id", "is", null)
    .order("scheduled_date", { ascending: true })
    .limit(300);

  const today = new Date().toISOString().slice(0, 10);
  const customers = new Map<string, FieldCustomer>();
  for (const row of data ?? []) {
    const job = toFieldJob(row);
    const id = job.customerId as string;
    const entry =
      customers.get(id) ??
      { id, name: job.customerName, phone: job.customerPhone, address: job.address, nextJob: null, lastJob: null };
    if (isOpenStatus(job.status) && job.scheduledDate >= today) {
      entry.nextJob ??= job;
    } else {
      entry.lastJob = job;
    }
    if (!entry.address && job.address) entry.address = job.address;
    customers.set(id, entry);
  }

  return Array.from(customers.values()).sort((a, b) => {
    const ad = a.nextJob?.scheduledDate ?? "9999";
    const bd = b.nextJob?.scheduledDate ?? "9999";
    return ad === bd ? a.name.localeCompare(b.name) : ad.localeCompare(bd);
  });
}

export function isOpenStatus(status: string): boolean {
  return ["scheduled", "en_route", "in_progress"].includes(status);
}
