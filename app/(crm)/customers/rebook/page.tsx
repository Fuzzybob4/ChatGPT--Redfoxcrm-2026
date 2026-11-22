import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadRebookSettings } from "@/lib/rebooking";
import { PageHeader } from "@/components/page-header";
import { RebookList, type RebookRow } from "@/components/customers/rebook-list";
import { RebookSettingsCard } from "@/components/customers/rebook-settings";

export const dynamic = "force-dynamic";

const CUSTOMER_LIGHTS_RE = /\bcustomer[\s-]*(owned|owns|lights?)\b|\btheir (own )?lights\b|\bown lights\b/i;

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export default async function RebookPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/onboarding");
  if (!["owner", "admin", "manager"].includes(String(org.role ?? "").toLowerCase())) redirect("/dashboard");
  const db = createAdminClient();
  const settings = await loadRebookSettings(db, org.orgId);

  const [invoices, jobs, customers] = await Promise.all([
    readAll<any>((a, b) => db.from("invoices").select("customer_id").eq("org_id", org.orgId).neq("status", "cancelled").range(a, b)),
    readAll<any>((a, b) =>
      db.from("scheduled_jobs").select("customer_id, title, notes, status, scheduled_date, job_type").eq("org_id", org.orgId).neq("status", "cancelled").range(a, b),
    ),
    readAll<any>((a, b) =>
      db
        .from("customers")
        .select("id, full_name, first_name, last_name, phone, email, city, tags, do_not_contact, marketing_unsubscribed, sms_opt_out")
        .eq("org_id", org.orgId)
        .range(a, b),
    ),
  ]);

  const history = new Set<string>(invoices.map((i) => i.customer_id).filter(Boolean));
  for (const j of jobs) if (j.status === "completed" && j.customer_id) history.add(j.customer_id);
  const booked = new Set<string>(
    jobs
      .filter(
        (j) =>
          j.job_type !== "removal" &&
          settings.windowStart &&
          j.scheduled_date >= settings.windowStart &&
          (!settings.windowEnd || j.scheduled_date <= settings.windowEnd),
      )
      .map((j) => j.customer_id),
  );
  const jobText = new Map<string, string>();
  for (const j of jobs) if (j.customer_id) jobText.set(j.customer_id, `${jobText.get(j.customer_id) ?? ""} ${j.title ?? ""} ${j.notes ?? ""}`);

  const rows: RebookRow[] = customers
    .filter((c) => history.has(c.id) && !c.do_not_contact)
    .map((c) => ({
      id: c.id,
      name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer",
      city: c.city ?? "",
      phone: c.sms_opt_out ? null : (c.phone ?? null),
      email: c.marketing_unsubscribed ? null : (c.email ?? null),
      kind: CUSTOMER_LIGHTS_RE.test(`${(c.tags ?? []).join(" ")} ${jobText.get(c.id) ?? ""}`) ? ("customer_lights" as const) : ("past" as const),
      booked: booked.has(c.id),
    }))
    .sort((a, b) => Number(a.booked) - Number(b.booked) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader title="Rebooking" description="Send returning customers a link to pick their own install day." />
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <RebookSettingsCard initial={settings} />
        <RebookList rows={rows} />
      </div>
    </div>
  );
}
