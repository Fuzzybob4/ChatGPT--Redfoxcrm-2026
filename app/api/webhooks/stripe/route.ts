import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// In-memory deduplication cache (expires after 24 hours in production, use Redis)
const processedEvents = new Map<string, number>();

export async function POST(req: Request) {
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe-webhook] Signature verification failed:", message);
    return NextResponse.json({ error: `Webhook signature invalid: ${message}` }, { status: 400 });
  }

  // Deduplication: check if we've processed this event ID recently
  const now = Date.now();
  const lastSeen = processedEvents.get(event.id);
  if (lastSeen && now - lastSeen < 60000) {
    // Within 60 seconds — likely a duplicate
    console.log(`[stripe-webhook] Duplicate event detected: ${event.id}, skipping`);
    return NextResponse.json({ received: true });
  }

  // Mark event as processed
  processedEvents.set(event.id, now);

  // Clean up old entries (> 24 hours)
  for (const [id, timestamp] of processedEvents.entries()) {
    if (now - timestamp > 86400000) {
      processedEvents.delete(id);
    }
  }

  // Process event and collect any errors
  let processingError: string | null = null;

  try {
    if (event.type === "checkout.session.completed") {
      processingError = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "invoice.paid") {
      processingError = await handleInvoicePaid(event.data.object as Stripe.Invoice);
    } else if (event.type === "customer.subscription.deleted") {
      processingError = await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
    }
  } catch (err: unknown) {
    processingError = err instanceof Error ? err.message : "Unknown error";
  }

  // If there was a critical error, return 500 so Stripe retries
  if (processingError) {
    console.error(`[stripe-webhook] Event ${event.type} (${event.id}) failed:`, processingError);
    return NextResponse.json({ error: processingError }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handles checkout.session.completed event.
 * Returns an error string if the operation failed, null on success.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<string | null> {
  // Strict validation of required metadata
  const invoiceId = session.metadata?.invoice_id;
  const orgId = session.metadata?.org_id;
  const customerId = session.metadata?.customer_id;

  if (!invoiceId || !orgId) {
    return `Invalid metadata: missing invoice_id or org_id. Got: ${JSON.stringify(session.metadata)}`;
  }

  // Validate payment status
  if (session.payment_status !== "paid") {
    return `Payment not completed. Status: ${session.payment_status}`;
  }

  // Validate amount
  if (!session.amount_total || session.amount_total <= 0) {
    return `Invalid amount: ${session.amount_total}`;
  }

  const amountPaid = session.amount_total / 100; // Convert from cents to dollars

  const supabase = createAdminClient();

  // Fetch the current invoice to validate before updating
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, org_id, total_amount, status, currency")
    .eq("id", invoiceId)
    .single();

  if (fetchErr || !invoice) {
    return `Invoice ${invoiceId} not found: ${fetchErr?.message ?? "unknown error"}`;
  }

  // Verify org ownership
  if (invoice.org_id !== orgId) {
    return `Org mismatch: invoice org_id ${invoice.org_id} != session org_id ${orgId}`;
  }

  // Verify amount matches (with small tolerance for rounding)
  const amountDiff = Math.abs(invoice.total_amount - amountPaid);
  if (amountDiff > 0.01) {
    return `Amount mismatch: invoice ${invoice.total_amount} != paid ${amountPaid}`;
  }

  // Don't re-mark already-paid invoices
  if (invoice.status === "paid") {
    console.log(`[stripe-webhook] Invoice ${invoiceId} already marked paid, skipping`);
    return null;
  }

  // Update the invoice with admin client (bypasses RLS)
  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      amount_paid: amountPaid,
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as { id?: string } | null)?.id ?? null,
    })
    .eq("id", invoiceId);

  if (updateErr) {
    return `Failed to mark invoice paid: ${updateErr.message}`;
  }

  console.log(`[stripe-webhook] Invoice ${invoiceId} marked as paid`);
  return null;
}

/**
 * Handles invoice.paid event (for subscription invoices).
 * Returns an error string if the operation failed, null on success.
 */
async function handleInvoicePaid(stripeInvoice: Stripe.Invoice): Promise<string | null> {
  const inv = stripeInvoice as unknown as Record<string, unknown>;
  const sub = inv.subscription;
  const subscriptionId = typeof sub === "string" ? sub : (sub as { id?: string } | null)?.id;

  if (!subscriptionId) {
    return `No subscription found on invoice ${stripeInvoice.id}`;
  }

  const supabase = createAdminClient();

  // Verify subscription exists before updating
  const { data: subscription, error: fetchErr } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (fetchErr || !subscription) {
    return `Subscription ${subscriptionId} not found: ${fetchErr?.message ?? "unknown error"}`;
  }

  // Don't re-activate already-active subscriptions
  if (subscription.status === "active") {
    console.log(`[stripe-webhook] Subscription ${subscriptionId} already active, skipping`);
    return null;
  }

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", subscriptionId);

  if (updateErr) {
    return `Failed to activate subscription: ${updateErr.message}`;
  }

  console.log(`[stripe-webhook] Subscription ${subscriptionId} activated`);
  return null;
}

/**
 * Handles customer.subscription.deleted event.
 * Returns an error string if the operation failed, null on success.
 */
async function handleSubscriptionCancelled(subscription: Stripe.Subscription): Promise<string | null> {
  const supabase = createAdminClient();

  // Verify subscription exists before updating
  const { data: sub, error: fetchErr } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (fetchErr || !sub) {
    return `Subscription ${subscription.id} not found: ${fetchErr?.message ?? "unknown error"}`;
  }

  // Don't re-cancel already-cancelled subscriptions
  if (sub.status === "cancelled") {
    console.log(`[stripe-webhook] Subscription ${subscription.id} already cancelled, skipping`);
    return null;
  }

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("stripe_subscription_id", subscription.id);

  if (updateErr) {
    return `Failed to cancel subscription: ${updateErr.message}`;
  }

  console.log(`[stripe-webhook] Subscription ${subscription.id} cancelled`);
  return null;
}
