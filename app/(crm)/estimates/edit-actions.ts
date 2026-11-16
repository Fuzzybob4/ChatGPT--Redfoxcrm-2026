"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EditableEstimate {
  id: string;
  estimateNumber: string;
  customerName: string;
  title: string;
  description: string;
  notes: string;
  taxRate: number;
  depositPercent: number;
  validUntil: string;
  discount: number;
  items: { description: string; quantity: number; unitPrice: number; optional: boolean; imagePath: string | null }[];
  /** Approved estimates already have an invoice and can't be changed. */
  locked: boolean;
  customerHasSeenIt: boolean;
}

const money = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

async function ctx() {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not signed in.");
  return { org, db: createAdminClient() };
}

export async function getEditableEstimate(id: string): Promise<EditableEstimate | null> {
  const { org, db } = await ctx();
  const { data: e } = await db
    .from("estimates")
    .select("id, customer_id, estimate_number, title, description, notes, tax_rate, deposit_percent, valid_until, invoice_id, approved_at, view_count, viewed_at")
    .eq("id", id)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!e) return null;
  const [{ data: items }, { data: customer }] = await Promise.all([
    db
      .from("estimate_line_items")
      .select("description, quantity, unit_price, optional, sort_order, image_path")
      .eq("estimate_id", id)
      .eq("org_id", org.orgId)
      .order("sort_order", { ascending: true }),
    db.from("customers").select("full_name, first_name, last_name").eq("id", e.customer_id).eq("org_id", org.orgId).maybeSingle(),
  ]);
  const rows = items ?? [];
  // A negative, required line is the discount; everything else is a normal item.
  const discount = rows
    .filter((r) => Number(r.unit_price) < 0)
    .reduce((s, r) => s + Math.abs(Number(r.unit_price) * Number(r.quantity ?? 1)), 0);
  return {
    id: e.id,
    estimateNumber: e.estimate_number ?? "",
    customerName:
      customer?.full_name?.trim() || `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Customer",
    title: e.title ?? "",
    description: e.description ?? "",
    notes: e.notes ?? "",
    taxRate: Number(e.tax_rate ?? 0),
    depositPercent: Number(e.deposit_percent ?? 50),
    validUntil: (e.valid_until ?? "").slice(0, 10),
    discount: money(discount),
    items: rows
      .filter((r) => Number(r.unit_price) >= 0)
      .map((r) => ({
        description: r.description ?? "",
        quantity: Number(r.quantity ?? 1),
        unitPrice: Number(r.unit_price ?? 0),
        optional: r.optional !== false,
        imagePath: r.image_path ?? null,
      })),
    locked: Boolean(e.invoice_id || e.approved_at),
    customerHasSeenIt: Number(e.view_count ?? 0) > 0,
  };
}

export interface UpdateEstimateInput {
  title: string;
  description: string;
  notes: string;
  taxRate: number;
  depositPercent: number;
  validUntil: string;
  discount: number;
  items: { description: string; quantity: number; unitPrice: number; optional: boolean; imagePath?: string | null }[];
}

/** Save changes. The customer's link stays the same and shows the new version. */
export async function updateEstimate(
  id: string,
  input: UpdateEstimateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { org, db } = await ctx();
  const { data: e } = await db
    .from("estimates")
    .select("id, invoice_id, approved_at, declined_at")
    .eq("id", id)
    .eq("org_id", org.orgId)
    .maybeSingle();
  if (!e) return { ok: false, error: "Estimate not found." };
  if (e.invoice_id || e.approved_at) {
    return { ok: false, error: "This estimate is already approved. Edit the invoice instead." };
  }

  const items = (input.items ?? [])
    .map((i) => ({
      description: String(i.description ?? "").trim().slice(0, 1000),
      quantity: clamp(Number(i.quantity), 0, 100000),
      unitPrice: clamp(Number(i.unitPrice), 0, 1000000),
      optional: i.optional !== false,
      // Only pictures uploaded for this estimate can be attached to its items.
      imagePath:
        typeof i.imagePath === "string" && i.imagePath.startsWith(`storage/estimates/${org.orgId}/${id}/items/`)
          ? i.imagePath
          : null,
    }))
    .filter((i) => i.description && i.quantity > 0);
  if (!items.length) return { ok: false, error: "Add at least one item with a description." };
  if (items.length > 100) return { ok: false, error: "That's too many items for one estimate." };

  const itemsTotal = money(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount = clamp(money(Number(input.discount ?? 0)), 0, itemsTotal);
  const taxRate = clamp(Number(input.taxRate ?? 0), 0, 30);
  const subtotal = money(itemsTotal - discount);
  const taxAmount = money((subtotal * taxRate) / 100);
  const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(input.validUntil ?? "") ? input.validUntil : null;

  const rows = items.map((i, idx) => ({
    org_id: org.orgId,
    estimate_id: id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unitPrice,
    line_total: money(i.quantity * i.unitPrice),
    optional: i.optional,
    sort_order: idx,
    image_path: i.imagePath as string | null,
  }));
  if (discount > 0) {
    rows.push({
      org_id: org.orgId,
      estimate_id: id,
      description: "Discount",
      quantity: 1,
      unit_price: -discount,
      line_total: -discount,
      optional: false,
      sort_order: rows.length,
      image_path: null,
    });
  }

  // Replace the items, keeping the old ones if the insert fails.
  const { data: old } = await db.from("estimate_line_items").select("*").eq("estimate_id", id).eq("org_id", org.orgId);
  const { error: delErr } = await db.from("estimate_line_items").delete().eq("estimate_id", id).eq("org_id", org.orgId);
  if (delErr) return { ok: false, error: "Couldn't save the items. Please try again." };
  const { error: insErr } = await db.from("estimate_line_items").insert(rows);
  if (insErr) {
    if (old?.length) await db.from("estimate_line_items").insert(old);
    return { ok: false, error: "Couldn't save the items. Please try again." };
  }

  const { error } = await db
    .from("estimates")
    .update({
      title: (input.title ?? "").trim().slice(0, 200) || "Holiday lighting estimate",
      description: (input.description ?? "").trim().slice(0, 4000) || null,
      notes: (input.notes ?? "").trim().slice(0, 4000) || null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: money(subtotal + taxAmount),
      deposit_percent: clamp(Number(input.depositPercent ?? 50), 0, 100),
      valid_until: validUntil,
      // A declined estimate that's been revised can be approved again.
      ...(e.declined_at ? { declined_at: null, decline_reason: null, status: "sent" } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", org.orgId);
  if (error) return { ok: false, error: "Couldn't save the estimate. Please try again." };

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${id}`);
  return { ok: true };
}
