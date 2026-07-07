import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerMap, type MapCustomer } from "@/components/mapping/customer-map";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Mapping - RedFox CRM",
};

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const supabase = createAdminClient();

  const { data: customers } = await supabase
    .from("customers")
    .select(
      "id, full_name, first_name, last_name, email, phone, address, city, state, zip_code, lat, lng, install_status, status"
    )
    .not("lat", "is", null)
    .not("lng", "is", null);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, status, total_amount, amount_paid");

  // Aggregate payment state per customer
  const paymentByCustomer = new Map<string, { hasUnpaid: boolean; hasPaid: boolean }>();
  for (const inv of invoices ?? []) {
    if (!inv.customer_id) continue;
    const entry = paymentByCustomer.get(inv.customer_id) ?? { hasUnpaid: false, hasPaid: false };
    const unpaid =
      (inv.status === "sent" || inv.status === "overdue") &&
      Number(inv.amount_paid ?? 0) < Number(inv.total_amount ?? 0);
    if (unpaid) entry.hasUnpaid = true;
    if (inv.status === "paid") entry.hasPaid = true;
    paymentByCustomer.set(inv.customer_id, entry);
  }

  const mapCustomers: MapCustomer[] = (customers ?? []).map((c) => {
    const pay = paymentByCustomer.get(c.id) ?? { hasUnpaid: false, hasPaid: false };
    return {
      id: c.id,
      name: c.full_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: [c.address, c.city, c.state, c.zip_code].filter(Boolean).join(", "),
      city: c.city ?? "",
      lat: c.lat as number,
      lng: c.lng as number,
      installStatus: (c.install_status ?? "none") as MapCustomer["installStatus"],
      hasUnpaidInvoice: pay.hasUnpaid,
      hasPaidInvoice: pay.hasPaid,
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
