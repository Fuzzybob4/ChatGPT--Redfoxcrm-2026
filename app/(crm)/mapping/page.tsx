import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CustomerMap, type MapPin } from "@/components/mapping/customer-map";
import { PageHeader } from "@/components/page-header";
import { deriveLifecycleStatus, invoicePaymentSignal, type LifecycleStatus } from "@/lib/lifecycle";

export const metadata = {
  title: "Mapping - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const supabase = await createClient();
  const locationId = (await cookies()).get("redfox_selected_location")?.value;

  let customerQuery = supabase
    .from("customers")
    .select("id, full_name, first_name, last_name, email, phone, status, install_status, address, city, state, zip_code, lat, lng");
  if (locationId) customerQuery = customerQuery.eq("location_id", locationId);
  const { data: customers } = await customerQuery;

  let propertyQuery = supabase
    .from("customer_properties")
    .select("id, customer_id, property_name, address, city, state, zip_code, lat, lng, is_primary")
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (locationId) propertyQuery = propertyQuery.eq("location_id", locationId);
  const { data: properties } = await propertyQuery;

  // Column sets differ slightly between environments (e.g. amount_paid vs
  // amount_paid_cents, crew_name vs assigned_employees), so read full rows and
  // normalize them below.
  let jobQuery = supabase
    .from("scheduled_jobs")
    .select("*")
    .order("scheduled_date", { ascending: false });
  if (locationId) jobQuery = jobQuery.eq("location_id", locationId);
  const { data: jobs } = await jobQuery;

  let invoiceQuery = supabase.from("invoices").select("*");
  if (locationId) invoiceQuery = invoiceQuery.eq("location_id", locationId);
  const { data: invoices } = await invoiceQuery;

  // Open customer-submitted trouble calls drive the pulsing map indicator.
  const { data: troubleCalls } = await supabase
    .from("work_order_requests")
    .select("customer_id, title, urgency, status, created_at")
    .in("status", ["new", "scheduled"])
    .order("created_at", { ascending: false });

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

  // Aggregate payment signals per customer (deposit = partial payment).
  const paymentsByCustomer = new Map<string, { paid: boolean; deposit: boolean; unpaid: boolean }>();
  for (const inv of invoices ?? []) {
    if (!inv.customer_id) continue;
    const amountPaid =
      inv.amount_paid != null
        ? Number(inv.amount_paid)
        : inv.amount_paid_cents != null
          ? Number(inv.amount_paid_cents) / 100
          : 0;
    const signal = invoicePaymentSignal({
      status: inv.status,
      paymentState: inv.payment_state,
      amountPaid,
    });
    const current = paymentsByCustomer.get(inv.customer_id) ?? { paid: false, deposit: false, unpaid: false };
    paymentsByCustomer.set(inv.customer_id, {
      paid: current.paid || signal.paid,
      deposit: current.deposit || signal.deposit,
      unpaid: current.unpaid || signal.unpaid,
    });
  }

  // Removal jobs mark the end of the season; everything else counts as install work.
  const isRemovalJob = (jobType: string | null) => {
    const t = (jobType ?? "").toLowerCase();
    return t.includes("remov") || t.includes("takedown") || t.includes("take down") || t.includes("take_down");
  };

  const stageByCustomer = new Map<string, LifecycleStatus>();
  function getCustomerStage(customerId: string): LifecycleStatus {
    const cached = stageByCustomer.get(customerId);
    if (cached) return cached;

    const customer = customerMap.get(customerId);
    const customerJobs = jobsByCustomer.get(customerId) ?? [];
    const payments = paymentsByCustomer.get(customerId);

    // A completed removal job ends the season unless a team member set a stage.
    const removalJobs = customerJobs.filter((j) => isRemovalJob(j.job_type));
    const completedRemoval = removalJobs.some((j) => (j.status ?? "").toLowerCase() === "completed");
    const openRemoval = removalJobs.some((j) =>
      ["scheduled", "in_progress", "in progress"].includes((j.status ?? "").toLowerCase()),
    );
    const derivedSeasonStage = completedRemoval ? "removed" : openRemoval ? "pending_removal" : null;

    const stage = deriveLifecycleStatus({
      hasUnpaidInvoice: payments?.unpaid ?? false,
      hasPaidInvoice: payments?.paid ?? false,
      hasDepositPaid: payments?.deposit ?? false,
      jobs: customerJobs
        .filter((j) => !isRemovalJob(j.job_type))
        .map((j) => ({
          status: j.status ?? "",
          hasCrew:
            Boolean(String(j.crew_name ?? "").trim()) ||
            (Array.isArray(j.assigned_employees) && j.assigned_employees.length > 0),
        })),
      installStatus: customer?.install_status ?? derivedSeasonStage,
    });

    stageByCustomer.set(customerId, stage);
    return stage;
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
      stage: getCustomerStage(p.customer_id),
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
      stage: getCustomerStage(c.id),
      troubleCallCount: troubleByCustomer.get(c.id)?.count ?? 0,
      troubleCallUrgency: troubleByCustomer.get(c.id)?.urgency ?? null,
      troubleCallTitle: troubleByCustomer.get(c.id)?.title ?? null,
    });
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mapping"
        description="Track every customer by life stage, from paid deposit to installed."
      />
      <div className="flex-1 min-h-0 px-4 pb-4 lg:px-6 lg:pb-6">
        <CustomerMap pins={mapPins} />
      </div>
    </div>
  );
}
