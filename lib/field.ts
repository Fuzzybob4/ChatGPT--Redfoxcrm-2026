import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/org";
import { mergedHours } from "@/lib/time-math";

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
  /** False for owners / salaried people: no day clock or hours. */
  trackTime?: boolean;
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
    .select("id, full_name, first_name, last_name, email, role, position, can_access_work_orders, location_id, crew_id, helping_crew_id, helping_date, track_time")
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
        trackTime: employee.track_time !== false,
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
  const custom = await getCustomInstallItems(orgId, customerId, season);
  if (custom) {
    return custom
      .map((i) => ({ description: crewSafeText(i.description), quantity: i.quantity }))
      .filter((i) => i.description);
  }
  return getInvoiceInstallItems(orgId, customerId, season, crewSafeText);
}

/** The office's hand-edited list for this season, or null when there isn't one. */
export async function getCustomInstallItems(orgId: string, customerId: string, season: string): Promise<InstallItem[] | null> {
  const { data } = await createAdminClient()
    .from("customers")
    .select("install_items, install_items_season")
    .eq("id", customerId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data || !Array.isArray(data.install_items)) return null;
  if (!data.install_items_season || String(data.install_items_season).slice(0, 10) < season.slice(0, 10)) return null;
  return (data.install_items as any[])
    .map((i) => ({ description: String(i?.description ?? "").trim(), quantity: Number(i?.quantity) > 0 ? Number(i.quantity) : 1 }))
    .filter((i) => i.description);
}

