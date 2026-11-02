import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CustomerMap, type MapPin, type UnmappedCustomer } from "@/components/mapping/customer-map";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Mapping - RedFox CRM",
};

export const dynamic = "force-dynamic";

function missingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const text = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /schema cache|could not find the|does not exist/i.test(text)
  );
}

export default async function MappingPage() {
  const supabase = await createClient();
  const locationId = (await cookies()).get("redfox_selected_location")?.value;

  const customerColumns =
    "id, full_name, first_name, last_name, email, phone, status, address, city, state, zip_code";
  let customerQuery = supabase.from("customers").select(`${customerColumns}, lat, lng`);
  if (locationId) customerQuery = customerQuery.eq("location_id", locationId);
  const customerResult = await customerQuery;
  let customers = customerResult.data;
  if (customerResult.error && missingColumn(customerResult.error)) {
    // lat/lng is what the import writes. Retry the long column names.
    let alt = supabase.from("customers").select(`${customerColumns}, latitude, longitude`);
    if (locationId) alt = alt.eq("location_id", locationId);
    const retry = await alt;
    customers = (retry.data ?? []).map((c) => ({ ...c, lat: c.latitude, lng: c.longitude }));
    if (retry.error) console.error("[mapping] customers query failed", retry.error);
  } else if (customerResult.error) {
    console.error("[mapping] customers query failed", customerResult.error);
  }

  const propertyColumns =
    "id, customer_id, property_name, address, city, state, zip_code, is_primary";
  const propertyResult = await supabase
    .from("customer_properties")
    .select(`${propertyColumns}, lat, lng`)
    .not("lat", "is", null)
    .not("lng", "is", null);
  // customer_properties is scoped through its customer below (customerMap),
  // not a location_id column, which is not confirmed to exist on that table.
  let propertyRows = propertyResult.data;
  if (propertyResult.error && missingColumn(propertyResult.error)) {
    const retry = await supabase
      .from("customer_properties")
      .select(`${propertyColumns}, latitude, longitude`)
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    propertyRows = (retry.data ?? []).map((p) => ({ ...p, lat: p.latitude, lng: p.longitude }));
    if (retry.error) console.error("[mapping] properties query failed", retry.error);
  } else if (propertyResult.error) {
    console.error("[mapping] properties query failed", propertyResult.error);
  }

  let jobQuery = supabase
    .from("scheduled_jobs")
    .select("customer_id, job_type, status, completed_at, scheduled_date")
    .order("scheduled_date", { ascending: false });
  if (locationId) jobQuery = jobQuery.eq("location_id", locationId);
  const { data: jobs } = await jobQuery;

  let estimateQuery = supabase.from("estimates").select("customer_id, status");
  if (locationId) estimateQuery = estimateQuery.eq("location_id", locationId);
  const { data: estimates } = await estimateQuery;

  // Open customer-submitted trouble calls drive the pulsing map indicator.
  const { data: troubleCalls } = await supabase
    .from("work_order_requests")
    .select("customer_id, title, urgency, status, created_at")
    .in("status", ["new", "scheduled"])
    .order("created_at", { ascending: false });

  type MapStatus = "all_customers" | "pending_installs" | "estimates_sent" | "installed" | "removed";

  // Map each customer to their most-urgent open trouble call (if any).
  const urgencyRank: Record<string, number> = { emergency: 3, high: 2, normal: 1, low: 0 };
  const troubleByCustomer = new Map<string, { count: number; urgency: string; title: string }>();
  for (const tc of troubleCalls ?? []) {
    if (!tc.customer_id) continue;
    const existing = troubleByCustomer.get(tc.customer_id);
    const urgency = (tc.urgency ?? "normal").toLowerCase();
    if (!existing) {
      troubleByCustomer.set(tc.customer_id, { count: 1, urgency, title: tc.title });
    } else {
      existing.count += 1;
      if ((urgencyRank[urgency] ?? 1) > (urgencyRank[existing.urgency] ?? 1)) {
        existing.urgency = urgency;
        existing.title = tc.title;
      }
    }
  }

  // Build customer lookup
  const customerMap = new Map<string, any>();
  for (const c of customers ?? []) customerMap.set(c.id, c);

  // Group jobs per customer (already ordered by scheduled_date desc)
  const jobsByCustomer = new Map<string, any[]>();
  for (const j of jobs ?? []) {
    if (!j.customer_id) continue;
    const list = jobsByCustomer.get(j.customer_id) ?? [];
    list.push(j);
    jobsByCustomer.set(j.customer_id, list);
  }

  // Group estimates per customer
  const estimatesByCustomer = new Map<string, any[]>();
  for (const e of estimates ?? []) {
    if (!e.customer_id) continue;
    const list = estimatesByCustomer.get(e.customer_id) ?? [];
    list.push(e);
    estimatesByCustomer.set(e.customer_id, list);
  }

  // Normalise job_type strings to "install" | "removal" | "other"
  function normalizeJobType(raw: string | null): "install" | "removal" | "other" {
    const t = (raw ?? "").toLowerCase();
    if (t.includes("remov") || t.includes("takedown") || t.includes("take_down") || t.includes("take down")) return "removal";
    if (t.includes("install") || t.includes("hang") || t.includes("setup") || t.includes("set_up")) return "install";
    return "other";
  }

  // Determine map status driven entirely by jobs, falling back to estimates
  function getCustomerStatus(customerId: string): MapStatus {
    const customerJobs = jobsByCustomer.get(customerId) ?? [];

    // Find the most recent completed job to determine last known work state
    const lastCompleted = customerJobs.find((j) => j.status === "completed");

    if (lastCompleted) {
      const type = normalizeJobType(lastCompleted.job_type);
      if (type === "removal") return "removed";
      if (type === "install") return "installed";
    }

    // Any active (scheduled or in-progress) job means pending install
    const hasActiveJob = customerJobs.some(
      (j) => j.status === "scheduled" || j.status === "in_progress" || j.status === "in progress"
    );
    if (hasActiveJob) return "pending_installs";

    // No jobs — check for a sent/approved estimate
    const custEstimates = estimatesByCustomer.get(customerId) ?? [];
    const hasSentEstimate = custEstimates.some(
      (e) => e.status === "sent" || e.status === "approved"
    );
    if (hasSentEstimate) return "estimates_sent";

    return "all_customers";
  }

  const customerName = (c: any) =>
    c.full_name?.trim() || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unnamed customer";

  const properties = (propertyRows ?? []).filter((p) => customerMap.has(p.customer_id));

  // Track which customers have at least one geocoded property, so we can
  // suppress the customer's main-address pin when properties cover them.
  const customersWithProperties = new Set(
    (properties ?? []).map((p) => p.customer_id)
  );

  const mapPins: MapPin[] = [];

  // 1. Property pins (one per geocoded property)
  for (const p of properties ?? []) {
    const customer = customerMap.get(p.customer_id);
    if (!customer || p.lat == null || p.lng == null) continue;

    mapPins.push({
      id: `prop-${p.id}`,
      customerId: p.customer_id,
      propertyId: p.id,
      propertyName: p.property_name || "Property",
      customerName: customerName(customer),
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: [p.address, p.city, p.state, p.zip_code].filter(Boolean).join(", "),
      city: p.city ?? "",
      lat: p.lat as number,
      lng: p.lng as number,
      isPrimary: !!p.is_primary,
      mapStatus: getCustomerStatus(p.customer_id),
      troubleCallCount: troubleByCustomer.get(p.customer_id)?.count ?? 0,
      troubleCallUrgency: troubleByCustomer.get(p.customer_id)?.urgency ?? null,
      troubleCallTitle: troubleByCustomer.get(p.customer_id)?.title ?? null,
    });
  }

  // 2. Customer main-address pins (only when the customer has no properties yet)
  for (const c of customers ?? []) {
    if (c.lat == null || c.lng == null) continue;
    if (customersWithProperties.has(c.id)) continue;

    mapPins.push({
      id: `cust-${c.id}`,
      customerId: c.id,
      propertyId: "",
      propertyName: "",
      customerName: customerName(c),
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: [c.address, c.city, c.state, c.zip_code].filter(Boolean).join(", "),
      city: c.city ?? "",
      lat: c.lat as number,
      lng: c.lng as number,
      isPrimary: true,
      mapStatus: getCustomerStatus(c.id),
      troubleCallCount: troubleByCustomer.get(c.id)?.count ?? 0,
      troubleCallUrgency: troubleByCustomer.get(c.id)?.urgency ?? null,
      troubleCallTitle: troubleByCustomer.get(c.id)?.title ?? null,
    });
  }

  // Customers with no pin at all (no geocoded address and no geocoded
  // property). Passed to the map so search can still find them.
  const pinnedCustomerIds = new Set(mapPins.map((p) => p.customerId));
  const unmapped: UnmappedCustomer[] = (customers ?? [])
    .filter((c) => !pinnedCustomerIds.has(c.id))
    .map((c) => ({
      customerId: c.id,
      customerName: customerName(c),
      address: [c.address, c.city, c.state, c.zip_code].filter(Boolean).join(", "),
      hasStreetAddress: !!String(c.address ?? "").trim(),
    }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mapping"
        description="Visualize customers and their properties on the map by payment and installation status."
      />
      <div className="flex-1 min-h-0 px-4 pb-4 lg:px-6 lg:pb-6">
        <CustomerMap pins={mapPins} unmapped={unmapped} />
      </div>
    </div>
  );
}
