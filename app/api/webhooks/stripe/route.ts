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
    } else if (event.type === "invoice.payment_failed") {
      processingError = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      processingError = await handleSubscriptionChanged(
        event.data.object as Stripe.Subscription,
        event.type,
      );
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
    .select("id, org_id, status")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (fetchErr || !subscription) {
    return `Subscription ${subscriptionId} not found: ${fetchErr?.message ?? "unknown error"}`;
  }

  const { error: updateErr } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      last_webhook_event: new Date().toISOString(),
      last_webhook_event_type: "invoice.paid",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (updateErr) {
    return `Failed to activate subscription: ${updateErr.message}`;
  }

  // Keep the org row's high-level status in sync.
  await supabase
    .from("organizations")
    .update({ subscription_status: "active" })
    .eq("id", subscription.org_id);

  // Record the successful recurring charge (idempotent on the Stripe invoice id).
  const amountCents = typeof stripeInvoice.amount_paid === "number" ? stripeInvoice.amount_paid : 0;
  if (amountCents > 0) {
    const existing = await supabase
      .from("subscription_charges")
      .select("id")
      .eq("stripe_payment_intent_id", stripeInvoice.id ?? "")
      .maybeSingle();
    if (!existing.data) {
      await supabase.from("subscription_charges").insert({
        org_id: subscription.org_id,
        kind: "subscription",
        amount_cents: amountCents,
        description: "Recurring subscription payment",
        stripe_payment_intent_id: stripeInvoice.id ?? null,
        status: "succeeded",
      });
    }
  }

  console.log(`[stripe-webhook] Subscription ${subscriptionId} invoice paid & activated`);
  return null;
}

/**
 * Handles invoice.payment_failed — puts the subscription into `past_due` so the
 * UI can prompt the user to update their card (Stripe handles dunning retries).
 */
async function handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice): Promise<string | null> {
  const inv = stripeInvoice as unknown as Record<string, unknown>;
  const sub = inv.subscription;
  const subscriptionId = typeof sub === "string" ? sub : (sub as { id?: string } | null)?.id;
  if (!subscriptionId) return null; // Not a subscription invoice — ignore.

  const supabase = createAdminClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, org_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!subscription) return null;

  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      last_webhook_event: new Date().toISOString(),
      last_webhook_event_type: "invoice.payment_failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  await supabase
    .from("organizations")
    .update({ subscription_status: "past_due" })
    .eq("id", subscription.org_id);

  console.log(`[stripe-webhook] Subscription ${subscriptionId} marked past_due`);
  return null;
}

/**
 * Handles customer.subscription.created / updated — mirrors Stripe's canonical
 * status and period dates into our local `subscriptions` + `organizations` rows.
 */
async function handleSubscriptionChanged(
  subscription: Stripe.Subscription,
  eventType: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const s = subscription as unknown as {
    id: string;
    status: string;
    current_period_start?: number | null;
    current_period_end?: number | null;
    trial_start?: number | null;
    trial_end?: number | null;
    cancel_at_period_end?: boolean;
    cancel_at?: number | null;
    items?: { data?: Array<{ current_period_start?: number | null; current_period_end?: number | null }> };
  };
  const toIso = (v?: number | null) => (v ? new Date(v * 1000).toISOString() : null);
  // Stripe v22 exposes the period on the subscription item; fall back to top-level.
  const item0 = s.items?.data?.[0];
  const periodStart = item0?.current_period_start ?? s.current_period_start ?? null;
  const periodEnd = item0?.current_period_end ?? s.current_period_end ?? null;

  const { data: row } = await supabase
    .from("subscriptions")
    .select("id, org_id")
    .eq("stripe_subscription_id", s.id)
    .maybeSingle();

  // If we don't have this subscription yet (e.g. created out of band), ignore
  // — startSubscription() is responsible for the initial insert with org/user.
  if (!row) {
    console.log(`[stripe-webhook] ${eventType}: subscription ${s.id} not in DB yet, skipping`);
    return null;
  }

  await supabase
    .from("subscriptions")
    .update({
      status: s.status,
      current_period_start: toIso(periodStart),
      current_period_end: toIso(periodEnd),
      renewal_date: toIso(periodEnd),
      trial_start: toIso(s.trial_start),
      trial_end: toIso(s.trial_end),
      cancel_at: s.cancel_at_period_end ? toIso(s.cancel_at ?? periodEnd) : null,
      last_webhook_event: new Date().toISOString(),
      last_webhook_event_type: eventType,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", s.id);

  // Mirror onto the org (active/trialing/past_due/etc.).
  await supabase
    .from("organizations")
    .update({
      subscription_status: s.status === "trialing" ? "trialing" : s.status === "active" ? "active" : s.status,
      subscription_current_period_end: toIso(periodEnd),
    })
    .eq("id", row.org_id);

  console.log(`[stripe-webhook] ${eventType}: subscription ${s.id} synced (${s.status})`);
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
    .select("id, org_id, status")
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
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      last_webhook_event: new Date().toISOString(),
      last_webhook_event_type: "customer.subscription.deleted",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (updateErr) {
    return `Failed to cancel subscription: ${updateErr.message}`;
  }

  // Reflect the cancellation on the org row.
  await supabase
    .from("organizations")
    .update({ subscription_status: "cancelled" })
    .eq("id", sub.org_id);

  console.log(`[stripe-webhook] Subscription ${subscription.id} cancelled`);
  return null;
}
