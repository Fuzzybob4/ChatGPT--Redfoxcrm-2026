import { createClient } from '@/lib/supabase/server';

export interface OrgMembership {
  userId: string;
  orgId: string;
  role: string;
  orgName: string;
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
    .select('user_id, org_id, role, organizations(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  // organizations may come back as an object or array depending on the join
  const orgRel = membership.organizations as unknown;
  const orgName =
    Array.isArray(orgRel)
      ? (orgRel[0]?.name ?? '')
      : ((orgRel as { name?: string })?.name ?? '');

  return {
    userId: membership.user_id,
    orgId: membership.org_id,
    role: membership.role,
    orgName,
  };
}
