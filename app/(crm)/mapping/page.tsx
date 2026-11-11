import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CustomerMap, type MapPin } from "@/components/mapping/customer-map";
import { PageHeader } from "@/components/page-header";
import { buildStageResolver } from "@/lib/customer-stages";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBusinessRules } from "@/lib/schedule-server";

export const metadata = {
  title: "Mapping - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const supabase = await createClient();
  const currentOrg = await getCurrentOrg();
  const seasonStart = currentOrg ? (await loadBusinessRules(createAdminClient(), currentOrg.orgId)).seasonStart : undefined;
  const locationId = (await cookies()).get("redfox_selected_location")?.value;

  // Page through results: the database API returns at most 1,000 rows per request.
  const customers: any[] = [];
  for (let from = 0; ; from += 1000) {
    let customerQuery = supabase
      .from("customers")
      .select("id, full_name, first_name, last_name, email, phone, status, install_status, address, city, state, zip_code, lat, lng, tags, do_not_contact")
      .order("id")
      .range(from, from + 999);
    if (locationId) customerQuery = customerQuery.eq("location_id", locationId);
    const { data: page } = await customerQuery;
    // Vendors (tagged "vendor") are contacts, not service locations: keep them off the map.
    customers.push(...(page ?? []).filter((c: any) => !(c.tags ?? []).includes("vendor")));
    if (!page || page.length < 1000) break;
  }

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

  // Estimates drive the "Estimate Sent" / "Estimate Approved" pipeline stages.
  const { data: estimates } = await supabase
    .from("estimates")
    .select("customer_id, status, sent_at, invoice_id, created_at")
    .not("customer_id", "is", null);

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

  const customerMap = new Map<string, any>();
  for (const c of customers ?? []) customerMap.set(c.id, c);

  const getCustomerStage = buildStageResolver({
    customers: customers ?? [],
    jobs: jobs ?? [],
    invoices: invoices ?? [],
    estimates: estimates ?? [],
    seasonStart,
  });

  // "Past customers": anyone who has booked before (completed job, paid
  // invoice, HubSpot "customer" stage, or tagged past-customer by the team)
  // but isn't booked for the current season yet — the rebooking list.
  const BOOKED_STAGES = new Set(["pending_install", "scheduled", "installed", "pending_removal"]);
  const bookedBefore = new Set<string>();
  for (const c of customers) {
    const tags: string[] = c.tags ?? [];
    if (tags.includes("hs-customer") || tags.includes("past-customer")) bookedBefore.add(c.id);
  }
  for (const inv of invoices ?? []) {
    const status = String(inv.status ?? "").toLowerCase();
    const paymentState = String(inv.payment_state ?? "").toLowerCase();
    if (inv.customer_id && (status === "paid" || paymentState === "paid")) bookedBefore.add(inv.customer_id);
  }
  for (const j of jobs ?? []) {
    if (j.customer_id && String(j.status ?? "").toLowerCase() === "completed") bookedBefore.add(j.customer_id);
  }
  // Customers who asked not to be contacted never show on the rebooking list.
  const doNotContact = new Set(customers.filter((c) => c.do_not_contact).map((c) => c.id as string));
  const isPastCustomer = (customerId: string) =>
    bookedBefore.has(customerId) && !doNotContact.has(customerId) && !BOOKED_STAGES.has(getCustomerStage(customerId));

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
      pastCustomer: isPastCustomer(p.customer_id),
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
      pastCustomer: isPastCustomer(c.id),
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
