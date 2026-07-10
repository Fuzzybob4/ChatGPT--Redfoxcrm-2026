'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import { stripe } from '@/lib/stripe';
import { getPlanChargeCents, getPlan, type BillingInterval } from '@/lib/pricing';

/**
 * Charges the card we saved at signup for the base subscription, using the
 * chosen billing interval, then activates the subscription. This runs the
 * card off-session (no re-entry required) since it's already on file.
 */
export async function chargeSubscription(
  interval: BillingInterval,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: 'Not authenticated' };

  const supabase = await createClient();

  // Pull the Stripe customer + saved card directly from the org row.
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('stripe_customer_id, default_payment_method_id, plan')
    .eq('id', org.orgId)
    .single();

  if (!orgRow?.stripe_customer_id || !orgRow?.default_payment_method_id) {
    return {
      ok: false,
      error: 'No card on file. Please contact support to add a payment method.',
    };
  }

  const planId = orgRow.plan ?? 'starter';
  const amountCents = getPlanChargeCents(planId, interval);
  const planName = getPlan(planId).name;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: orgRow.stripe_customer_id,
      payment_method: orgRow.default_payment_method_id,
      off_session: true,
      confirm: true,
      description: `RedFox CRM ${planName} plan (${interval})`,
    });

    if (paymentIntent.status !== 'succeeded') {
      return { ok: false, error: 'Payment could not be completed. Please try another card.' };
    }

    // Record the charge.
    await supabase.from('subscription_charges').insert({
      org_id: org.orgId,
      kind: 'subscription',
      amount_cents: amountCents,
      interval,
      description: `${planName} plan (${interval})`,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'succeeded',
    });

    // Advance the billing period and activate.
    const periodEnd = new Date();
    if (interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await supabase
      .from('organizations')
      .update({
        subscription_status: 'active',
        subscription_interval: interval,
        subscription_current_period_end: periodEnd.toISOString(),
      })
      .eq('id', org.orgId);

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    // Stripe throws for declined/authentication-required off-session charges.
    const msg =
      e instanceof Error ? e.message : 'Your card was declined. Please try another card.';
    return { ok: false, error: msg };
  }
}
