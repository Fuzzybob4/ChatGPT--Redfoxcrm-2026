import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Activity,
  Users,
  TrendingUp,
  UserPlus,
  XCircle,
  RefreshCw,
} from 'lucide-react';

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  active: TrendingUp,
  trialing: UserPlus,
  canceled: XCircle,
  past_due: Activity,
  default: RefreshCw,
};

const EVENT_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10',
  trialing: 'text-blue-400 bg-blue-400/10',
  canceled: 'text-red-400 bg-red-400/10',
  past_due: 'text-amber-400 bg-amber-400/10',
  default: 'text-gray-400 bg-white/[0.04]',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activated subscription',
  trialing: 'Started trial',
  canceled: 'Canceled subscription',
  past_due: 'Payment failed (past due)',
};

export default async function AdminActivityPage() {
  await requireAdmin('activity');
  const db = createAdminClient();

  // Recent org changes (newest 50)
  const { data: recentOrgs } = await db
    .from('organizations')
    .select('id, name, plan, subscription_status, created_at, trial_ends_at')
    .order('created_at', { ascending: false })
    .limit(50);

  // Recent admin audit log entries
  const { data: auditEntries } = await db
    .from('admin_audit_log')
    .select('id, action, admin_name, admin_role, target_label, target_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const orgs = recentOrgs ?? [];
  const logs = auditEntries ?? [];

  // Stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const signupsToday = orgs.filter((o) => new Date(o.created_at) >= today).length;
  const activeCount = orgs.filter((o) => o.subscription_status === 'active').length;
  const trialCount = orgs.filter((o) => o.subscription_status === 'trialing').length;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#C8392B] uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-white">Activity</h1>
        <p className="text-sm text-gray-500 mt-1">Recent signups, upgrades, and cancellations.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#C8392B]/10 flex items-center justify-center">
            <UserPlus className="size-4 text-[#C8392B]" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{signupsToday}</p>
            <p className="text-xs text-gray-500">Signups today</p>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center">
            <TrendingUp className="size-4 text-green-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{activeCount}</p>
            <p className="text-xs text-gray-500">Active orgs</p>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center">
            <Users className="size-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{trialCount}</p>
            <p className="text-xs text-gray-500">On trial</p>
          </div>
        </div>
      </div>

      {/* Recent admin actions */}
      {logs.length > 0 && (
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Admin Actions</h2>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#C8392B]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="size-3.5 text-[#C8392B]" />
                  </div>
                  <div>
                    <p className="text-xs text-white font-medium capitalize">
                      {log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      by {log.admin_name} · {log.target_label ?? log.target_type}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 shrink-0">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent org signups feed */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Recent Organizations</h2>
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {orgs.slice(0, 30).map((org) => {
            const status = org.subscription_status ?? 'default';
            const Icon = EVENT_ICONS[status] ?? EVENT_ICONS.default;
            const colorClass = EVENT_COLORS[status] ?? EVENT_COLORS.default;
            const label = STATUS_LABELS[status] ?? 'Account updated';
            return (
              <div key={org.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                    <Icon className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-white font-medium">{org.name ?? 'Unnamed'}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {label} · {org.plan ?? '—'} plan
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 shrink-0">
                  {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                </p>
              </div>
            );
          })}
          {orgs.length === 0 && (
            <p className="py-8 text-center text-xs text-gray-600">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
