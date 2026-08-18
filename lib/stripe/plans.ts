import 'server-only';
import { stripe } from '@/lib/stripe';
import { getPlan, getPlanChargeCents, type BillingInterval, type PlanId } from '@/lib/pricing';

/**
 * Maps a RedFox plan + interval to a stable Stripe Price "lookup_key".
 * Using lookup keys lets us find (or lazily create) the recurring Price for a
 * plan without hardcoding Stripe price IDs across environments/sandboxes.
 */
export function planLookupKey(planId: PlanId, interval: BillingInterval): string {
  return `redfox_${planId}_${interval}`;
}

const RECURRING: Record<BillingInterval, { interval: 'month' | 'year' }> = {
  monthly: { interval: 'month' },
  yearly: { interval: 'year' },
};

/**
 * Ensures a recurring Stripe Price exists for the given plan + interval and
 * returns its price id. Idempotent: looks up by lookup_key first, and only
 * creates the Product/Price when missing. The amount always comes from
 * lib/pricing (server-side source of truth) so it can never be tampered with.
 */
export async function ensurePlanPrice(
  planId: PlanId,
  interval: BillingInterval,
): Promise<string> {
  const lookupKey = planLookupKey(planId, interval);

  // 1. Reuse an existing active price with this lookup key.
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;

  // 2. Find or create the Product for this plan.
  const plan = getPlan(planId);
  const productSearch = await stripe.products.search({
    query: `metadata['redfox_plan']:'${planId}'`,
    limit: 1,
  });
  const product =
    productSearch.data[0] ??
    (await stripe.products.create({
      name: `RedFox CRM ${plan.name}`,
      metadata: { redfox_plan: planId },
    }));

  // 3. Create the recurring price (amount from server-side pricing).
  const amount = getPlanChargeCents(planId, interval);
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval: RECURRING[interval].interval },
    lookup_key: lookupKey,
    metadata: { redfox_plan: planId, redfox_interval: interval },
  });

  return price.id;
}
