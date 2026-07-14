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

  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, status, total_amount, amount_paid");

  const { data: estimates } = await supabase
    .from("estimates")
    .select("customer_id, status");

  type MapStatus = "all_customers" | "pending_installs" | "estimates_sent" | "installed" | "removed";

  // Build customer lookup for quick name resolution
  const customerMap = new Map<string, any>();
  for (const c of customers ?? []) {
    customerMap.set(c.id, c);
  }

  // First pass: invoices determine paid/unpaid per customer
  const invoicesByCustomer = new Map<string, any[]>();
  const hasInvoiceByCustomer = new Map<string, boolean>();
  for (const inv of invoices ?? []) {
    if (!inv.customer_id) continue;
    const list = invoicesByCustomer.get(inv.customer_id) ?? [];
    list.push(inv);
    invoicesByCustomer.set(inv.customer_id, list);
    hasInvoiceByCustomer.set(inv.customer_id, true);
  }

  // Second pass: estimates
  const estimatesByCustomer = new Map<string, any[]>();
  const hasEstimateByCustomer = new Map<string, boolean>();
  for (const est of estimates ?? []) {
    if (!est.customer_id) continue;
    const list = estimatesByCustomer.get(est.customer_id) ?? [];
    list.push(est);
    estimatesByCustomer.set(est.customer_id, list);
    hasEstimateByCustomer.set(est.customer_id, true);
  }

  // Helper to determine status for a customer
  function getCustomerStatus(customerId: string): MapStatus {
    const customer = customerMap.get(customerId);
    if (customer?.status === "removed") return "removed";

    if (hasInvoiceByCustomer.has(customerId)) {
      const invs = invoicesByCustomer.get(customerId) ?? [];
      const hasPaid = invs.some((inv: any) => inv.status === "paid");
      if (hasPaid) return "installed";
      const hasUnpaid = invs.some(
        (inv: any) =>
          (inv.status === "sent" || inv.status === "overdue") &&
          Number(inv.amount_paid ?? 0) < Number(inv.total_amount ?? 0)
      );
      if (hasUnpaid) return "pending_installs";
    }

    if (hasEstimateByCustomer.has(customerId)) return "estimates_sent";
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
