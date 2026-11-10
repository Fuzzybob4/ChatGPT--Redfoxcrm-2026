import "server-only";

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

export function newApprovalToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Returns the customer's portal token, creating one if needed. */
export async function ensurePortalToken(db: Db, customerId: string, orgId: string): Promise<string> {
  const { data: customer, error } = await db
    .from("customers")
    .select("portal_access_token")
    .eq("id", customerId)
    .eq("org_id", orgId)
    .single();
  if (error || !customer) throw new Error("Customer not found");
  if (customer.portal_access_token) return customer.portal_access_token as string;

  const token = randomBytes(32).toString("base64url");
  const { error: updateError } = await db
    .from("customers")
    .update({ portal_access_token: token, portal_token_created_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("org_id", orgId);
  if (updateError) throw new Error("Could not create the customer's portal link");
  return token;
}

export interface EstimateRow {
  id: string;
  org_id: string;
  customer_id: string;
  location_id: string | null;
  estimate_number: string | null;
  title: string | null;
  description: string | null;
  notes: string | null;
  subtotal: number | string | null;
  tax_rate: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  deposit_percent: number | string | null;
  status: string | null;
  invoice_id: string | null;
}

export const ESTIMATE_COLUMNS =
  "id, org_id, customer_id, location_id, estimate_number, title, description, notes, subtotal, tax_rate, tax_amount, total_amount, deposit_percent, status, invoice_id";

const money = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

export interface EstimateItemRow {
  id: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
  optional: boolean;
  selected: boolean | null;
  sort_order: number;
}

export async function loadEstimateItems(db: Db, estimateId: string, orgId: string): Promise<EstimateItemRow[]> {
  const { data } = await db
    .from("estimate_line_items")
    .select("id, description, quantity, unit_price, line_total, optional, selected, sort_order")
    .eq("estimate_id", estimateId)
    .eq("org_id", orgId)
    .order("sort_order");
  return (data ?? []) as unknown as EstimateItemRow[];
}

/**
 * Totals for the items a customer chose. Items that aren't optional (for
 * example a discount line) always apply. Pass `null` to take every item.
 */
export function totalsForSelection(
  items: EstimateItemRow[],
  selectedIds: string[] | null,
  taxRate: number,
  depositPercent: number,
) {
  const picked = new Set(selectedIds ?? []);
  const chosen = items.filter((i) => !i.optional || selectedIds === null || picked.has(i.id));
  const subtotal = Math.max(0, money(chosen.reduce((sum, i) => sum + Number(i.line_total ?? 0), 0)));
  const taxAmount = money((subtotal * Math.max(0, taxRate)) / 100);
  const total = money(subtotal + taxAmount);
  const deposit = money((total * Math.min(Math.max(depositPercent, 0), 100)) / 100);
  const hasChargeable = chosen.some((i) => Number(i.line_total ?? 0) > 0);
  return { chosen, subtotal, taxAmount, total, deposit, hasChargeable };
}

export class NothingSelectedError extends Error {
  constructor() {
    super("Pick at least one item to approve.");
  }
}

/**
 * Marks an estimate approved and creates the matching invoice (sent, with the
 * estimate's deposit). When the estimate has line items, the invoice carries
 * only the ones the customer selected (`selectedItemIds`; omit to take all).
 * Safe to call twice: an already-converted estimate returns its existing invoice.
 */
export async function approveEstimateAndCreateInvoice(
  db: Db,
  estimate: EstimateRow,
  approval: { name: string; ip: string | null; selectedItemIds?: string[] | null },
): Promise<{ invoiceId: string }> {
  if (estimate.invoice_id) return { invoiceId: estimate.invoice_id };

  const depositPercent = Math.min(Math.max(Number(estimate.deposit_percent ?? 0), 0), 100);
  const items = await loadEstimateItems(db, estimate.id, estimate.org_id);

  let total = money(estimate.total_amount) || money(estimate.subtotal);
  let subtotal = money(estimate.subtotal) || total;
  let taxAmount = money(estimate.tax_amount);
  let deposit = money((total * depositPercent) / 100);
  let chosen: EstimateItemRow[] = [];
  if (items.length) {
    const t = totalsForSelection(items, approval.selectedItemIds ?? null, Number(estimate.tax_rate ?? 0), depositPercent);
    if (!t.hasChargeable || t.total <= 0) throw new NothingSelectedError();
    ({ chosen, subtotal, taxAmount, total, deposit } = t);
  }
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const invoiceNumber = `INV-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;
  const due = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const title = estimate.title || `Estimate ${estimate.estimate_number ?? ""}`.trim();

  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .insert({
      org_id: estimate.org_id,
      customer_id: estimate.customer_id,
      location_id: estimate.location_id,
      estimate_id: estimate.id,
      invoice_number: invoiceNumber,
      title,
      description: estimate.description,
      notes: estimate.notes,
      subtotal,
      tax_rate: Number(estimate.tax_rate ?? 0),
      tax_amount: taxAmount,
      total_amount: total,
      deposit_amount: deposit,
      balance_due: total,
      amount_paid: 0,
      due_date: due,
      status: "sent",
      payment_state: "unpaid",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Could not create the invoice");

  await db.from("invoice_line_items").insert(
    chosen.length
      ? chosen.map((i, idx) => ({
          org_id: estimate.org_id,
          invoice_id: invoice.id,
          description: i.description,
          quantity: Number(i.quantity ?? 1),
          unit_price: Number(i.unit_price ?? 0),
          line_total: Number(i.line_total ?? 0),
          sort_order: idx,
        }))
      : [{ org_id: estimate.org_id, invoice_id: invoice.id, description: title, quantity: 1, unit_price: subtotal, line_total: subtotal, sort_order: 0 }],
  );

  // Remember which items the customer took and which they passed on.
  if (items.length) {
    const chosenIds = chosen.map((i) => i.id);
    await db.from("estimate_line_items").update({ selected: true }).eq("estimate_id", estimate.id).in("id", chosenIds);
    const skipped = items.filter((i) => !chosenIds.includes(i.id)).map((i) => i.id);
    if (skipped.length) await db.from("estimate_line_items").update({ selected: false }).eq("estimate_id", estimate.id).in("id", skipped);
  }

  const { error: updateError } = await db
    .from("estimates")
    .update({
      status: "accepted",
      // The estimate now reflects what was actually approved.
      subtotal,
      tax_amount: taxAmount,
      total_amount: total,
      approved_at: new Date().toISOString(),
      approved_by_name: approval.name.slice(0, 200),
      approval_ip: approval.ip,
      invoice_id: invoice.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id)
    .eq("org_id", estimate.org_id)
    .is("invoice_id", null);
  if (updateError) throw new Error(updateError.message);

  return { invoiceId: invoice.id };
}
