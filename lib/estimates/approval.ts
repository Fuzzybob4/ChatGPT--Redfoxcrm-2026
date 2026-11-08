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

/**
 * Marks an estimate approved and creates the matching invoice (sent, with the
 * estimate's deposit). Safe to call twice: an already-converted estimate
 * returns its existing invoice.
 */
export async function approveEstimateAndCreateInvoice(
  db: Db,
  estimate: EstimateRow,
  approval: { name: string; ip: string | null },
): Promise<{ invoiceId: string }> {
  if (estimate.invoice_id) return { invoiceId: estimate.invoice_id };

  const total = money(estimate.total_amount) || money(estimate.subtotal);
  const subtotal = money(estimate.subtotal) || total;
  const taxAmount = money(estimate.tax_amount);
  const depositPercent = Math.min(Math.max(Number(estimate.deposit_percent ?? 0), 0), 100);
  const deposit = money((total * depositPercent) / 100);

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

  await db.from("invoice_line_items").insert({
    org_id: estimate.org_id,
    invoice_id: invoice.id,
    description: title,
    quantity: 1,
    unit_price: subtotal,
    line_total: subtotal,
    sort_order: 0,
  });

  const { error: updateError } = await db
    .from("estimates")
    .update({
      status: "accepted",
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
