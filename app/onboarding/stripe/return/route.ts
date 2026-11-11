import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentOrg } from '@/lib/org';
import { stripe } from '@/lib/stripe';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const orgId = searchParams.get('org');

  // Only a member of this business may refresh its Stripe status.
  const current = await getCurrentOrg();
  if (orgId && current?.orgId === orgId) {
    const db = createAdminClient();
    const { data: org } = await db
      .from('organizations')
      .select('stripe_account_id')
      .eq('id', orgId)
      .single();

    if (org?.stripe_account_id) {
      try {
        const account = await stripe.accounts.retrieve(org.stripe_account_id);
        await db
          .from('organizations')
          .update({
            stripe_charges_enabled: account.charges_enabled,
            stripe_payouts_enabled: account.payouts_enabled,
            stripe_onboarding_completed: account.details_submitted,
            stripe_account_status: account.charges_enabled ? 'active' : 'pending',
            payment_provider: 'stripe',
          })
          .eq('id', orgId);
      } catch {
        // Ignore retrieval failures; the user can retry from settings.
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
