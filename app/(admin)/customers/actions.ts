'use server';

import { requireAdmin, logAdminAction, hasPermission } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { ADDONS } from '@/lib/pricing';

export async function grantLifetimeAccess(orgId: string, orgName: string) {
  const admin = await requireAdmin('lifetime_access');
  const db = createAdminClient();

  const { data: before } = await db
    .from('organizations')
    .select('lifetime_access, plan, subscription_status')
    .eq('id', orgId)
    .single();

  await db.from('organizations').update({
    lifetime_access: true,
    lifetime_granted_at: new Date().toISOString(),
    lifetime_granted_by: admin.userId,
    subscription_status: 'active',
  }).eq('id', orgId);

  await logAdminAction({
    adminUser: admin,
    action: 'grant_lifetime_access',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: orgName,
    oldValue: before ?? {},
    newValue: { lifetime_access: true },
  });

  revalidatePath('/admin/customers');
}

export async function revokeLifetimeAccess(orgId: string, orgName: string) {
  const admin = await requireAdmin('lifetime_access');
  const db = createAdminClient();

  await db.from('organizations').update({
    lifetime_access: false,
    lifetime_granted_at: null,
    lifetime_granted_by: null,
  }).eq('id', orgId);

  await logAdminAction({
    adminUser: admin,
    action: 'revoke_lifetime_access',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: orgName,
    oldValue: { lifetime_access: true },
    newValue: { lifetime_access: false },
  });

  revalidatePath('/admin/customers');
}

export async function overridePlan(orgId: string, orgName: string, newPlan: string) {
  const admin = await requireAdmin('plan_override');
  const db = createAdminClient();

  const { data: before } = await db
    .from('organizations')
    .select('plan, admin_plan_override')
    .eq('id', orgId)
    .single();

  await db.from('organizations').update({
    plan: newPlan,
    admin_plan_override: newPlan,
  }).eq('id', orgId);

  await logAdminAction({
    adminUser: admin,
    action: 'override_plan',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: orgName,
    oldValue: { plan: before?.plan },
    newValue: { plan: newPlan },
  });

  revalidatePath('/admin/customers');
}

export async function extendTrial(orgId: string, orgName: string, days: number) {
  const admin = await requireAdmin('plan_override');
  const db = createAdminClient();

  const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data: before } = await db
    .from('organizations')
    .select('trial_ends_at')
    .eq('id', orgId)
    .single();

  await db.from('organizations').update({
    trial_ends_at: newExpiry,
    subscription_status: 'trialing',
  }).eq('id', orgId);

  await logAdminAction({
    adminUser: admin,
    action: 'extend_trial',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: orgName,
    oldValue: { trial_ends_at: before?.trial_ends_at },
    newValue: { trial_ends_at: newExpiry, extended_days: days },
  });

  revalidatePath('/admin/customers');
}

export async function saveAdminNotes(orgId: string, notes: string) {
  const admin = await requireAdmin('customers');
  const db = createAdminClient();

  await db.from('organizations').update({ admin_notes: notes }).eq('id', orgId);

  await logAdminAction({
    adminUser: admin,
    action: 'update_admin_notes',
    targetType: 'organization',
    targetId: orgId,
  });

  revalidatePath('/admin/customers');
}

export async function toggleAddon(orgId: string, orgName: string, addonId: string, enable: boolean) {
  const admin = await requireAdmin('plan_override');
  const db = createAdminClient();

  const { data: org } = await db
    .from('organizations')
    .select('active_addons')
    .eq('id', orgId)
    .single();

  const current: string[] = (org?.active_addons as string[]) ?? [];
  const updated = enable
    ? [...new Set([...current, addonId])]
    : current.filter((a) => a !== addonId);

  await db.from('organizations').update({ active_addons: updated }).eq('id', orgId);

  await logAdminAction({
    adminUser: admin,
    action: enable ? 'enable_addon' : 'disable_addon',
    targetType: 'organization',
    targetId: orgId,
    targetLabel: orgName,
    oldValue: { active_addons: current },
    newValue: { active_addons: updated },
  });

  revalidatePath('/admin/customers');
}
