'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import { getPlanLocationLimit } from '@/lib/pricing';

export async function createOrganizationLocation(input: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: 'Not authenticated' };

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Location name is required.' };
  if (name.length > 120) return { ok: false, error: 'Location name is too long.' };

  const limit = getPlanLocationLimit(org.plan);
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.orgId);
  if (countError) return { ok: false, error: 'Could not verify your location allowance.' };
  if (limit !== null && (count ?? 0) >= limit) {
    return { ok: false, error: `Your ${org.plan ?? 'starter'} plan allows ${limit} location${limit === 1 ? '' : 's'}. Upgrade to add another location.` };
  }

  const { data, error } = await supabase
    .from('locations')
    .insert({
      org_id: org.orgId,
      name,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip_code: input.zipCode?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: 'Could not create this location.' };
  revalidatePath('/dashboard/multi-location');
  revalidatePath('/', 'layout');
  return { ok: true, id: data.id };
}
