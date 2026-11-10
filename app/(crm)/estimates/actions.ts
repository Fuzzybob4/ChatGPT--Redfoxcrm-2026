"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { newApprovalToken } from "@/lib/estimates/approval";

export interface CreateEstimateInput {
  customerId: string;
  title: string;
  locationId?: string | null;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  discount?: number;
  taxRate?: number;
  depositPercent?: number;
  notes?: string;
}

const money = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

/** Saves a draft estimate with its line items. Customers can later pick which items to approve. */
export async function createEstimate(
  input: CreateEstimateInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Not signed in." };

  const items = (input.lineItems ?? [])
    .map((i) => ({
      description: String(i.description ?? "").trim().slice(0, 300),
      quantity: clamp(Number(i.quantity), 0, 100000),
      unitPrice: clamp(Number(i.unitPrice), 0, 1000000),
    }))
    .filter((i) => i.description && i.quantity > 0);
  if (!input.customerId) return { ok: false, error: "Pick a customer." };
  if (!items.length) return { ok: false, error: "Add at least one item with a description." };
  if (items.length > 100) return { ok: false, error: "That's too many items for one estimate." };

  const db = createAdminClient();
  const { data: customer } = await db
    .from("customers")
    .select("id, location_id")
    .eq("id", input.customerId)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!customer) return { ok: false, error: "Customer not found." };

  const itemsTotal = money(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount = clamp(money(Number(input.discount ?? 0)), 0, itemsTotal);
  const taxRate = clamp(Number(input.taxRate ?? 0), 0, 30);
  const depositPercent = clamp(Number(input.depositPercent ?? 50), 0, 100);
  const subtotal = money(itemsTotal - discount);
  const taxAmount = money((subtotal * taxRate) / 100);

  const today = new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const { data: est, error } = await db
    .from("estimates")
    .insert({
      org_id: org.orgId,
      customer_id: customer.id,
      created_by: org.userId,
      location_id: input.locationId || customer.location_id || null,
      estimate_number: `EST-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`,
      title: (input.title ?? "").trim().slice(0, 200) || "Holiday lighting estimate",
      status: "draft",
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: money(subtotal + taxAmount),
      deposit_percent: depositPercent,
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes: (input.notes ?? "").trim().slice(0, 4000) || null,
      approval_token: newApprovalToken(),
      source: "manual",
    })
    .select("id")
    .single();
  if (error || !est) return { ok: false, error: "Couldn't save the estimate. Please try again." };

  const rows = items.map((i, idx) => ({
    org_id: org.orgId,
    estimate_id: est.id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    line_total: money(i.quantity * i.unitPrice),
    optional: true,
    sort_order: idx,
  }));
  if (discount > 0) {
    // A discount always applies, whatever the customer picks.
    rows.push({
      org_id: org.orgId,
      estimate_id: est.id,
      description: "Discount",
      quantity: 1,
      unit_price: -discount,
      line_total: -discount,
      optional: false,
      sort_order: rows.length,
    });
  }
  const { error: itemsError } = await db.from("estimate_line_items").insert(rows);
  if (itemsError) {
    await db.from("estimates").delete().eq("id", est.id).eq("org_id", org.orgId);
    return { ok: false, error: "Couldn't save the estimate items. Please try again." };
  }

  revalidatePath("/estimates");
  return { ok: true, id: est.id };
}
