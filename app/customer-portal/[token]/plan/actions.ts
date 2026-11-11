"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPortalToken } from "@/app/(crm)/customers/portal-actions";
import { loadBusinessRules } from "@/lib/schedule-server";
import { todayIn } from "@/lib/schedule";
import { createNotification } from "@/lib/notifications-server";

/** Customer chooses the multi-year monthly plan instead of the one-season rebook deposit. */
export async function enrollContract(
  token: string,
  invoiceId: string,
  input: { name: string; agreed: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const customer = await verifyPortalToken(token);
  if (!customer) return { ok: false, error: "This link has expired. Contact the business for a new one." };
  const name = (input.name ?? "").trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: "Type your full name to sign." };
  if (!input.agreed) return { ok: false, error: "Check the box to agree to the plan." };

  const db = createAdminClient();
  const rules = await loadBusinessRules(db, customer.org_id);
  if (!rules.contractOffer) return { ok: false, error: "This plan isn't available right now." };

  const { data: inv } = await db
    .from("invoices")
    .select("id, customer_id, org_id, total_amount, amount_paid, status, season_year")
    .eq("id", invoiceId)
    .eq("org_id", customer.org_id)
    .maybeSingle();
  if (!inv || inv.customer_id !== customer.id) return { ok: false, error: "We couldn't find that offer." };
  if (inv.status === "cancelled" || inv.status === "paid" || Number(inv.amount_paid ?? 0) > 0) {
    return { ok: false, error: "This offer was already used. Contact the business if you'd like to switch plans." };
  }
  const { data: existing } = await db.from("contracts").select("id").eq("org_id", customer.org_id).eq("customer_id", customer.id).eq("status", "active").maybeSingle();
  if (existing) return { ok: false, error: "You're already on a plan with us." };

  const today = todayIn(rules.timezone);
  const { error } = await db.from("contracts").insert({
    org_id: customer.org_id,
    customer_id: customer.id,
    contract_value: Number(inv.total_amount),
    term_start_year: Number(inv.season_year ?? today.slice(0, 4)),
    term_years: rules.contractYears,
    installment_percent: rules.contractPercent,
    billing_months: rules.contractMonths,
    billing_mode: "monthly_installments",
    status: "active",
    renewal_type: "manual",
    pricing_locked: true,
    signed_name: name,
    signed_date: today,
    source_invoice_id: inv.id,
    notes: `Signed up online from the rebook offer.`,
  });
  if (error) return { ok: false, error: "Something went wrong. Please try again." };

  // The plan's yearly invoice replaces the one-season rebook invoice.
  await db.from("invoices").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", inv.id);

  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "A customer";
  try {
    await createNotification({
      orgId: customer.org_id,
      type: "contract_signed",
      title: `${customerName} signed up for the ${rules.contractYears}-year plan`,
      message: `Signed by ${name}. Their first contract invoice goes out automatically.`,
      customerId: customer.id,
    });
  } catch {
    // Best effort.
  }
  return { ok: true };
}
