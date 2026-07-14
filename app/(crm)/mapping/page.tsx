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
    .select("id, full_name, first_name, last_name, email, phone, status");

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

  // Build pins from properties with coordinates
  const mapPins: MapPin[] = (properties ?? [])
    .map((p) => {
      const customer = customerMap.get(p.customer_id);
      if (!customer || !p.lat || !p.lng) return null;

      return {
        id: p.id,
        customerId: p.customer_id,
        propertyId: p.id,
        propertyName: p.property_name || "Property",
        customerName: customer.full_name ?? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        address: [p.address, p.city, p.state, p.zip_code].filter(Boolean).join(", "),
        city: p.city ?? "",
        lat: p.lat as number,
        lng: p.lng as number,
        isPrimary: !!p.is_primary,
        mapStatus: getCustomerStatus(p.customer_id),
      };
    })
    .filter((p) => p !== null) as MapPin[];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mapping"
        description="Visualize properties on the map by payment and installation status."
      />
      <div className="flex-1 min-h-0 px-4 pb-4 lg:px-6 lg:pb-6">
        <CustomerMap pins={mapPins} />
      </div>
    </div>
  );
}
