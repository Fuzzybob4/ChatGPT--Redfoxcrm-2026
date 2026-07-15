import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { format } from 'date-fns';
import { Shield, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  searchParams: Promise<{ q?: string; action?: string }>;
}

const ACTION_COLORS: Record<string, string> = {
  grant_lifetime_access: 'text-[#e85545] bg-[#C8392B]/10 border-[#C8392B]/20',
  revoke_lifetime_access: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  override_plan: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  extend_trial: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  invite_admin: 'text-green-400 bg-green-400/10 border-green-400/20',
  deactivate_admin: 'text-red-400 bg-red-400/10 border-red-400/20',
  reactivate_admin: 'text-green-400 bg-green-400/10 border-green-400/20',
  update_admin_role: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  enable_addon: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  disable_addon: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  update_admin_notes: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
};

export default async function AdminAuditPage({ searchParams }: Props) {
  await requireAdmin('audit');
  const { q, action } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (action) query = query.eq('action', action);

  const { data: logs } = await query;

  const filtered = (logs ?? []).filter((log) => {
    if (!q) return true;
    const search = q.toLowerCase();
    return (
      log.admin_name?.toLowerCase().includes(search) ||
      log.target_label?.toLowerCase().includes(search) ||
      log.action?.toLowerCase().includes(search)
    );
  });

  // Unique actions for filter
  const uniqueActions = [...new Set((logs ?? []).map((l) => l.action))];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#C8392B] uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Immutable record of all admin actions. {filtered.length} entries.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <form className="flex-1 min-w-[200px] max-w-xs relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-600" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name, org, action..."
            className="bg-[#111111] border-white/[0.08] text-white placeholder:text-gray-600 h-9 text-sm pl-8"
          />
        </form>
        <div className="flex gap-2 flex-wrap">
          {uniqueActions.slice(0, 6).map((a) => (
            <a
              key={a}
              href={action === a ? '/admin/audit' : `/admin/audit?action=${a}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                action === a
                  ? 'bg-[#C8392B] text-white border-[#C8392B]'
                  : 'text-gray-400 border-white/[0.08] hover:text-white bg-[#111111]'
              }`}
            >
              {a.replace(/_/g, ' ')}
            </a>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs text-gray-500 font-semibold px-5 py-3">Action</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Target</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Admin</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Changes</th>
              <th className="text-left text-xs text-gray-500 font-semibold px-3 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map((log) => {
              const colorClass = ACTION_COLORS[log.action] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20';
              return (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize whitespace-nowrap ${colorClass}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="text-xs text-white font-medium">{log.target_label ?? '—'}</p>
                    <p className="text-xs text-gray-600">{log.target_type}</p>
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="text-xs text-white">{log.admin_name ?? '—'}</p>
                    <p className="text-xs text-gray-600 capitalize">{log.admin_role}</p>
                  </td>
                  <td className="px-3 py-3.5">
                    {log.new_value && Object.keys(log.new_value).length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {Object.entries(log.new_value as Record<string, unknown>).slice(0, 2).map(([k, v]) => (
                          <p key={k} className="text-xs text-gray-500">
                            <span className="text-gray-600">{k}:</span>{' '}
                            <span className="text-gray-300">{String(v)}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-600 text-sm">
                  No audit entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
