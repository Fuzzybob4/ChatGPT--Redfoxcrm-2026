'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentOrg } from '@/lib/org';
import { stripe } from '@/lib/stripe';
import { ensurePlanPrice } from '@/lib/stripe/plans';
import { getPlanChargeCents, getPlan, getPlanLocationLimit, type BillingInterval, type PlanId } from '@/lib/pricing';

/**
 * Creates a TRUE Stripe Subscription for the org using the card saved at
 * signup, then records it in the `subscriptions` table. Stripe becomes the
 * source of truth: recurring billing, invoices, proration, and dunning are all
 * handled by Stripe, and our DB is reconciled via webhooks.
 *
 * If the org is still within its free trial, the subscription is created with
 * `trial_end` so the first charge happens automatically when the trial ends.
 */
export async function startSubscription(
  interval: BillingInterval,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: 'Not authenticated' };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  // Pull the Stripe customer + saved card + trial info from the org row.
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('stripe_customer_id, default_payment_method_id, plan, trial_ends_at, subscription_status')
    .eq('id', org.orgId)
    .single();

  if (!orgRow?.stripe_customer_id || !orgRow?.default_payment_method_id) {
    return {
      ok: false,
      error: 'No card on file. Please contact support to add a payment method.',
    };
  }

  const planId = (orgRow.plan ?? 'starter') as PlanId;
  const planName = getPlan(planId).name;
  const amountCents = getPlanChargeCents(planId, interval);

  try {
    // Idempotency guard: if an active/trialing Stripe subscription already
    // exists for this customer, don't create a second one.
    const existingSubs = await stripe.subscriptions.list({
      customer: orgRow.stripe_customer_id,
      status: 'all',
      limit: 10,
    });
    const live = existingSubs.data.find((s) =>
      ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status),
    );
    if (live) {
      // Already subscribed — just reconcile our DB and return success.
      await reconcileSubscriptionToDb(live, org.orgId, user.id, planId, interval);
      revalidatePath('/', 'layout');
      return { ok: true };
    }

    const priceId = await ensurePlanPrice(planId, interval);

    // Honor remaining trial time (Stripe expects a unix timestamp in seconds).
    const trialEndsAt = orgRow.trial_ends_at ? new Date(orgRow.trial_ends_at) : null;
    const trialEndUnix =
      trialEndsAt && trialEndsAt.getTime() > Date.now()
        ? Math.floor(trialEndsAt.getTime() / 1000)
        : undefined;

    const subscription = await stripe.subscriptions.create({
      customer: orgRow.stripe_customer_id,
      items: [{ price: priceId }],
      default_payment_method: orgRow.default_payment_method_id,
      trial_end: trialEndUnix,
      // If the (post-trial) payment fails, keep the subscription so dunning can retry.
      payment_behavior: 'allow_incomplete',
      metadata: { org_id: org.orgId, redfox_plan: planId, redfox_interval: interval },
    });

    await reconcileSubscriptionToDb(subscription, org.orgId, user.id, planId, interval);

    // Mirror high-level status onto the org row for quick reads.
    await supabase
      .from('organizations')
      .update({
        subscription_status: subscription.status === 'trialing' ? 'trialing' : 'active',
        subscription_interval: interval,
        max_locations: getPlanLocationLimit(planId),
        subscription_current_period_end: periodEndIso(subscription),
      })
      .eq('id', org.orgId);

    // Record the intent to charge (actual paid charges are logged via webhook).
    await supabase.from('subscription_charges').insert({
      org_id: org.orgId,
      kind: 'subscription',
      amount_cents: amountCents,
      interval,
      description: `${planName} plan (${interval}) — Stripe subscription`,
      status: subscription.status === 'trialing' ? 'pending' : 'succeeded',
    });

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not start your subscription. Please try another card.';
    return { ok: false, error: msg };
  }
}

/** Cancels the org's Stripe subscription at period end (keeps access until then). */
export async function cancelSubscription(): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: 'Not authenticated' };

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('org_id', org.orgId)
    .not('stripe_subscription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return { ok: false, error: 'No active subscription found.' };
  }

  try {
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    await supabase
      .from('subscriptions')
      .update({ cancel_at: periodEndIso(updated), updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.stripe_subscription_id);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not cancel the subscription.';
    return { ok: false, error: msg };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Reads the current-period end from a Stripe subscription as an ISO string.
 * In recent Stripe API versions the period lives on the subscription ITEM, so
 * we check the item first and fall back to the (legacy) top-level field.
 */
function periodEndIso(sub: unknown): string | null {
  const s = sub as {
    current_period_end?: number | null;
    items?: { data?: Array<{ current_period_end?: number | null }> };
  };
  const end = s.items?.data?.[0]?.current_period_end ?? s.current_period_end ?? null;
  return end ? new Date(end * 1000).toISOString() : null;
}

/**
 * Upserts a Stripe subscription into our `subscriptions` table (source of
 * truth stays Stripe; this is our local mirror keyed on stripe_subscription_id).
 * Uses the admin client so it works from both user actions and webhooks.
 */
async function reconcileSubscriptionToDb(
  subInput: unknown,
  orgId: string,
  userId: string,
  planId: PlanId,
  interval: BillingInterval,
) {
  const sub = subInput as {
    id: string;
    status: string;
    customer: string | { id: string };
    current_period_start?: number | null;
    current_period_end?: number | null;
    trial_start?: number | null;
    trial_end?: number | null;
    items?: { data: Array<{ price?: { id?: string }; current_period_start?: number | null; current_period_end?: number | null }> };
  };
  const admin = createAdminClient();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const periodStart = item?.current_period_start ?? sub.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;
  const toIso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

  await admin
    .from('subscriptions')
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        plan_type: planId,
        billing_period: interval,
        status: sub.status,
        stripe_subscription_id: sub.id,
        stripe_customer_id: customerId,
        stripe_price_id: priceId,
        amount: getPlanChargeCents(planId, interval) / 100,
        currency: 'USD',
        current_period_start: toIso(periodStart),
        current_period_end: toIso(periodEnd),
        trial_start: toIso(sub.trial_start),
        trial_end: toIso(sub.trial_end),
        renewal_date: toIso(periodEnd),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' },
    );
}
