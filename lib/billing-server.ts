import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { ensurePlanPrice } from '@/lib/stripe/plans';
import { getPlanChargeCents, getPlan, getPlanLocationLimit, type BillingInterval, type PlanId } from '@/lib/pricing';

/**
 * Start (or reconcile) the Stripe subscription for a business using the card
 * on file. Any remaining free-trial time is passed to Stripe as trial_end, so
 * Stripe charges the card automatically when the trial is over.
 */
export async function startSubscriptionForOrg(
  orgId: string,
  userId: string,
  interval: BillingInterval = 'monthly',
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from('organizations')
    .select('stripe_customer_id, default_payment_method_id, plan, trial_ends_at, lifetime_access')
    .eq('id', orgId)
    .single();
  if (!orgRow) return { ok: false, error: 'Business not found.' };
  if (orgRow.lifetime_access) return { ok: true, status: 'lifetime' };
  if (!orgRow.stripe_customer_id || !orgRow.default_payment_method_id) {
    return { ok: false, error: 'No card on file yet.' };
  }

  const planId = (orgRow.plan ?? 'starter') as PlanId;
  try {
    const existing = await stripe.subscriptions.list({ customer: orgRow.stripe_customer_id, status: 'all', limit: 10 });
    const live = existing.data.find((s) => ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status));
    if (live) {
      await reconcileSubscriptionToDb(live, orgId, userId, planId, interval);
      return { ok: true, status: live.status };
    }

    const priceId = await ensurePlanPrice(planId, interval);
    const trialEnd = orgRow.trial_ends_at ? new Date(orgRow.trial_ends_at).getTime() : 0;
    // Stripe needs trial_end at least ~48h out to be safe; shorter trials just start now.
    const trialEndUnix = trialEnd > Date.now() + 60 * 60 * 1000 ? Math.floor(trialEnd / 1000) : undefined;

    const subscription = await stripe.subscriptions.create({
      customer: orgRow.stripe_customer_id,
      items: [{ price: priceId }],
      default_payment_method: orgRow.default_payment_method_id,
      trial_end: trialEndUnix,
      payment_behavior: 'allow_incomplete',
      metadata: { org_id: orgId, redfox_plan: planId, redfox_interval: interval },
    });

    await reconcileSubscriptionToDb(subscription, orgId, userId, planId, interval);
    await admin
      .from('organizations')
      .update({
        subscription_status: subscription.status === 'trialing' ? 'trialing' : subscription.status === 'active' ? 'active' : subscription.status,
        subscription_interval: interval,
        max_locations: getPlanLocationLimit(planId),
        subscription_current_period_end: periodEndIso(subscription),
      })
      .eq('id', orgId);
    await admin.from('subscription_charges').insert({
      org_id: orgId,
      kind: 'subscription',
      amount_cents: getPlanChargeCents(planId, interval),
      interval,
      description: `${getPlan(planId).name} plan (${interval}) — Stripe subscription`,
      status: subscription.status === 'trialing' ? 'pending' : 'succeeded',
    });
    return { ok: true, status: subscription.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not start the subscription.' };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Reads the current-period end from a Stripe subscription as an ISO string.
 * In recent Stripe API versions the period lives on the subscription ITEM, so
 * we check the item first and fall back to the (legacy) top-level field.
 */
export function periodEndIso(sub: unknown): string | null {
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
export async function reconcileSubscriptionToDb(
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
