import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { format } from 'date-fns';
import {
  Users,
  ChevronRight,
  Infinity,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchProps {
  searchParams: Promise<{ q?: string; plan?: string; status?: string }>;
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  professional: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  enterprise: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10 border-green-400/20',
  trialing: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  past_due: 'text-red-400 bg-red-400/10 border-red-400/20',
  canceled: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
};

export default async function AdminCustomersPage({ searchParams }: SearchProps) {
  await requireAdmin('customers');
  const { q, plan, status } = await searchParams;

  const db = createAdminClient();
  let query = db
    .from('organizations')
    .select('id, name, plan, subscription_status, lifetime_access, trial_ends_at, created_at, admin_plan_override, admin_notes, active_addons')
    .order('created_at', { ascending: false })
    .limit(100);

  if (plan) query = query.eq('plan', plan);
  if (status) query = query.eq('subscription_status', status);

  const { data: orgs } = await query;

  const filtered = (orgs ?? []).filter((o) =>
    q ? o.name?.toLowerCase().includes(q.toLowerCase()) : true
  );

  return (
    <div className="p-8">
      <div className="max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-[#C8392B] uppercase tracking-widest mb-1">Admin</p>
            <h1 className="text-2xl font-bold text-white">Customers</h1>
            <p className="text-sm text-gray-500 mt-1">{filtered.length} organizations</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <form className="flex-1 max-w-sm">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search by name..."
              className="bg-[#111111] border-white/[0.08] text-white placeholder:text-gray-600 h-9 text-sm"
            />
          </form>
          <div className="flex gap-2">
            {['starter', 'professional', 'enterprise'].map((p) => (
              <Link
                key={p}
                href={plan === p ? '/admin/customers' : `/admin/customers?plan=${p}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                  plan === p
                    ? 'bg-[#C8392B] text-white border-[#C8392B]'
                    : 'text-gray-400 border-white/[0.08] hover:text-white bg-[#111111]'
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs text-gray-500 font-semibold px-5 py-3">Organization</th>
                <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Plan</th>
                <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Status</th>
                <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Addons</th>
                <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Joined</th>
                <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Flags</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map((org) => {
                const addons = (org.active_addons as string[] | null) ?? [];
                const trialExpiringSoon =
                  org.subscription_status === 'trialing' &&
                  org.trial_ends_at &&
                  new Date(org.trial_ends_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                return (
                  <tr key={org.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{org.name ?? 'Unnamed'}</span>
                        {org.admin_notes && (
                          <span className="text-xs text-gray-600 truncate max-w-[200px]">{org.admin_notes}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${PLAN_COLORS[org.plan ?? ''] ?? 'text-gray-400 bg-white/[0.04] border-white/[0.08]'}`}>
                        {org.admin_plan_override ? `${org.plan}*` : (org.plan ?? '—')}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${STATUS_COLORS[org.subscription_status ?? ''] ?? 'text-gray-500 bg-white/[0.04] border-white/[0.08]'}`}>
                        {org.subscription_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-xs text-gray-500">{addons.length > 0 ? addons.length : '—'}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-xs text-gray-500">
                        {org.created_at ? format(new Date(org.created_at), 'MMM d, yyyy') : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {org.lifetime_access && (
                          <span title="Lifetime access" className="text-[#C8392B]">
                            <Infinity className="size-3.5" />
                          </span>
                        )}
                        {org.admin_plan_override && (
                          <span title="Plan overridden by admin" className="text-purple-400">
                            <Shield className="size-3.5" />
                          </span>
                        )}
                        {trialExpiringSoon && (
                          <span title="Trial expiring soon" className="text-amber-400">
                            <AlertTriangle className="size-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <Link
                        href={`/admin/customers/${org.id}`}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Manage <ChevronRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-600 text-sm">
                    No organizations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
