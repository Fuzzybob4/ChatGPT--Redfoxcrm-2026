'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Activity,
  Shield,
  UserCog,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminRole } from '@/lib/admin-roles';
import { ROLE_PERMISSIONS } from '@/lib/admin-roles';
import { adminLogoutAction } from '@/app/admin/actions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/admin/dashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { label: 'Customers',    href: '/admin/customers', icon: Users,           permission: 'customers' },
  { label: 'Revenue',      href: '/admin/revenue',  icon: DollarSign,      permission: 'revenue' },
  { label: 'Activity',     href: '/admin/activity', icon: Activity,        permission: 'activity' },
  { label: 'Audit Log',    href: '/admin/audit',    icon: Shield,          permission: 'audit' },
  { label: 'Team',         href: '/admin/team',     icon: UserCog,         permission: 'team' },
];

interface Props {
  role: AdminRole;
  name: string;
  email: string;
}

export function AdminSidebar({ role, name, email }: Props) {
  const pathname = usePathname();
  const permissions = ROLE_PERMISSIONS[role] ?? [];

  const visibleItems = NAV_ITEMS.filter((item) => permissions.includes(item.permission));

  const roleLabel: Record<AdminRole, string> = {
    ceo: 'Chief Executive Officer',
    cto: 'Chief Technology Officer',
    marketing: 'Marketing',
    sales: 'Sales',
    accounting: 'Accounting',
    customer_service: 'Customer Service',
  };

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-[#0d0d0d] border-r border-white/[0.06] min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-[#C8392B] flex items-center justify-center shrink-0">
          <Image src="/logo.png" alt="RedFox" width={18} height={18} className="w-[18px] h-[18px]" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-sm text-white tracking-tight">REDFOX</span>
          <span className="text-[8px] font-bold text-[#C8392B] tracking-[0.2em] uppercase">Admin Portal</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-[#C8392B]/15 text-[#e85545]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              )}
            >
              <item.icon className={cn('size-4 shrink-0', isActive ? 'text-[#e85545]' : 'text-gray-500 group-hover:text-gray-300')} />
              {item.label}
              {isActive && <ChevronRight className="size-3 ml-auto text-[#e85545]/60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-[#C8392B]/20 border border-[#C8392B]/30 flex items-center justify-center text-[#e85545] font-bold text-xs shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-white truncate">{name}</span>
            <span className="text-[10px] text-gray-500 truncate">{roleLabel[role]}</span>
          </div>
        </div>
        <form action={adminLogoutAction} className="mt-1">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
