"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCustomerContract, validMonths, type ContractView } from "@/lib/contracts";

const STAFF = ["owner", "admin", "manager"];

async function staffOrg() {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not signed in.");
  if (!STAFF.includes(String(org.role ?? "").toLowerCase())) throw new Error("Only owners, admins and managers can manage contracts.");
  return org;
}

export async function getCustomerContract(customerId: string): Promise<ContractView | null> {
  const org = await getCurrentOrg();
  if (!org) return null;
  return loadCustomerContract(createAdminClient(), org.orgId, customerId);
}

export async function saveCustomerContract(
  customerId: string,
  input: { yearlyAmount: number; startYear: number; years: number; percent: number; months: number[]; notes?: string; status?: "active" | "draft" },
): Promise<{ ok: true; contract: ContractView | null } | { ok: false; error: string }> {
  try {
    const org = await staffOrg();
    const db = createAdminClient();
    const { data: c } = await db.from("customers").select("id").eq("id", customerId).eq("org_id", org.orgId).maybeSingle();
    if (!c) return { ok: false, error: "Customer not found." };
    const amount = Math.round(Number(input.yearlyAmount) * 100) / 100;
    const startYear = Math.round(Number(input.startYear));
    const years = Math.round(Number(input.years));
    const percent = Number(input.percent);
    const months = validMonths(input.months);
    if (!(amount > 0)) return { ok: false, error: "Enter the yearly amount." };
    if (!(startYear >= 2024 && startYear <= 2100)) return { ok: false, error: "Enter a start year." };
    if (!(years >= 1 && years <= 10)) return { ok: false, error: "Contracts run 1–10 years." };
    if (!months.length) return { ok: false, error: "Pick at least one billing month." };
    if (!(percent > 0 && percent <= 100)) return { ok: false, error: "Percent per month must be 1–100." };
    if (percent * months.length < 99.5) {
      return { ok: false, error: `${months.length} payments of ${percent}% only cover ${Math.round(percent * months.length)}% of the year.` };
    }
    const row = {
      org_id: org.orgId,
      customer_id: customerId,
      contract_value: amount,
      term_start_year: startYear,
      term_years: years,
      installment_percent: percent,
      billing_months: months,
      billing_mode: "monthly_installments",
      notes: (input.notes ?? "").trim().slice(0, 1000) || null,
      status: input.status === "draft" ? "draft" : "active",
      renewal_type: "manual",
      pricing_locked: true,
      updated_at: new Date().toISOString(),
    };
    const existing = await loadCustomerContract(db, org.orgId, customerId);
    const { error } = existing
      ? await db.from("contracts").update(row).eq("id", existing.id).eq("org_id", org.orgId)
      : await db.from("contracts").insert(row);
    if (error) return { ok: false, error: "Couldn't save the contract." };
    revalidatePath(`/customers/${customerId}`);
    return { ok: true, contract: await loadCustomerContract(db, org.orgId, customerId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save." };
  }
}

/** End billing: no more invoices are created. Invoices already sent stay. */
export async function endCustomerContract(customerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const org = await staffOrg();
    const db = createAdminClient();
    const existing = await loadCustomerContract(db, org.orgId, customerId);
    if (!existing) return { ok: false, error: "No contract." };
    await db.from("contracts").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", existing.id).eq("org_id", org.orgId);
    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't end it." };
  }
}
