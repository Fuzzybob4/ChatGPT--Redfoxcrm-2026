import { createClient } from "@/lib/supabase/server";
import { CustomerMap, type MapCustomer } from "@/components/mapping/customer-map";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Mapping - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select(
      "id, full_name, first_name, last_name, email, phone, address, city, state, zip_code, lat, lng, status"
    )
    .not("lat", "is", null)
    .not("lng", "is", null);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, status, total_amount, amount_paid");

  const { data: estimates } = await supabase
    .from("estimates")
    .select("customer_id, status");

  // Build status lookup per customer
  type MapStatus = "all_customers" | "pending_installs" | "estimates_sent" | "installed" | "removed";
  
  const statusByCustomer = new Map<string, MapStatus>();
  
  // First pass: invoices determine paid/unpaid
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

  // Determine status for each customer
  const mapCustomers: MapCustomer[] = (customers ?? []).map((c) => {
    let mapStatus: MapStatus = "all_customers";

    // Check if removed
    if (c.status === "removed") {
      mapStatus = "removed";
    }
    // Check if has paid invoices (deposit or full payment)
    else if (hasInvoiceByCustomer.has(c.id)) {
      const invs = invoicesByCustomer.get(c.id) ?? [];
      const hasPaid = invs.some((inv: any) => inv.status === "paid");
      if (hasPaid) {
        mapStatus = "installed";
      } else {
        // Has unpaid invoices
        const hasUnpaid = invs.some(
          (inv: any) =>
            (inv.status === "sent" || inv.status === "overdue") &&
            Number(inv.amount_paid ?? 0) < Number(inv.total_amount ?? 0)
        );
        if (hasUnpaid) {
          mapStatus = "pending_installs";
        }
      }
    }
    // Check if has estimates but no invoices
    else if (hasEstimateByCustomer.has(c.id)) {
      mapStatus = "estimates_sent";
    }

    return {
      id: c.id,
      name: c.full_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: [c.address, c.city, c.state, c.zip_code].filter(Boolean).join(", "),
      city: c.city ?? "",
      lat: c.lat as number,
      lng: c.lng as number,
      mapStatus,
    };
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mapping"
        description="Visualize customers on the map by payment and installation status."
      />
      <div className="flex-1 min-h-0 px-4 pb-4 lg:px-6 lg:pb-6">
        <CustomerMap customers={mapCustomers} />
      </div>
    </div>
  );
}
