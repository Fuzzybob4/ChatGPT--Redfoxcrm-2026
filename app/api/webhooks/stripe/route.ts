import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

  // Only process events we care about — all others get a 200 immediately
  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  } else if (event.type === "invoice.paid") {
    await handleInvoicePaid(event.data.object as Stripe.Invoice);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
  }

  return NextResponse.json({ received: true });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = await createClient();

  // We store our internal invoice id in the metadata when creating checkout sessions
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) return;

  const amountPaid = (session.amount_total ?? 0) / 100; // Stripe stores in cents

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      amount_paid: amountPaid,
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    })
    .eq("id", invoiceId);

  if (error) {
    console.error("[stripe-webhook] Failed to mark invoice paid:", error.message);
  }
}

async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  // Stripe invoices (subscriptions) — update subscription status
  const supabase = await createClient();

  // Use a cast to handle Stripe SDK version differences in the Invoice type
  const inv = stripeInvoice as unknown as Record<string, unknown>;
  const sub = inv.subscription;
  const subscriptionId = typeof sub === "string" ? sub : (sub as { id?: string } | null)?.id;

  if (!subscriptionId) return;

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("[stripe-webhook] Failed to update subscription:", error.message);
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("[stripe-webhook] Failed to cancel subscription:", error.message);
  }
}
