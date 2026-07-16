// Shared admin role types and permission matrix.
// This file has NO server-only imports — safe to use in Client Components.

export type AdminRole =
  | 'ceo'
  | 'cto'
  | 'marketing'
  | 'sales'
  | 'accounting'
  | 'customer_service';

export interface AdminUser {
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
}

// Roles that have full access to all admin areas
export const ELEVATED_ROLES: AdminRole[] = ['ceo', 'cto'];

// Role permission matrix
export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  ceo:              ['dashboard', 'customers', 'revenue', 'team', 'activity', 'audit', 'plan_override', 'lifetime_access'],
  cto:              ['dashboard', 'customers', 'revenue', 'activity', 'audit', 'plan_override'],
  marketing:        ['dashboard', 'activity'],
  sales:            ['dashboard', 'customers', 'activity'],
  accounting:       ['dashboard', 'revenue', 'audit'],
  customer_service: ['dashboard', 'customers', 'activity'],
};

export function hasPermission(role: AdminRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
