import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/email/resend";
import { sendInvoiceEmail } from "@/lib/email/transactional";
import { loadBusinessRules, type BusinessRules } from "@/lib/schedule-server";
import { todayIn } from "@/lib/schedule";

type Db = ReturnType<typeof createAdminClient>;

const BILLING_LINE = /^(square (invoice|card|cash|payment)|deposit|discount)\b/i;

function invoiceNumber(prefix: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * On the business's first takedown day, every customer installed this season
 * gets next season's invoice at this season's price, with a deposit to book,
 * and an email asking them to rebook. Runs once per season per business.
 * Skipped until email is set up, so nobody gets an invoice with no notice.
 */
export async function runRebookOffers(db: Db, orgId: string, rules: BusinessRules): Promise<{ created: number; emailed: number } | null> {
  if (!rules.rebookAuto || !isEmailConfigured()) return null;
  if (rules.today < rules.removalStart) return null;
  const nextSeason = rules.seasonYear + 1;

  const { data: already } = await db.from("rebook_runs").select("org_id").eq("org_id", orgId).eq("season_year", rules.seasonYear).maybeSingle();
  if (already) return null;
  // Claim the run first so two cron calls can't both send.
  const { error: claimErr } = await db.from("rebook_runs").insert({ org_id: orgId, season_year: rules.seasonYear });
  if (claimErr) return null;

  const { data: jobs } = await db
    .from("scheduled_jobs")
    .select("customer_id, job_type, status")
    .eq("org_id", orgId)
    .gte("scheduled_date", rules.seasonStart)
    .eq("status", "completed");
  const installed = [...new Set((jobs ?? []).filter((j: any) => j.customer_id && !String(j.job_type ?? "").toLowerCase().includes("remov")).map((j: any) => j.customer_id as string))];

  let created = 0;
  let emailed = 0;
  for (const customerId of installed) {
    const { data: c } = await db
      .from("customers")
      .select("id, email, do_not_contact, marketing_unsubscribed, location_id")
      .eq("id", customerId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!c || c.do_not_contact || c.marketing_unsubscribed || !c.email) continue;
    // Contract customers are billed by their contract, not a rebook offer.
    const { data: contract } = await db.from("contracts").select("id").eq("org_id", orgId).eq("customer_id", customerId).eq("status", "active").maybeSingle();
    if (contract) continue;
    const { data: existing } = await db.from("invoices").select("id").eq("org_id", orgId).eq("customer_id", customerId).eq("season_year", nextSeason).neq("status", "cancelled").limit(1);
    if (existing?.length) continue;

    // This season's install invoice (the most they paid on), with its items.
    const { data: source } = await db
      .from("invoices")
      .select("id, title, total_amount, amount_paid, invoice_line_items(description, quantity, unit_price, line_total, sort_order)")
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .neq("status", "cancelled")
      .gte("created_at", rules.seasonStart)
      .gt("amount_paid", 0)
      .order("total_amount", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!source) continue;
    const items = ((source as any).invoice_line_items ?? [])
      .filter((i: any) => Number(i.line_total) > 0 && !BILLING_LINE.test(String(i.description ?? "").trim()))
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const total = items.length
      ? Math.round(items.reduce((s: number, i: any) => s + Number(i.line_total), 0) * 100) / 100
      : Number(source.total_amount ?? 0);
    if (!(total > 0)) continue;
    const deposit = Math.round(total * (rules.rebookDepositPercent / 100) * 100) / 100;
    const now = new Date().toISOString();

    const { data: inv, error } = await db
      .from("invoices")
      .insert({
        org_id: orgId,
        customer_id: customerId,
        location_id: c.location_id ?? null,
        invoice_number: invoiceNumber("RB"),
        title: `Holiday lighting ${nextSeason}`,
        description: `Same setup as ${rules.seasonYear}, at this season's price.`,
        subtotal: total,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: total,
        deposit_amount: deposit,
        amount_paid: 0,
        balance_due: total,
        status: "sent",
        payment_state: "unpaid",
        sent_at: now,
        season_year: nextSeason,
        invoice_type: "yearly_deposit",
      })
      .select("id")
      .single();
    if (error || !inv) continue;
    created++;
    const rows = items.length
      ? items.map((i: any, idx: number) => ({
          org_id: orgId,
          invoice_id: inv.id,
          description: i.description,
          quantity: Number(i.quantity ?? 1),
          unit_price: Number(i.unit_price ?? i.line_total),
          line_total: Number(i.line_total),
          sort_order: idx,
        }))
      : [{ org_id: orgId, invoice_id: inv.id, description: source.title || "Holiday lighting", quantity: 1, unit_price: total, line_total: total, sort_order: 0 }];
    await db.from("invoice_line_items").insert(rows);
    try {
      await sendInvoiceEmail(db, orgId, inv.id, "rebook_offer");
      emailed++;
    } catch {
      // Logged in invoice_reminder_log; the invoice is still in the portal.
    }
  }
  await db.from("rebook_runs").update({ invoices_created: created, emails_sent: emailed }).eq("org_id", orgId).eq("season_year", rules.seasonYear);
  return { created, emailed };
}

/**
 * Contract customers: on the first billing month of each contract year, one
 * invoice for the whole year goes out, split into equal monthly installments
 * (e.g. 10% a month Jan–Oct). Each later month, the amount due so far is
 * raised by one installment and the customer gets a reminder if they're
 * behind. They can always pay ahead, up to the full balance.
 */
export async function runContractBilling(db: Db): Promise<{ created: number; emailed: number }> {
  const { data: contracts } = await db
    .from("contracts")
    .select("id, org_id, customer_id, term_start_year, term_years, contract_value, installment_percent, billing_months, last_billed_month, status, billing_mode")
    .eq("status", "active")
    .eq("billing_mode", "monthly_installments");
  let created = 0;
  let emailed = 0;
  const rulesCache = new Map<string, BusinessRules>();
  for (const k of contracts ?? []) {
    let rules = rulesCache.get(k.org_id);
    if (!rules) {
      rules = await loadBusinessRules(db, k.org_id);
      rulesCache.set(k.org_id, rules);
    }
    const today = todayIn(rules.timezone);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const ym = today.slice(0, 7);
    const months: number[] = ((k.billing_months as number[] | null) ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice().sort((a, b) => a - b);
    const start = Number(k.term_start_year);
    const end = start + Number(k.term_years ?? 1) - 1;
    if (year < start || year > end || !months.includes(month) || k.last_billed_month === ym) continue;
    const total = Math.round(Number(k.contract_value ?? 0) * 100) / 100;
    const pct = Number(k.installment_percent ?? 10);
    if (!(total > 0)) continue;

    // Claim this month first so a second run can't bill twice.
    const { data: claimed } = await db
      .from("contracts")
      .update({ last_billed_month: ym, updated_at: new Date().toISOString() })
      .eq("id", k.id)
      .or(`last_billed_month.is.null,last_billed_month.neq.${ym}`)
      .select("id");
    if (!claimed?.length) continue;

    const n = months.filter((m) => m <= month).length;
    const dueSoFar = Math.min(total, Math.round(total * (pct / 100) * n * 100) / 100);
    const lastMonth = months[months.length - 1];
    const finalDue = `${year}-${String(lastMonth).padStart(2, "0")}-28`;

    const { data: existing } = await db
      .from("invoices")
      .select("id, amount_paid")
      .eq("org_id", k.org_id)
      .eq("contract_id", k.id)
      .gte("created_at", `${year}-01-01`)
      .lt("created_at", `${year + 1}-01-01`)
      .neq("status", "cancelled")
      .maybeSingle();

    let invoiceId: string | null = existing?.id ?? null;
    let isNew = false;
    if (!invoiceId) {
      const installment = Math.round(total * (pct / 100) * 100) / 100;
      const schedule = months
        .map((m) => new Date(`${year}-${String(m).padStart(2, "0")}-15T12:00:00`).toLocaleDateString("en-US", { month: "short" }))
        .join(", ");
      const { data: inv, error } = await db
        .from("invoices")
        .insert({
          org_id: k.org_id,
          customer_id: k.customer_id,
          invoice_number: invoiceNumber("CT"),
          title: `Lighting contract ${year}`,
          description: `Contract year ${year - start + 1} of ${end - start + 1}. Billed in ${months.length} monthly payments of ${installment.toFixed(2)} (${pct}% each): ${schedule}. You can pay ahead or pay the full year any time.`,
          subtotal: total,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: total,
          amount_paid: 0,
          balance_due: total,
          deposit_amount: dueSoFar,
          due_date: finalDue,
          status: "sent",
          payment_state: "unpaid",
          sent_at: new Date().toISOString(),
          contract_id: k.id,
          invoice_type: "standard",
        })
        .select("id")
        .single();
      if (error || !inv) continue;
      invoiceId = inv.id;
      isNew = true;
      created++;
      await db.from("invoice_line_items").insert({
        org_id: k.org_id,
        invoice_id: inv.id,
        description: `Holiday lighting contract, ${year}`,
        quantity: 1,
        unit_price: total,
        line_total: total,
        sort_order: 0,
      });
    } else {
      // Raise the amount due so far by this month's installment.
      await db.from("invoices").update({ deposit_amount: dueSoFar, updated_at: new Date().toISOString() }).eq("id", invoiceId);
    }

    const behind = isNew || Number(existing?.amount_paid ?? 0) < dueSoFar - 0.005;
    if (behind && isEmailConfigured()) {
      try {
        await sendInvoiceEmail(db, k.org_id, invoiceId, isNew ? "invoice_sent" : "contract_installment");
        emailed++;
      } catch {
        // Logged; the invoice is in the portal either way.
      }
    }
  }
  return { created, emailed };
}
