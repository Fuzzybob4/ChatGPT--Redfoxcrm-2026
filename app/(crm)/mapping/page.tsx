import { createClient } from "@/lib/supabase/server";
import { CustomerMap, type MapPin } from "@/components/mapping/customer-map";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Mapping - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name, first_name, last_name, email, phone, status, address, city, state, zip_code, lat, lng");

  const { data: properties } = await supabase
    .from("customer_properties")
    .select("id, customer_id, property_name, address, city, state, zip_code, lat, lng, is_primary")
    .not("lat", "is", null)
    .not("lng", "is", null);

  const { data: jobs } = await supabase
    .from("scheduled_jobs")
    .select("customer_id, job_type, status, completed_at, scheduled_date")
    .order("scheduled_date", { ascending: false });

  const { data: estimates } = await supabase
    .from("estimates")
    .select("customer_id, status");

  type MapStatus = "all_customers" | "pending_installs" | "estimates_sent" | "installed" | "removed";

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
    c.full_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();

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
    });
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mapping"
        description="Visualize customers and their properties on the map by payment and installation status."
      />
      <div className="flex-1 min-h-0 px-4 pb-4 lg:px-6 lg:pb-6">
        <CustomerMap pins={mapPins} />
      </div>
    </div>
  );
}
