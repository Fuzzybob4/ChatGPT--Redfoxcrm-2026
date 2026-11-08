import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports/reports-view";
import { ReportsOverview } from "@/components/reports/reports-overview";
import { buildReportsOverview } from "@/lib/reports/overview";

export const dynamic = "force-dynamic";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Reads every row (the database API returns at most 1,000 per request). */
async function readAll(
  supabase: Supabase,
  table: string,
  columns: string,
  orderBy = "created_at",
): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error(`[reports] failed to load ${table}:`, error.message);
      break;
    }
    rows.push(...((data as unknown as Record<string, any>[]) ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const [invoices, estimates, customers, jobs] = await Promise.all([
    readAll(
      supabase,
      "invoices",
      "id, invoice_number, title, status, total_amount, total_cents, amount_paid, amount_paid_cents, due_date, paid_at, paid_date, updated_at, created_at, season_year, archived, customer:customers(full_name, city)",
    ),
    readAll(
      supabase,
      "estimates",
      "id, estimate_number, title, status, total_amount, created_at, customer:customers(full_name, city)",
    ),
    readAll(
      supabase,
      "customers",
      "id, full_name, email, phone, city, state, install_status, status, created_at, tags",
    ),
    readAll(supabase, "scheduled_jobs", "id, status, job_type, scheduled_date, season_year, created_at"),
  ]);

  const overview = buildReportsOverview({ invoices, estimates, customers, jobs });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Reports" description="How the season is going, who owes you, and your full data to search and export" />
      <ReportsOverview data={overview} />
      <ReportsView
        invoices={invoices as never[]}
        estimates={estimates as never[]}
        customers={customers as never[]}
      />
    </div>
  );
}
