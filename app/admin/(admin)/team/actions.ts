'use server';

import { requireAdmin, logAdminAction, type AdminRole } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const VALID_ROLES: AdminRole[] = ['ceo', 'cto', 'marketing', 'sales', 'accounting', 'customer_service'];

export async function inviteAdminMember(formData: FormData) {
  const admin = await requireAdmin('team');
  const db = createAdminClient();

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const name = (formData.get('name') as string)?.trim();
  const role = formData.get('role') as AdminRole;

  if (!email || !name || !role || !VALID_ROLES.includes(role)) {
    throw new Error('Invalid invite data');
  }

  // Create Supabase auth user with a temporary password
  const { data: newUser, error: userError } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name, admin_role: role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.redfoxcrm.com'}/admin/login`,
  });

  if (userError || !newUser.user) {
    throw new Error(userError?.message ?? 'Failed to invite user');
  }

  // Add to platform_admins
  await db.from('platform_admins').insert({
    user_id: newUser.user.id,
    role,
    name,
    email,
    is_active: true,
  });

  await logAdminAction({
    adminUser: admin,
    action: 'invite_admin',
    targetType: 'platform_admin',
    targetId: newUser.user.id,
    targetLabel: `${name} (${email})`,
    newValue: { role, email, name },
  });

  revalidatePath('/admin/team');
}

export async function deactivateAdmin(userId: string, targetName: string) {
  const admin = await requireAdmin('team');
  if (userId === admin.userId) throw new Error('Cannot deactivate yourself');

  const db = createAdminClient();
  await db.from('platform_admins').update({ is_active: false }).eq('user_id', userId);
  await db.auth.admin.updateUserById(userId, { ban_duration: '876000h' });

  await logAdminAction({
    adminUser: admin,
    action: 'deactivate_admin',
    targetType: 'platform_admin',
    targetId: userId,
    targetLabel: targetName,
  });

  revalidatePath('/admin/team');
}

export async function reactivateAdmin(userId: string, targetName: string) {
  const admin = await requireAdmin('team');
  const db = createAdminClient();

  await db.from('platform_admins').update({ is_active: true }).eq('user_id', userId);
  await db.auth.admin.updateUserById(userId, { ban_duration: 'none' });

  await logAdminAction({
    adminUser: admin,
    action: 'reactivate_admin',
    targetType: 'platform_admin',
    targetId: userId,
    targetLabel: targetName,
  });

  revalidatePath('/admin/team');
}

export async function updateAdminRole(userId: string, targetName: string, newRole: AdminRole) {
  const admin = await requireAdmin('team');
  if (userId === admin.userId) throw new Error('Cannot change your own role');
  if (!VALID_ROLES.includes(newRole)) throw new Error('Invalid role');

  const db = createAdminClient();
  const { data: before } = await db
    .from('platform_admins')
    .select('role')
    .eq('user_id', userId)
    .single();

  await db.from('platform_admins').update({ role: newRole }).eq('user_id', userId);

  await logAdminAction({
    adminUser: admin,
    action: 'update_admin_role',
    targetType: 'platform_admin',
    targetId: userId,
    targetLabel: targetName,
    oldValue: { role: before?.role },
    newValue: { role: newRole },
  });

  revalidatePath('/admin/team');
}
