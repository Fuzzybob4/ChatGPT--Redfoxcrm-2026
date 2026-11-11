import { createAdminClient } from "@/lib/supabase/admin";
import { buildStageResolver } from "@/lib/customer-stages";
import type { LifecycleStatus } from "@/lib/lifecycle";

/** Stages a crew lead works from: homes waiting on an install, a removal, or already taken down. */
export const LEAD_STAGES = ["pending_install", "pending_removal", "removed"] as const satisfies readonly LifecycleStatus[];
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface HomeWorkOrder {
  id: string;
  jobType: string;
  status: string;
  scheduledDate: string;
  startTime: string | null;
  crewCount: number;
  assignedToMe: boolean;
}

export interface FieldHome {
  customerId: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  stage: LeadStage;
  openWorkOrders: HomeWorkOrder[];
}

export interface CrewOption {
  id: string;
  name: string;
}

const OPEN = ["scheduled", "en_route", "in_progress"];

const joinAddress = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

export async function getLeadHomes(
  orgId: string,
  locationId: string | null,
  employeeId: string | null = null,
): Promise<FieldHome[]> {
  const admin = createAdminClient();

  let customerQuery = admin
    .from("customers")
    .select("id, full_name, first_name, last_name, phone, install_status, address, city, state, zip_code, lat, lng")
    .eq("org_id", orgId);
  let jobQuery = admin.from("scheduled_jobs").select("*").eq("org_id", orgId).order("scheduled_date", { ascending: true });
  let invoiceQuery = admin
    .from("invoices")
    .select("customer_id, status, payment_state, amount_paid, amount_paid_cents, created_at, season_year")
    .eq("org_id", orgId);
  if (locationId) {
    customerQuery = customerQuery.eq("location_id", locationId);
    jobQuery = jobQuery.eq("location_id", locationId);
    invoiceQuery = invoiceQuery.eq("location_id", locationId);
  }

  const [{ data: customers }, { data: jobs }, { data: invoices }, { data: properties }] = await Promise.all([
    customerQuery,
    jobQuery,
    invoiceQuery,
    admin
      .from("customer_properties")
      .select("customer_id, address, city, state, zip_code, lat, lng, is_primary")
      .eq("org_id", orgId),
  ]);

  const { loadBusinessRules } = await import("@/lib/schedule-server");
  const { seasonStart } = await loadBusinessRules(admin, orgId);
  const stageOf = buildStageResolver({ customers: customers ?? [], jobs: jobs ?? [], invoices: invoices ?? [], seasonStart });

  const primaryProperty = new Map<string, Record<string, any>>();
  for (const p of properties ?? []) {
    if (p.is_primary || !primaryProperty.has(p.customer_id)) primaryProperty.set(p.customer_id, p);
  }

  const openByCustomer = new Map<string, HomeWorkOrder[]>();
  for (const j of jobs ?? []) {
    const status = String(j.status ?? "").toLowerCase();
    if (!j.customer_id || !OPEN.includes(status)) continue;
    const list = openByCustomer.get(j.customer_id) ?? [];
    list.push({
      id: j.id,
      jobType: j.job_type ?? "install",
      status,
      scheduledDate: j.scheduled_date ?? "",
      startTime: j.start_time ?? null,
      crewCount: Array.isArray(j.assigned_employees) ? j.assigned_employees.length : 0,
      assignedToMe:
        employeeId != null && Array.isArray(j.assigned_employees) && j.assigned_employees.includes(employeeId),
    });
    openByCustomer.set(j.customer_id, list);
  }

  const homes: FieldHome[] = [];
  for (const c of customers ?? []) {
    const stage = stageOf(c.id);
    if (!(LEAD_STAGES as readonly string[]).includes(stage)) continue;
    const prop = primaryProperty.get(c.id);
    const lat = prop?.lat ?? c.lat;
    const lng = prop?.lng ?? c.lng;
    homes.push({
      customerId: c.id,
      name: c.full_name?.trim() || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Customer",
      phone: c.phone ?? "",
      address: prop?.address
        ? joinAddress(prop.address, prop.city, prop.state, prop.zip_code)
        : joinAddress(c.address, c.city, c.state, c.zip_code),
      city: prop?.city ?? c.city ?? "",
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      stage: stage as LeadStage,
      openWorkOrders: openByCustomer.get(c.id) ?? [],
    });
  }

  return homes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCrewOptions(orgId: string): Promise<CrewOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("employees")
    .select("id, full_name, first_name, last_name, email")
    .eq("org_id", orgId)
    .eq("is_active", true);
  return (data ?? [])
    .map((e) => ({
      id: e.id,
      name: e.full_name?.trim() || `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || e.email || "Crew member",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Customer details used to prefill a new work order. */
export async function getWorkOrderCustomer(orgId: string, customerId: string) {
  const admin = createAdminClient();
  const [{ data: customer }, { data: properties }] = await Promise.all([
    admin
      .from("customers")
      .select("id, full_name, first_name, last_name, address, city, state, zip_code, location_id")
      .eq("org_id", orgId)
      .eq("id", customerId)
      .maybeSingle(),
    admin
      .from("customer_properties")
      .select("id, address, city, state, zip_code, is_primary")
      .eq("customer_id", customerId)
      .order("is_primary", { ascending: false })
      .limit(1),
  ]);
  if (!customer) return null;
  const prop = properties?.[0];
  return {
    id: customer.id as string,
    name:
      customer.full_name?.trim() || `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer",
    locationId: (customer.location_id as string | null) ?? null,
    propertyId: (prop?.id as string | undefined) ?? null,
    address: (prop?.address ?? customer.address ?? null) as string | null,
    city: (prop?.city ?? customer.city ?? null) as string | null,
    state: (prop?.state ?? customer.state ?? null) as string | null,
    zipCode: (prop?.zip_code ?? customer.zip_code ?? null) as string | null,
  };
}