/** The list as it comes from this season's accepted estimate or newest invoice. */
export async function getInvoiceInstallItems(
  orgId: string,
  customerId: string,
  season: string,
  crewSafeText: (t: string | null | undefined) => string = (t) => String(t ?? "").trim(),
): Promise<InstallItem[]> {
  const admin = createAdminClient();
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
 * The crew app shows today and tomorrow only, so nobody sees a long list of
 * future work or old paused jobs. A job from an earlier day stays only while
 * someone's timer is actually running on it.
 */
export async function jobsForViewer(
  orgId: string,
  jobs: FieldJob[],
  _canRunJobs: boolean,
  openJobId?: string | null,
  /** They've ended their day: skip today's jobs and show tomorrow's. */
  dayDone = false,
): Promise<FieldJob[]> {
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { today } = await loadBusinessRules(createAdminClient(), orgId);
  const t = new Date(`${today}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  const tomorrow = t.toISOString().slice(0, 10);
  return jobs.filter(
    (j) =>
      j.status !== "cancelled" &&
      (j.id === openJobId ||
        (!dayDone && j.scheduledDate === today) ||
        (j.scheduledDate === tomorrow && j.status === "scheduled")),
  );
}

export interface DayStatus {
  /** Clock running since (current segment). */
  since: string | null;
  /** On lunch since (clock stopped for lunch, day not ended). */
  lunchSince: string | null;
  /** Time already worked today in earlier segments (before lunch), in ms. */
  workedBeforeMs: number;
}

/** Where the person is in their work day: on the clock, at lunch, or neither. */
export async function getDayStatus(orgId: string, employeeId: string): Promise<DayStatus> {
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { timezone } = await loadBusinessRules(createAdminClient(), orgId);
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: timezone });
  const today = day(new Date().toISOString());

  // Earlier pieces of today's work day (e.g. the morning, before lunch).
  const { data: recent } = await createAdminClient()
    .from("time_entries")
    .select("clock_in, clock_out, notes, break_minutes")
    .eq("employee_id", employeeId)
    .is("scheduled_job_id", null)
    .gte("clock_in", new Date(Date.now() - 36 * 3_600_000).toISOString())
    .order("clock_in", { ascending: true });
  const closedToday = (recent ?? []).filter((r: any) => r.clock_out && day(r.clock_in) === today);
  const workedBeforeMs = closedToday.reduce(
    (sum: number, r: any) =>
      sum + Math.max(0, new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime() - Number(r.break_minutes ?? 0) * 60_000),
    0,
  );

  const open = await getOpenShift(employeeId);
  if (open) return { since: open.clockIn, lunchSince: null, workedBeforeMs };
  const last = closedToday[closedToday.length - 1] as any;
  if (last?.notes === "Lunch") return { since: null, lunchSince: last.clock_out, workedBeforeMs };
  return { since: null, lunchSince: null, workedBeforeMs };
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
      workedHours: mergedHours(segs, now),
      lunchMinutes: Math.round(lunch),
      jobHours: mergedHours(r.jobs, now),
      segments: segs.map((e: any) => ({ in: e.clock_in, out: e.clock_out })),
      editNote: [...r.shifts, ...r.jobs].filter((e: any) => e.edited_at).map((e: any) => e.edit_note).pop() ?? null,
    };
  });
  out.sort((a, b) => b.day.localeCompare(a.day));
  return { timezone, days: out };
}

export type CustomerKind = "past" | "new" | "customer_lights";

export interface JobBadge {
  kind: CustomerKind;
  /** One line: what to bring, e.g. "Warm white roofline + 16" spheres". */
  summary: string;
}

const CUSTOMER_LIGHTS_RE = /\bcustomer[\s-]*(owned|owns|lights?)\b|\btheir (own )?lights\b|\bown lights\b/i;
const NOT_MATERIAL_RE = /\b(fee|setup|set-up|removal|take ?down|storage|travel|trip|service call|labor)\b/i;

/** "[PAST - PULL TOTE]", "[NEW - NEW MATERIALS]", "[CUSTOMER LIGHTS]" at the start of a job title. */
const TITLE_TAG_RE = /^\s*\[(past[^\]]*|new[^\]]*|customer lights?[^\]]*)\]\s*/i;

export function stripKindTag(title: string): string {
  return String(title ?? "").replace(TITLE_TAG_RE, "").trim();
}

function kindFromTitle(title: string): CustomerKind | null {
  const m = String(title ?? "").match(TITLE_TAG_RE);
  if (!m) return null;
  const t = m[1].toLowerCase();
  if (t.startsWith("customer")) return "customer_lights";
  if (t.startsWith("past")) return "past";
  return "new";
}

/**
 * Badge for each job card, keyed by job id:
 * - customer_lights: the customer supplies the lights (tagged, or the job/items say so)
 * - past: they had an invoice in an earlier season, so their lights are in a tote
 * - new: first season with us, so materials come from new stock
 * A "[PAST - PULL TOTE]" style tag at the start of the job title wins (it can
 * differ per property). Plus a one-line summary of what's going up (no prices).
 */
export async function getJobBadges(orgId: string, jobs: FieldJob[]): Promise<Record<string, JobBadge>> {
  const customerIds = [...new Set(jobs.map((j) => j.customerId).filter((id): id is string => Boolean(id)))];
  const admin = createAdminClient();
  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const rules = await loadBusinessRules(admin, orgId);
  const season = rules.seasonStart;
  const seasonYear = Number(season.slice(0, 4));

  const [{ data: customers }, { data: pastInvoices }] = customerIds.length
    ? await Promise.all([
        admin.from("customers").select("id, tags").eq("org_id", orgId).in("id", customerIds),
        admin
          .from("invoices")
          .select("customer_id, season_year")
          .eq("org_id", orgId)
          .in("customer_id", customerIds)
          .neq("status", "cancelled")
          .lt("created_at", season),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const hasPast = new Set(
    (pastInvoices ?? [])
      .filter((i: any) => !i.season_year || Number(i.season_year) < seasonYear)
      .map((i: any) => i.customer_id as string),
  );
  const tagsById = new Map((customers ?? []).map((c: any) => [c.id as string, (c.tags ?? []) as string[]]));

  const itemsById = new Map<string, InstallItem[]>();
  await Promise.all(
    customerIds.map(async (id) => itemsById.set(id, await getInstallItems(orgId, id).catch(() => [] as InstallItem[]))),
  );

  const result: Record<string, JobBadge> = {};
  for (const job of jobs) {
    const id = job.customerId;
    const items = id ? itemsById.get(id) ?? [] : [];
    const names = items
      .map((i) => i.description.split(/\r?\n/)[0].replace(/\s+/g, " ").trim())
      .filter((d) => d && !NOT_MATERIAL_RE.test(d) && !CUSTOMER_LIGHTS_RE.test(d));
    let summary = names.slice(0, 3).join(" + ");
    if (names.length > 3) summary += ` + ${names.length - 3} more`;

    let kind = kindFromTitle(job.title);
    if (!kind) {
      const text = `${(id && tagsById.get(id)?.join(" ")) || ""} ${job.title} ${job.notes} ${items.map((i) => i.description).join(" ")}`;
      kind = CUSTOMER_LIGHTS_RE.test(text) ? "customer_lights" : id && hasPast.has(id) ? "past" : "new";
    }
    if (kind === "customer_lights") summary = summary ? `Ladders and tools · ${summary}` : "Ladders and tools only";
    else if (!summary) summary = stripKindTag(job.title);
    result[job.id] = { kind, summary };
  }
  return result;
}

/**
 * Is a crew lead from this crew still working today (on the clock or at
 * lunch)? When every lead has ended their day, the rest of the crew can
 * finish the job themselves.
 */
export async function crewLeadStillWorking(orgId: string, crewId: string | null): Promise<boolean> {
  if (!crewId) return false;
  const admin = createAdminClient();
  const { data: leads } = await admin
    .from("employees")
    .select("id, role, position")
    .eq("org_id", orgId)
    .eq("crew_id", crewId);
  const leadIds = (leads ?? [])
    .filter((e: any) => e.role === "crew_lead" || /\blead\b/i.test(e.position ?? ""))
    .map((e: any) => e.id as string);
  if (!leadIds.length) return false;
  const { data: entries } = await admin
    .from("time_entries")
    .select("employee_id, clock_in, clock_out, notes")
    .in("employee_id", leadIds)
    .is("scheduled_job_id", null)
    .gte("clock_in", new Date(Date.now() - 20 * 3_600_000).toISOString())
    .order("clock_in", { ascending: false });
  const latest = new Map<string, any>();
  for (const e of entries ?? []) if (!latest.has(e.employee_id)) latest.set(e.employee_id, e);
  return [...latest.values()].some((e) => !e.clock_out || e.notes === "Lunch");
}

// ---------------------------------------------------------------------------
// One-screen job checklist: load the truck → confirm on site → scope steps →
// before you leave. State lives in scheduled_jobs.job_checklist, keyed by
// "load:…", "site:…", "step:…".

export type LoadState = "loaded" | "missing";
export type SiteState = "have" | "dont";
export type StepState = "done" | "cant";
export interface ChecklistMark {
  s: LoadState | SiteState | StepState;
  by?: string;
  at?: string;
  reason?: string;
}

export interface JobChecklist {
  load: string[];
  site: string[];
  steps: string[];
  /** Photo reminders for the wrap-up: one per scope area worth showing. */
  photoAreas: string[];
  ladder: string | null;
}

/** "2-story", "two story", "28 ft ladder", "[HEIGHT: 2 story]" in the title or notes. */
export function ladderFromText(text: string): string | null {
  const t = text.toLowerCase();
  const tag = t.match(/\[\s*height\s*:\s*([^\]]+)\]/);
  if (tag) return tag[1].trim();
  const ft = t.match(/(\d{1,2})\s*(?:ft|foot|')\s*ladder/);
  if (ft) return `${ft[1]} ft ladder`;
  const story = t.match(/\b(1|one|single|2|two|3|three)[\s-]*stor(?:y|ies)\b/);
  if (story) {
    const n = { one: 1, single: 1, two: 2, three: 3 }[story[1] as "one"] ?? Number(story[1]);
    return n >= 3 ? "3-story: tallest ladder / lift" : n === 2 ? "2-story: 28 ft+ extension ladder" : "1-story: 6–8 ft step + 16 ft ladder";
  }
  return null;
}

const firstLine = (d: string) => d.split(/\r?\n/)[0].replace(/\s+/g, " ").trim();

export function buildJobChecklist(
  job: Pick<FieldJob, "title" | "notes" | "jobType">,
  kind: "past" | "new" | "customer_lights" | null,
  items: InstallItem[],
): JobChecklist {
  const isRemoval = job.jobType === "removal";
  const ladder = ladderFromText(`${job.title} ${job.notes}`);
  const scope = items
    .map((i) => firstLine(i.description) + (Number.isFinite(i.quantity) && i.quantity !== 1 ? ` × ${Number(i.quantity.toFixed(2))}` : ""))
    .filter(Boolean);
  const scopeText = `${job.title} ${job.notes} ${scope.join(" ")}`.toLowerCase();
  const has = (re: RegExp) => re.test(scopeText);
  const ladderItem = ladder ? `Ladder: ${ladder}` : "Ladders (check the house height)";

  if (isRemoval) {
    return {
      load: ["Empty totes", "Labels and marker", ladderItem],
      site: [],
      steps: [
        ...scope.map((s) => `Take down ${s}`),
        "Label every set by area and pack the totes",
        "Pick up clips, stakes and cords; leave it clean",
      ],
      photoAreas: ["Packed totes"],
      ladder,
    };
  }

  const load =
    kind === "customer_lights"
      ? ["Clips", "Extension cords (spares)", ladderItem]
      : [
          kind === "past" ? "Customer's tote" : "New lights for this job",
          ...(has(/wreath/) ? [kind === "past" ? "Customer's wreath" : "Wreath"] : []),
          ...(has(/garland/) ? ["Garland"] : []),
          ...scope.filter((s) => !/wreath|garland/i.test(s)),
          "Timer",
          "Clips",
          "Extension cords",
          ladderItem,
        ];
  const site =
    kind === "customer_lights"
      ? [
          "Customer's lights are out",
          ...(has(/wreath/) ? ["Customer's wreath"] : []),
          ...(has(/garland/) ? ["Customer's garland"] : []),
          "Timer",
          "Extension cords",
        ]
      : [];
  const photoAreas = [
    ...(has(/roof|eave|gutter|peak/) ? ["Roofline"] : []),
    ...(has(/window/) ? ["Windows"] : []),
    ...(has(/door|entry/) ? ["Door / entry"] : []),
    ...(has(/tree/) ? ["Trees"] : []),
    ...(has(/wreath|garland/) ? ["Wreath / garland"] : []),
    ...(has(/bush|shrub|hedge/) ? ["Bushes"] : []),
  ];
  return {
    load: [...new Set(load)],
    site: [...new Set(site)],
    steps: [
      ...(scope.length ? scope.map((s) => `Install ${s}`) : ["Install everything on the work order"]),
      "Clean, straight lines and every connection secure",
      "Lights on and tested (timer set)",
      "Site cleaned up: clips, boxes, trash",
    ],
    photoAreas: photoAreas.length ? photoAreas : ["Front of the house"],
    ladder,
  };
}

/** What's still open, for the Start/Complete gates. */
export function checklistGaps(list: JobChecklist, marks: Record<string, ChecklistMark>) {
  const open = (prefix: string, keys: string[]) => keys.filter((k) => !marks[`${prefix}:${k}`]);
  return {
    load: open("load", list.load),
    site: open("site", list.site),
    steps: list.steps.filter((k) => {
      const m = marks[`step:${k}`];
      return !m || (m.s === "cant" && !m.reason?.trim());
    }),
  };
}

/** Everything the gates need for one job, loaded fresh on the server. */
export async function loadJobChecklist(orgId: string, job: FieldJob) {
  const admin = createAdminClient();
  const [items, badges, { data: row }] = await Promise.all([
    job.customerId ? getInstallItems(orgId, job.customerId) : Promise.resolve([] as InstallItem[]),
    getJobBadges(orgId, [job]).catch(() => ({}) as Record<string, JobBadge>),
    admin.from("scheduled_jobs").select("job_checklist").eq("id", job.id).eq("org_id", orgId).maybeSingle(),
  ]);
  const kind = (badges as Record<string, JobBadge>)[job.id]?.kind ?? null;
  const list = buildJobChecklist(job, kind, items);
  const marks = ((row?.job_checklist as Record<string, ChecklistMark>) ?? {}) as Record<string, ChecklistMark>;
  return { list, marks, kind, items };
}
