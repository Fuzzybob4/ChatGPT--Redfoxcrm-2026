import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { format } from 'date-fns';
import { UserCog, UserPlus, UserX, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  inviteAdminMember,
  deactivateAdmin,
  reactivateAdmin,
  updateAdminRole,
} from './actions';
import type { AdminRole } from '@/lib/admin-auth';

const ROLES: AdminRole[] = ['ceo', 'cto', 'marketing', 'sales', 'accounting', 'customer_service'];

const ROLE_LABELS: Record<AdminRole, string> = {
  ceo: 'CEO',
  cto: 'CTO',
  marketing: 'Marketing',
  sales: 'Sales',
  accounting: 'Accounting',
  customer_service: 'Customer Service',
};

const ROLE_COLORS: Record<AdminRole, string> = {
  ceo: 'text-[#e85545] bg-[#C8392B]/10 border-[#C8392B]/30',
  cto: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  marketing: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  sales: 'text-green-400 bg-green-400/10 border-green-400/30',
  accounting: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  customer_service: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
};

export default async function AdminTeamPage() {
  const admin = await requireAdmin('team');
  const db = createAdminClient();

  const { data: members } = await db
    .from('platform_admins')
    .select('user_id, name, email, role, is_active, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#C8392B] uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-white">Team</h1>
        <p className="text-sm text-gray-500 mt-1">Manage internal RedFox employee access.</p>
      </div>

      {/* Invite form */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="size-4 text-[#C8392B]" />
          <h2 className="text-sm font-semibold text-white">Invite Team Member</h2>
        </div>
        <form action={inviteAdminMember} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-400">Full Name</Label>
            <Input
              name="name"
              placeholder="Jane Smith"
              required
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-gray-600 h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-400">Email Address</Label>
            <Input
              name="email"
              type="email"
              placeholder="jane@redfoxcrm.com"
              required
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-gray-600 h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-gray-400">Role</Label>
            <select
              name="role"
              required
              className="h-9 rounded-md bg-white/[0.03] border border-white/[0.08] text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-[#C8392B]/50"
            >
              <option value="">Select a role...</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="bg-[#C8392B] hover:bg-[#b03223] text-white"
            >
              Send Invite
            </Button>
          </div>
        </form>
      </div>

      {/* Members table */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="size-4 text-gray-400" />
            Current Team ({members?.length ?? 0})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="text-left text-xs text-gray-500 font-semibold px-5 py-3">Member</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Role</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Status</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Added</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Change Role</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {(members ?? []).map((member) => {
              const isSelf = member.user_id === admin.userId;
              return (
                <tr key={member.user_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                        {(member.name ?? member.email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">
                          {member.name ?? 'Unnamed'}
                          {isSelf && <span className="ml-2 text-[10px] text-gray-600">(you)</span>}
                        </p>
                        <p className="text-gray-600 text-xs">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${ROLE_COLORS[member.role as AdminRole] ?? ''}`}>
                      {ROLE_LABELS[member.role as AdminRole] ?? member.role}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${member.is_active ? 'text-green-400 bg-green-400/10' : 'text-gray-500 bg-white/[0.04]'}`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-gray-500">
                    {member.created_at ? format(new Date(member.created_at), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-3 py-3.5">
                    {!isSelf && (
                      <form action={async (fd: FormData) => {
                        'use server';
                        await updateAdminRole(member.user_id, member.name ?? '', fd.get('role') as AdminRole);
                      }} className="flex items-center gap-2">
                        <select
                          name="role"
                          defaultValue={member.role}
                          className="h-7 rounded bg-white/[0.04] border border-white/[0.06] text-gray-300 text-xs px-2 focus:outline-none"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        <button type="submit" className="text-gray-500 hover:text-white transition-colors">
                          <RefreshCw className="size-3" />
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    {!isSelf && (
                      member.is_active ? (
                        <form action={async () => { 'use server'; await deactivateAdmin(member.user_id, member.name ?? ''); }}>
                          <button type="submit" className="flex items-center gap-1 text-xs text-red-500/60 hover:text-red-400 transition-colors">
                            <UserX className="size-3.5" /> Deactivate
                          </button>
                        </form>
                      ) : (
                        <form action={async () => { 'use server'; await reactivateAdmin(member.user_id, member.name ?? ''); }}>
                          <button type="submit" className="flex items-center gap-1 text-xs text-green-500/60 hover:text-green-400 transition-colors">
                            <RefreshCw className="size-3.5" /> Reactivate
                          </button>
                        </form>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {(!members || members.length === 0) && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-600 text-sm">
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
