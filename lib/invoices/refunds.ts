import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

const cents = (n: unknown) => Math.round(Number(n ?? 0) * 100);

/**
 * Records a refund against an invoice and lowers what the invoice shows as
 * paid. Safe to call twice for the same Stripe refund (the second call does
 * nothing), so the refund button and the Stripe webhook can both report it.
 *
 * Refunding everything that was paid cancels the invoice, so reminders stop.
 * A partial refund leaves the invoice's status and balance as they were.
 */
export async function applyRefund(
  db: Db,
  r: {
    orgId: string;
    invoiceId: string;
    amountCents: number;
    method: "stripe" | "manual";
    reason?: string | null;
    stripeRefundId?: string | null;
    stripePaymentIntentId?: string | null;
    createdBy?: string | null;
  },
): Promise<{ applied: boolean }> {
  if (!Number.isInteger(r.amountCents) || r.amountCents <= 0) return { applied: false };

  if (r.stripeRefundId) {
    const { data: existing } = await db.from("invoice_refunds").select("id").eq("stripe_refund_id", r.stripeRefundId).maybeSingle();
    if (existing) return { applied: false };
  }
  const { error: insertError } = await db.from("invoice_refunds").insert({
    org_id: r.orgId,
    invoice_id: r.invoiceId,
    amount: r.amountCents / 100,
    reason: (r.reason ?? "").trim().slice(0, 500) || null,
    method: r.method,
    stripe_refund_id: r.stripeRefundId ?? null,
    stripe_payment_intent_id: r.stripePaymentIntentId ?? null,
    created_by: r.createdBy ?? null,
  });
  if (insertError) {
    if (insertError.code === "23505") return { applied: false }; // already recorded
    throw new Error(insertError.message);
  }

  const { data: invoice, error } = await db
    .from("invoices")
    .select("amount_paid, amount_refunded, status")
    .eq("id", r.invoiceId)
    .eq("org_id", r.orgId)
    .single();
  if (error || !invoice) throw new Error("Invoice not found");

  const paidCents = Math.max(0, cents(invoice.amount_paid) - r.amountCents);
  const update: Record<string, unknown> = {
    amount_paid: paidCents / 100,
    amount_paid_cents: paidCents,
    amount_refunded: (cents(invoice.amount_refunded) + r.amountCents) / 100,
    updated_at: new Date().toISOString(),
  };
  if (paidCents === 0) {
    update.status = "cancelled";
    update.payment_state = "unpaid";
    update.balance_due = 0;
  }
  const { error: updateError } = await db.from("invoices").update(update).eq("id", r.invoiceId).eq("org_id", r.orgId);
  if (updateError) throw new Error(updateError.message);
  return { applied: true };
}
