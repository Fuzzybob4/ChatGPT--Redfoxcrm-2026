import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports/reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: estimates }, { data: customers }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, title, status, total_amount, amount_paid, due_date, created_at, customer:customers(full_name, city)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("estimates")
        .select(
          "id, estimate_number, title, status, total_amount, created_at, customer:customers(full_name, city)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("customers")
        .select(
          "id, full_name, email, phone, city, state, install_status, status, created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Reports"
        description="Search, filter, and export your business data"
      />
      <ReportsView
        invoices={(invoices as never[]) ?? []}
        estimates={(estimates as never[]) ?? []}
        customers={(customers as never[]) ?? []}
      />
    </div>
  );
}
