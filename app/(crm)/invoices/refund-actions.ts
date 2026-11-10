"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { applyRefund } from "@/lib/invoices/refunds";

const cents = (n: unknown) => Math.round(Number(n ?? 0) * 100);

export interface RefundInfo {
  /** Net amount currently paid on the invoice (what can still be refunded). */
  paid: number;
  /** How much of that was paid by card through Stripe and can go back to the card. */
  cardRefundable: number;
  refunds: { id: string; amount: number; method: string; reason: string | null; createdAt: string }[];
}

async function loadContext(invoiceId: string) {
  const org = await getCurrentOrg();
  if (!org) throw new Error("Not signed in.");
  const db = createAdminClient();
  const [{ data: invoice }, { data: payments }, { data: refunds }, { data: orgRow }] = await Promise.all([
    db.from("invoices").select("id, invoice_number, amount_paid, customer_id").eq("id", invoiceId).eq("org_id", org.orgId).maybeSingle(),
    db
      .from("payments")
      .select("amount_cents, provider, provider_payment_id, status, created_at")
      .eq("invoice_id", invoiceId)
      .eq("org_id", org.orgId)
      .eq("provider", "stripe")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false }),
    db
      .from("invoice_refunds")
      .select("id, amount, method, reason, stripe_payment_intent_id, created_at")
      .eq("invoice_id", invoiceId)
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false }),
    db.from("organizations").select("stripe_account_id").eq("id", org.orgId).maybeSingle(),
  ]);
  if (!invoice) throw new Error("Invoice not found.");

  // What is left to refund on each card payment.
  const refundedByIntent = new Map<string, number>();
  for (const r of refunds ?? []) {
    if (r.stripe_payment_intent_id) {
      refundedByIntent.set(r.stripe_payment_intent_id, (refundedByIntent.get(r.stripe_payment_intent_id) ?? 0) + cents(r.amount));
    }
  }
  const cardPayments = (payments ?? [])
    .filter((p) => typeof p.provider_payment_id === "string" && p.provider_payment_id.startsWith("pi_"))
    .map((p) => ({
      intent: p.provider_payment_id as string,
      leftCents: Math.max(0, Number(p.amount_cents ?? 0) - (refundedByIntent.get(p.provider_payment_id as string) ?? 0)),
    }))
    .filter((p) => p.leftCents > 0);

  const paidCents = cents(invoice.amount_paid);
  const cardCents = Math.min(paidCents, cardPayments.reduce((s, p) => s + p.leftCents, 0));
  return { org, db, invoice, refunds: refunds ?? [], cardPayments, paidCents, cardCents, stripeAccountId: (orgRow?.stripe_account_id as string | null) ?? null };
}

export async function getRefundInfo(invoiceId: string): Promise<RefundInfo> {
  const ctx = await loadContext(invoiceId);
  return {
    paid: ctx.paidCents / 100,
    cardRefundable: ctx.stripeAccountId ? ctx.cardCents / 100 : 0,
    refunds: ctx.refunds.map((r) => ({ id: r.id, amount: Number(r.amount), method: r.method, reason: r.reason, createdAt: r.created_at })),
  };
}

/**
 * Refunds part or all of what a customer paid on an invoice.
 * - "card": sends the money back to the customer's card through the
 *   business's own Stripe account.
 * - "manual": only records a refund the business gave another way (cash,
 *   check, Square, Venmo). No money moves.
 */
export async function refundInvoice(
  invoiceId: string,
  input: { amount: number; method: "card" | "manual"; reason?: string },
): Promise<{ ok: true; refunded: number } | { ok: false; error: string }> {
  let ctx: Awaited<ReturnType<typeof loadContext>>;
  try {
    ctx = await loadContext(invoiceId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invoice not found." };
  }
  if (!["owner", "admin"].includes((ctx.org.role || "").toLowerCase())) {
    return { ok: false, error: "Only owners and admins can refund payments." };
  }
  const amountCents = cents(input.amount);
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, error: "Enter a refund amount." };
  if (amountCents > ctx.paidCents) return { ok: false, error: `You can refund up to $${(ctx.paidCents / 100).toFixed(2)} on this invoice.` };
  const reason = (input.reason ?? "").trim().slice(0, 500);

  if (input.method === "manual") {
    await applyRefund(ctx.db, { orgId: ctx.org.orgId, invoiceId, amountCents, method: "manual", reason, createdBy: ctx.org.userId });
    revalidatePath("/invoices");
    return { ok: true, refunded: amountCents / 100 };
  }

  if (!ctx.stripeAccountId) return { ok: false, error: "Stripe isn't connected for this business." };
  if (amountCents > ctx.cardCents) {
    return {
      ok: false,
      error: `Only $${(ctx.cardCents / 100).toFixed(2)} of this invoice was paid by card here. Record the rest as a refund you gave another way.`,
    };
  }

  let remaining = amountCents;
  let refunded = 0;
  try {
    for (const p of ctx.cardPayments) {
      if (remaining <= 0) break;
      const part = Math.min(remaining, p.leftCents);
      const refund = await stripe.refunds.create(
        {
          payment_intent: p.intent,
          amount: part,
          reason: "requested_by_customer",
          metadata: { invoice_id: invoiceId, org_id: ctx.org.orgId, redfox_reason: reason.slice(0, 200) },
        },
        { stripeAccount: ctx.stripeAccountId },
      );
      await applyRefund(ctx.db, {
        orgId: ctx.org.orgId,
        invoiceId,
        amountCents: part,
        method: "stripe",
        reason,
        stripeRefundId: refund.id,
        stripePaymentIntentId: p.intent,
        createdBy: ctx.org.userId,
      });
      remaining -= part;
      refunded += part;
    }
  } catch (e) {
    console.error("[refund] Stripe refund failed:", e);
    revalidatePath("/invoices");
    const msg = e instanceof Error ? e.message : "Stripe couldn't process the refund.";
    return {
      ok: false,
      error: refunded > 0 ? `Refunded $${(refunded / 100).toFixed(2)}, then Stripe stopped: ${msg}` : `Stripe couldn't process the refund: ${msg}`,
    };
  }
  revalidatePath("/invoices");
  return { ok: true, refunded: refunded / 100 };
}
