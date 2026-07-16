import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { AdminRole, AdminUser } from '@/lib/admin-roles';
import { hasPermission } from '@/lib/admin-roles';

// Re-export shared types and constants from the client-safe module
export type { AdminRole, AdminUser } from '@/lib/admin-roles';
export { ELEVATED_ROLES, ROLE_PERMISSIONS, hasPermission } from '@/lib/admin-roles';

/**
 * Returns the current admin session, or null if not authenticated.
 * Does NOT redirect — use requireAdmin() for protected routes.
 */
export async function getAdminSession(): Promise<AdminUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const admin = createAdminClient();
    const { data, error: adminError } = await admin
      .from('platform_admins')
      .select('role, name, email, is_active')
      .eq('user_id', user.id)
      .single();

    if (adminError || !data || !data.is_active) return null;

    return {
      userId: user.id,
      name: data.name ?? user.email ?? 'Admin',
      email: data.email ?? user.email ?? '',
      role: data.role as AdminRole,
      isActive: data.is_active,
    };
  } catch {
    return null;
  }
}

/**
 * Require admin session — redirects to /admin/login if not authenticated.
 * Optionally checks for a specific permission.
 */
export async function requireAdmin(permission?: string): Promise<AdminUser> {
  const session = await getAdminSession();
  if (!session) redirect('/admin');
  if (permission && !hasPermission(session.role, permission)) {
    redirect('/admin?error=unauthorized');
  }
  return session;
}

/**
 * Log an admin action to audit log.
 */
export async function logAdminAction(opts: {
  adminUser: AdminUser;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from('admin_audit_log').insert({
      admin_user_id: opts.adminUser.userId,
      admin_name: opts.adminUser.name,
      admin_role: opts.adminUser.role,
      action: opts.action,
      target_type: opts.targetType,
      target_id: opts.targetId,
      target_label: opts.targetLabel,
      old_value: opts.oldValue ?? null,
      new_value: opts.newValue ?? null,
    });
  } catch (err) {
    console.error('[admin-auth] Failed to log audit action:', err);
  }
}
