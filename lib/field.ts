import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";

export interface FieldEmployee {
  id: string;
  name: string;
  locationId: string | null;
  /** Crew leads (or anyone granted work-order access) can see every home and manage work orders. */
  canManageWorkOrders: boolean;
  /** Crew lead: runs the job (on my way, start/pause the crew's time, finish or return visit). */
  isLead: boolean;
  /** The crew they work with today (their own, or the one they're helping). */
  crewId: string | null;
  /** Their regular crew. */
  homeCrewId?: string | null;
  /** True when they picked "Working with another crew today". */
  helpingToday?: boolean;
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
  crewId: string | null;
}

export interface OpenTimeEntry {
  id: string;
  jobId: string | null;
  clockIn: string;
}

const JOB_COLUMNS =
  "id, location_id, title, job_type, status, scheduled_date, start_time, end_time, address, city, state, zip_code, notes, description, customer_id, property_id, assigned_employees, crew_id, crew_name, archived_at, started_at, completed_at, customers(full_name, first_name, last_name, phone)";

/** Resolve the signed-in user, their business, and their employee record. */
export async function getFieldContext() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("id, full_name, first_name, last_name, email, role, position, can_access_work_orders, location_id, crew_id, helping_crew_id, helping_date")
    .eq("org_id", org.orgId)
    .eq("user_id", org.userId)
    .maybeSingle();

  const today = employee?.helping_date ? await orgToday(org.orgId) : null;
  const helpingToday = Boolean(employee?.helping_crew_id && employee.helping_date === today);
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
        isLead: employee.role === "crew_lead" || /\blead\b/i.test(employee.position ?? ""),
        crewId: helpingToday ? (employee.helping_crew_id as string) : ((employee.crew_id as string | null) ?? null),
        homeCrewId: (employee.crew_id as string | null) ?? null,
        helpingToday,
      }
    : null;

  const canManageWorkOrders = OFFICE_ROLES.includes(org.role) || Boolean(fieldEmployee?.canManageWorkOrders);

  /** Editing or cancelling an existing work order is reserved for the owner and office managers. */
  const canEditWorkOrders = OFFICE_ROLES.includes(org.role);

  /** Who can run a job's clock and status: crew leads and the office. Installers just view and add photos. */
  const canRunJobs = OFFICE_ROLES.includes(org.role) || Boolean(fieldEmployee?.isLead);

  return { org, employee: fieldEmployee, admin, canManageWorkOrders, canEditWorkOrders, canRunJobs };
}

type JobRow = Record<string, any>;

/** Today's date in the business's time zone. */
async function orgToday(orgId: string): Promise<string> {
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  return (await loadBusinessRules(createAdminClient(), orgId)).today;
}

/**
 * The crew this employee works with today: their own crew, or the crew they
 * picked with "Working with ... today" (jobs on that crew are theirs too).
 */
async function crewIdOf(employeeId: string | null): Promise<string | null> {
  if (!employeeId) return null;
  const { data } = await createAdminClient()
    .from("employees")
    .select("org_id, crew_id, helping_crew_id, helping_date")
    .eq("id", employeeId)
    .maybeSingle();
  if (!data) return null;
  if (data.helping_crew_id && data.helping_date && data.helping_date === (await orgToday(data.org_id))) {
    return data.helping_crew_id as string;
  }
  return (data.crew_id as string | null) ?? null;
}

/**
 * Everyone working with a crew today: its own members (minus anyone helping
 * another crew today) plus people from other crews helping it today.
 */
export async function crewRoster(admin: any, orgId: string, crewId: string): Promise<string[]> {
  const today = await orgToday(orgId);
  const { data } = await admin
    .from("employees")
    .select("id, crew_id, helping_crew_id, helping_date")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(`crew_id.eq.${crewId},helping_crew_id.eq.${crewId}`);
  return (data ?? [])
    .filter((e: any) => {
      const helping = e.helping_crew_id && e.helping_date === today;
      return helping ? e.helping_crew_id === crewId : e.crew_id === crewId;
    })
    .map((e: any) => e.id as string);
}

/** PostgREST filter: assigned by name, or the job is on their crew. */
function mineFilter(employeeId: string, crewId: string | null) {
  return crewId ? `assigned_employees.cs.{${employeeId}},crew_id.eq.${crewId}` : `assigned_employees.cs.{${employeeId}}`;
}

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
    crewId: row.crew_id ?? null,
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Jobs for this employee (theirs or their crew's): anything in progress plus recent and upcoming work. */
export async function getAssignedJobs(orgId: string, employeeId: string): Promise<FieldJob[]> {
  const admin = createAdminClient();
  const crewId = await crewIdOf(employeeId);
  const { data } = await admin
    .from("scheduled_jobs")
    .select(JOB_COLUMNS)
    .eq("org_id", orgId)
    .or(mineFilter(employeeId, crewId))
    .is("archived_at", null)
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

  const crewId = await crewIdOf(employeeId);
  const assigned =
    employeeId != null &&
    ((data.assigned_employees ?? []).includes(employeeId) || (crewId != null && data.crew_id === crewId));
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
    .not("scheduled_job_id", "is", null)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, jobId: data.scheduled_job_id, clockIn: data.clock_in } : null;
}

