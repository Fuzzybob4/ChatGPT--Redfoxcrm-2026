import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPortalToken } from "@/app/(crm)/customers/portal-actions";
import { loadBusinessRules } from "@/lib/schedule-server";
import { PlanSignup } from "./plan-signup";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { token } = await params;
  const { invoice } = await searchParams;
  const customer = await verifyPortalToken(token);
  if (!customer || !invoice) notFound();

  const db = createAdminClient();
  const rules = await loadBusinessRules(db, customer.org_id);
  const [{ data: inv }, { data: profile }] = await Promise.all([
    db.from("invoices").select("id, customer_id, total_amount, amount_paid, status, season_year, title").eq("id", invoice).eq("org_id", customer.org_id).maybeSingle(),
    db.from("business_profiles").select("business_name").eq("org_id", customer.org_id).maybeSingle(),
  ]);
  if (!inv || inv.customer_id !== customer.id || !rules.contractOffer) notFound();

  const business = profile?.business_name || "Your lighting company";
  const total = Number(inv.total_amount ?? 0);
  const monthly = Math.round(total * (rules.contractPercent / 100) * 100) / 100;
  const startYear = Number(inv.season_year ?? new Date().getFullYear());
  const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const used = inv.status === "cancelled" || inv.status === "paid" || Number(inv.amount_paid ?? 0) > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 bg-background p-5">
      <div>
        <p className="text-sm text-muted-foreground">{business}</p>
        <h1 className="text-2xl font-bold">Lock in your price for {rules.contractYears} years</h1>
      </div>
      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <p>
          <span className="text-2xl font-bold">{usd(monthly)}</span> <span className="text-muted-foreground">a month</span>
        </p>
        <p>
          {rules.contractMonths.length} payments a year ({rules.contractMonths.map((m) => MONTHS[m - 1]).join(", ")}), {usd(total)} a year,
          for {startYear}–{startYear + rules.contractYears - 1}.
        </p>
        <p className="text-muted-foreground">
          Same setup and price every season: install, maintenance, takedown and storage. No deposit today. You can pay ahead or pay the
          whole year any time.
        </p>
      </div>
      {used ? (
        <p className="rounded-lg bg-muted p-4 text-sm">This offer has already been used. Contact {business} if you&apos;d like to switch plans.</p>
      ) : (
        <PlanSignup token={token} invoiceId={inv.id} business={business} years={rules.contractYears} />
      )}
      <a href={`/customer-portal/${encodeURIComponent(token)}`} className="text-center text-sm text-muted-foreground underline">
        Back to pay the one-season deposit instead
      </a>
    </main>
  );
}
