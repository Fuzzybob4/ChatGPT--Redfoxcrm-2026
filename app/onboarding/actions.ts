'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { getCurrentOrg } from '@/lib/org';
import { startSubscriptionForOrg } from '@/lib/billing-server';

async function getOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

export interface BusinessDetailsInput {
  businessName: string;
  businessType?: string;
  vertical?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/**
 * Creates the organization, the owner membership, the business profile, and an
 * onboarding_state row for a brand-new business. Returns the new org id.
 */
export async function createOrganization(
  input: BusinessDetailsInput,
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  // Reuse an existing membership if the user already has one (idempotent).
  const { data: existing } = await supabase
    .from('user_memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let orgId = existing?.org_id as string | undefined;

  if (!orgId) {
    // Card + plan details captured at signup live in the user's auth metadata.
    const meta = (user.user_metadata ?? {}) as Record<string, string>;
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const plan = meta.plan === 'enterprise' || meta.plan === 'professional' ? meta.plan : 'starter';
    const requestedLocations = Math.min(100, Math.max(1, Number.parseInt(meta.location_count ?? '1', 10) || 1));
    const maxLocations = plan === 'starter' ? 1 : plan === 'professional' ? requestedLocations : requestedLocations;
    const subscriptionInterval = meta.billing_interval === 'yearly' ? 'yearly' : 'monthly';

    // Only trust the card from signup if that Stripe customer was really created
    // for this person's email (signup details live in user-editable metadata).
    let stripeCustomerId: string | null = null;
    let paymentMethodId: string | null = null;
    if (meta.stripe_customer_id && meta.default_payment_method_id) {
      try {
        const customer = await stripe.customers.retrieve(meta.stripe_customer_id);
        const pm = await stripe.paymentMethods.retrieve(meta.default_payment_method_id);
        const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
        const sameEmail =
          !('deleted' in customer && customer.deleted) &&
          (customer as { email?: string | null }).email?.toLowerCase() === user.email?.toLowerCase();
        const { count } = await createAdminClient()
          .from('organizations')
          .select('id', { count: 'exact', head: true })
          .eq('stripe_customer_id', meta.stripe_customer_id);
        if (sameEmail && pmCustomer === meta.stripe_customer_id && !count) {
          stripeCustomerId = meta.stripe_customer_id;
          paymentMethodId = meta.default_payment_method_id;
        }
      } catch {
        /* card can be added later from Billing */
      }
    }

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name: input.businessName,
        owner_user_id: user.id,
        vertical: input.vertical ?? null,
        plan,
        location_count: 0,
        max_locations: maxLocations,
        subscription_interval: subscriptionInterval,
        trial_ends_at: trialEndsAt,
        subscription_status: 'trialing',
        stripe_customer_id: stripeCustomerId,
        default_payment_method_id: paymentMethodId,
        card_brand: paymentMethodId ? meta.card_brand ?? null : null,
        card_last4: paymentMethodId ? meta.card_last4 ?? null : null,
      })
      .select('id')
      .single();
    if (orgErr || !org) return { ok: false, error: orgErr?.message ?? 'Failed to create organization' };
    orgId = org.id;

    const { error: memErr } = await supabase.from('user_memberships').insert({
      user_id: user.id,
      org_id: orgId,
      role: 'owner',
    });
    if (memErr) return { ok: false, error: memErr.message };

    // Start the Stripe subscription now with the 30-day trial built in, so the
    // card is charged automatically when the trial ends (as the Terms say).
    if (stripeCustomerId && paymentMethodId) {
      const started = await startSubscriptionForOrg(orgId!, user.id, subscriptionInterval);
      if (!started.ok) console.error('[onboarding] subscription not started:', started.error);
    }
  }

  // Upsert business profile for this org.
  const { error: bpErr } = await supabase.from('business_profiles').insert({
    org_id: orgId,
    business_name: input.businessName,
    business_type: input.businessType ?? null,
    industry: input.vertical ?? null,
    phone: input.phone ?? null,
    email: input.email ?? user.email ?? null,
    website: input.website ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zip_code: input.zipCode ?? null,
  });
  // Ignore duplicate-profile errors so the step is idempotent.
  if (bpErr && !/duplicate|unique/i.test(bpErr.message)) {
    return { ok: false, error: bpErr.message };
  }

  if (!orgId) return { ok: false, error: 'Failed to resolve organization' };

  await supabase
    .from('onboarding_state')
    .upsert({ user_id: user.id, org_id: orgId, current_step: 2 }, { onConflict: 'user_id' });

  return { ok: true, orgId };
}

/**
 * Records the chosen payment provider. Square & QuickBooks are stored as a
 * selection only (real OAuth connection is set up later).
 */
export async function setPaymentProvider(
  orgId: string,
  provider: 'stripe' | 'square' | 'quickbooks' | 'none',
): Promise<{ ok: boolean; error?: string }> {
  const currentOrg = await getCurrentOrg();
  if (!currentOrg || currentOrg.orgId !== orgId) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update({ payment_provider: provider })
    .eq('id', orgId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Starts Stripe Connect onboarding for the org and returns a hosted
 * onboarding URL. Falls back gracefully if Connect is not enabled on the
 * platform account.
 *
 * Businesses get a Standard account: their own full Stripe account (they can
 * also log in to stripe.com). Stripe and the business, not Red Fox, are
 * responsible for refunds, disputes, chargebacks and negative balances, and
 * the business pays its own Stripe fees. Customer payments are direct charges
 * on the business's account, so Red Fox never holds their money.
 */
export async function startStripeConnect(
  orgId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const currentOrg = await getCurrentOrg();
  if (!currentOrg || currentOrg.orgId !== orgId) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, stripe_account_id')
    .eq('id', orgId)
    .single();
  if (!org) return { ok: false, error: 'Organization not found' };

  try {
    let accountId = org.stripe_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        business_profile: { name: org.name ?? undefined },
        metadata: { redfox_org_id: orgId },
      });
      accountId = account.id;
      // Payment-account columns are server-only; the caller was checked above.
      await createAdminClient()
        .from('organizations')
        .update({ stripe_account_id: accountId, payment_provider: 'stripe' })
        .eq('id', orgId);
    }

    const origin = await getOrigin();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/onboarding?stripe=refresh`,
      return_url: `${origin}/onboarding/stripe/return?org=${orgId}`,
      type: 'account_onboarding',
    });
    return { ok: true, url: link.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe Connect is not available';
    return { ok: false, error: msg };
  }
}