/** The employee's work-day clock (time entries with no job), if it's running. */
export async function getOpenShift(employeeId: string): Promise<{ id: string; clockIn: string } | null> {
  const { data } = await createAdminClient()
    .from("time_entries")
    .select("id, clock_in")
    .eq("employee_id", employeeId)
    .is("scheduled_job_id", null)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, clockIn: data.clock_in } : null;
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

/** Customers on this employee's (or their crew's) jobs, with their next and most recent visit. */
/**
 * Which days of customers a crew member can look up: installers just today's
 * homes, crew leads today plus the coming week so they can plan ahead.
 */
async function customerWindow(orgId: string, canRunJobs: boolean) {
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { addDays } = await import("@/lib/schedule");
  const { today } = await loadBusinessRules(createAdminClient(), orgId);
  return { today, from: today, to: canRunJobs ? addDays(today, 7) : today };
}

const windowFilter = (from: string, to: string) =>
  `and(scheduled_date.gte.${from},scheduled_date.lte.${to}),status.in.(en_route,in_progress)`;

export async function getAssignedCustomers(orgId: string, employeeId: string, canRunJobs = false): Promise<FieldCustomer[]> {
  const admin = createAdminClient();
  const crewId = await crewIdOf(employeeId);
  const { today, from, to } = await customerWindow(orgId, canRunJobs);
  const { data } = await admin
    .from("scheduled_jobs")
    .select(JOB_COLUMNS)
    .eq("org_id", orgId)
    .or(mineFilter(employeeId, crewId))
    .or(windowFilter(from, to))
    .neq("status", "cancelled")
    .not("customer_id", "is", null)
    .order("scheduled_date", { ascending: true })
    .limit(300);

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

/**
 * True when this customer is on one of the employee's (or their crew's) jobs,
 * so a crew member can only open customers they are actually working for.
 */
export async function canSeeCustomer(
  orgId: string,
  employeeId: string | null,
  customerId: string,
  canRunJobs = false,
): Promise<boolean> {
  if (!employeeId) return false;
  const crewId = await crewIdOf(employeeId);
  const { from, to } = await customerWindow(orgId, canRunJobs);
  const { data } = await createAdminClient()
    .from("scheduled_jobs")
    .select("id")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .or(mineFilter(employeeId, crewId))
    .or(windowFilter(from, to))
    .neq("status", "cancelled")
    .limit(1);
  return Boolean(data?.length);
}

export interface InstallItem {
  description: string;
  quantity: number;
}

/**
 * What's being installed for a customer this season: the approved estimate's
 * chosen items, otherwise the newest invoice's items. No prices, and billing
 * lines (deposits, discounts, "Square invoice …") are left out.
 */
export async function getInstallItems(orgId: string, customerId: string): Promise<InstallItem[]> {
  const admin = createAdminClient();
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const rules = await loadBusinessRules(admin, orgId);
  const crewSafeText = await crewTextFilter(orgId, rules.crewHidePrices);
  const season = rules.seasonStart;
  const [{ data: estimates }, { data: invoices }] = await Promise.all([
    admin
      .from("estimates")
      .select("id, estimate_line_items(description, quantity, selected, line_total, sort_order)")
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .eq("status", "accepted")
      .gte("created_at", season)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("invoices")
      .select("id, invoice_line_items(description, quantity, line_total, sort_order)")
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .neq("status", "cancelled")
      .or(`created_at.gte.${season},season_year.eq.${Number(season.slice(0, 4))}`)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const sort = (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  const fromEstimate = ((estimates?.[0] as any)?.estimate_line_items ?? [])
    .filter((i: any) => i.selected !== false && Number(i.line_total ?? 0) > 0)
    .sort(sort);
  const fromInvoice = ((invoices?.[0] as any)?.invoice_line_items ?? []).sort(sort);
  return (fromEstimate.length ? fromEstimate : fromInvoice)
    .filter((i: any) => Number(i.line_total ?? 1) >= 0 && !/^(square (invoice|card|cash|payment)|discount|deposit)\b/i.test(String(i.description ?? "").trim()))
    // Item names stay; any sentence about money inside an item's note is dropped.
    .map((i: any) => ({ description: crewSafeText(i.description), quantity: Number(i.quantity ?? 1) }))
    .filter((i: InstallItem) => i.description);
}

/**
 * Text filter for crew screens. Most businesses hide money from installers
 * (Settings → Season & crews); when they don't, notes show as written.
 */
export async function crewTextFilter(orgId: string, hide?: boolean): Promise<(text: string | null | undefined) => string> {
  if (hide === undefined) {
    const { loadBusinessRules } = await import("@/lib/schedule-server");
    hide = (await loadBusinessRules(createAdminClient(), orgId)).crewHidePrices;
  }
  const { crewSafeText } = await import("@/lib/field-privacy");
  return hide ? crewSafeText : (text) => String(text ?? "").trim();
}

/**
 * Installers only see the day's work (plus anything already underway), so
 * future jobs don't confuse them. Crew leads and the office see everything.
 */
export async function jobsForViewer(orgId: string, jobs: FieldJob[], canRunJobs: boolean): Promise<FieldJob[]> {
  if (canRunJobs) return jobs;
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { today } = await loadBusinessRules(createAdminClient(), orgId);
  return jobs.filter(
    (j) => j.status === "in_progress" || j.status === "en_route" || j.scheduledDate === today,
  );
}

export interface DayStatus {
  /** Clock running since (current segment). */
  since: string | null;
  /** On lunch since (clock stopped for lunch, day not ended). */
  lunchSince: string | null;
}

/** Where the person is in their work day: on the clock, at lunch, or neither. */
export async function getDayStatus(orgId: string, employeeId: string): Promise<DayStatus> {
  const open = await getOpenShift(employeeId);
  if (open) return { since: open.clockIn, lunchSince: null };
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { timezone } = await loadBusinessRules(createAdminClient(), orgId);
  const { data } = await createAdminClient()
    .from("time_entries")
    .select("clock_out, notes")
    .eq("employee_id", employeeId)
    .is("scheduled_job_id", null)
    .not("clock_out", "is", null)
    .order("clock_out", { ascending: false })
    .limit(1)
    .maybeSingle();
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: timezone });
  if (data?.notes === "Lunch" && data.clock_out && day(data.clock_out) === day(new Date().toISOString())) {
    return { since: null, lunchSince: data.clock_out };
  }
  return { since: null, lunchSince: null };
}

export interface HoursDay {
  day: string;
  start: string | null;
  end: string | null;
  open: boolean;
  workedHours: number;
  lunchMinutes: number;
  jobHours: number;
  segments: { in: string; out: string | null }[];
  /** Office note when the times were corrected. */
  editNote: string | null;
}

/** One person's clock history, newest day first. */
export async function getMyHours(orgId: string, employeeId: string, days = 14): Promise<{ timezone: string; days: HoursDay[] }> {
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const db = createAdminClient();
  const { timezone } = await loadBusinessRules(db, orgId);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db
    .from("time_entries")
    .select("scheduled_job_id, clock_in, clock_out, total_hours, edited_at, edit_note")
    .eq("employee_id", employeeId)
    .gte("clock_in", since)
    .order("clock_in", { ascending: true });
  const now = Date.now();
  const hrs = (e: any) => (e.clock_out ? Number(e.total_hours ?? 0) : Math.max(0, (now - new Date(e.clock_in).getTime()) / 3_600_000));
  const byDay = new Map<string, { shifts: any[]; jobs: any[] }>();
  for (const e of data ?? []) {
    const d = new Date(e.clock_in).toLocaleDateString("en-CA", { timeZone: timezone });
    const r = byDay.get(d) ?? { shifts: [], jobs: [] };
    (e.scheduled_job_id ? r.jobs : r.shifts).push(e);
    byDay.set(d, r);
  }
  const out: HoursDay[] = [...byDay.entries()].map(([day, r]) => {
    const segs = r.shifts.length ? r.shifts : r.jobs;
    let lunch = 0;
    for (let i = 1; i < r.shifts.length; i++) {
      const prevOut = r.shifts[i - 1].clock_out;
      if (prevOut) lunch += Math.max(0, (new Date(r.shifts[i].clock_in).getTime() - new Date(prevOut).getTime()) / 60_000);
    }
    const last = segs[segs.length - 1];
    return {
      day,
      start: segs[0]?.clock_in ?? null,
      end: last?.clock_out ?? null,
      open: segs.some((e: any) => !e.clock_out),
      workedHours: segs.reduce((s: number, e: any) => s + hrs(e), 0),
      lunchMinutes: Math.round(lunch),
      jobHours: r.jobs.reduce((s: number, e: any) => s + hrs(e), 0),
      segments: segs.map((e: any) => ({ in: e.clock_in, out: e.clock_out })),
      editNote: [...r.shifts, ...r.jobs].filter((e: any) => e.edited_at).map((e: any) => e.edit_note).pop() ?? null,
    };
  });
  out.sort((a, b) => b.day.localeCompare(a.day));
  return { timezone, days: out };
}
