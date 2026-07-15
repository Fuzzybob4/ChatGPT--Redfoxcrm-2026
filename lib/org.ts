import { createClient } from '@/lib/supabase/server';

export interface OrgMembership {
  userId: string;
  orgId: string;
  role: string;
  orgName: string;
  businessName: string;
  isEnterprise: boolean;
  locationCount: number;
  plan: string;
  trialEndsAt: string | null;
  subscriptionStatus: string;
  subscriptionInterval: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  addonIds: string[];
}

/**
 * Resolves the currently authenticated user and their organization membership.
 * Returns null if not authenticated or if the user has no membership yet
 * (i.e. a brand-new business that still needs onboarding).
 */
export async function getCurrentOrg(): Promise<OrgMembership | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('user_memberships')
    .select(
      'user_id, org_id, role, organizations(name, is_enterprise, location_count, plan, trial_ends_at, subscription_status, subscription_interval, subscription_current_period_end, card_brand, card_last4, active_addons)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  // organizations may come back as an object or array depending on the join
  const orgRel = membership.organizations as unknown;
  const orgData = Array.isArray(orgRel) ? orgRel[0] : (orgRel as any);
  const orgName = orgData?.name ?? '';
  const isEnterprise = orgData?.is_enterprise ?? false;
  const locationCount = orgData?.location_count ?? 1;

  // Fetch business profile for the org
  const { data: businessProfile } = await supabase
    .from('business_profiles')
    .select('business_name')
    .eq('org_id', membership.org_id)
    .maybeSingle();

  return {
    userId: membership.user_id,
    orgId: membership.org_id,
    role: membership.role,
    orgName,
    businessName: businessProfile?.business_name ?? orgName,
    isEnterprise,
    locationCount,
    plan: orgData?.plan ?? 'starter',
    trialEndsAt: orgData?.trial_ends_at ?? null,
    subscriptionStatus: orgData?.subscription_status ?? 'trialing',
    subscriptionInterval: orgData?.subscription_interval ?? null,
    subscriptionCurrentPeriodEnd: orgData?.subscription_current_period_end ?? null,
    cardBrand: orgData?.card_brand ?? null,
    cardLast4: orgData?.card_last4 ?? null,
    addonIds: (orgData?.active_addons as string[] | null) ?? [],
  };
}
