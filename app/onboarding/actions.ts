'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

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

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name: input.businessName,
        owner_user_id: user.id,
        vertical: input.vertical ?? null,
        plan: meta.plan ?? 'starter',
        trial_ends_at: trialEndsAt,
        subscription_status: 'trialing',
        stripe_customer_id: meta.stripe_customer_id ?? null,
        default_payment_method_id: meta.default_payment_method_id ?? null,
        card_brand: meta.card_brand ?? null,
        card_last4: meta.card_last4 ?? null,
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
  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update({ payment_provider: provider })
    .eq('id', orgId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Starts Stripe Connect Express onboarding for the org and returns a hosted
 * onboarding URL. Falls back gracefully if Connect is not enabled on the
 * platform account.
 */
export async function startStripeConnect(
  orgId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
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
        type: 'express',
        business_profile: { name: org.name ?? undefined },
      });
      accountId = account.id;
      await supabase
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
