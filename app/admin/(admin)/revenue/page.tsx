import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { format, addDays } from 'date-fns';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Infinity,
  CreditCard,
} from 'lucide-react';

const PLAN_PRICES: Record<string, number> = {
  starter: 49,
  professional: 99,
  enterprise: 199,
};

export default async function AdminRevenuePage() {
  await requireAdmin('revenue');
  const db = createAdminClient();

  const { data: orgs } = await db
    .from('organizations')
    .select('id, name, plan, subscription_status, lifetime_access, trial_ends_at, created_at')
    .order('created_at', { ascending: false });

  const all = orgs ?? [];

  const activeOrgs = all.filter((o) => o.subscription_status === 'active' && !o.lifetime_access);
  const trialingOrgs = all.filter((o) => o.subscription_status === 'trialing');
  const pastDue = all.filter((o) => o.subscription_status === 'past_due');
  const lifetimeOrgs = all.filter((o) => o.lifetime_access);
  const canceledOrgs = all.filter((o) => o.subscription_status === 'canceled');

  const mrr = activeOrgs.reduce((sum, o) => sum + (PLAN_PRICES[o.plan ?? ''] ?? 0), 0);
  const arr = mrr * 12;

  // Expiring in next 30 days
  const now = Date.now();
  const expiringSoon = trialingOrgs
    .filter((o) => {
      if (!o.trial_ends_at) return false;
      const exp = new Date(o.trial_ends_at).getTime();
      return exp > now && exp < now + 30 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.trial_ends_at!).getTime() - new Date(b.trial_ends_at!).getTime());

  // Plan breakdown
  const planGroups: Record<string, { count: number; mrr: number }> = {};
  for (const org of activeOrgs) {
    const plan = org.plan ?? 'unknown';
    if (!planGroups[plan]) planGroups[plan] = { count: 0, mrr: 0 };
    planGroups[plan].count++;
    planGroups[plan].mrr += PLAN_PRICES[plan] ?? 0;
  }

  const kpis = [
    { label: 'Monthly Recurring Revenue', value: `$${mrr.toLocaleString()}`, icon: DollarSign, color: 'text-[#C8392B]', bg: 'bg-[#C8392B]/10' },
    { label: 'Annual Run Rate', value: `$${arr.toLocaleString()}`, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Past Due', value: pastDue.length.toString(), icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Lifetime Accounts', value: lifetimeOrgs.length.toString(), icon: Infinity, color: 'text-gray-400', bg: 'bg-white/[0.04]' },
    { label: 'Active Paying', value: activeOrgs.length.toString(), icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Canceled', value: canceledOrgs.length.toString(), icon: CreditCard, color: 'text-gray-500', bg: 'bg-white/[0.04]' },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#C8392B] uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-white">Revenue</h1>
        <p className="text-sm text-gray-500 mt-1">Subscription health and billing overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`size-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Plan Breakdown */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Revenue by Plan</h2>
        <div className="flex flex-col gap-3">
          {Object.entries(planGroups).map(([plan, { count, mrr: planMrr }]) => {
            const pct = mrr > 0 ? Math.round((planMrr / mrr) * 100) : 0;
            return (
              <div key={plan}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-300 capitalize font-medium">{plan}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">{count} orgs</span>
                    <span className="text-xs text-white font-semibold">${planMrr.toLocaleString()}/mo</span>
                    <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#C8392B]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(planGroups).length === 0 && (
            <p className="text-xs text-gray-600">No active paying subscriptions yet.</p>
          )}
        </div>
      </div>

      {/* Past Due Accounts */}
      {pastDue.length > 0 && (
        <div className="bg-[#111111] border border-amber-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-white">Past Due Accounts</h2>
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {pastDue.map((org) => (
              <div key={org.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{org.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{org.plan} plan · ${PLAN_PRICES[org.plan ?? ''] ?? 0}/mo</p>
                </div>
                <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">Past Due</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring Trials */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Expiring Trials (Next 30 Days)</h2>
        {expiringSoon.length === 0 ? (
          <p className="text-xs text-gray-600">No trials expiring in the next 30 days.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {expiringSoon.map((org) => {
              const daysLeft = Math.ceil(
                (new Date(org.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div key={org.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-white">{org.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{org.plan} plan</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white font-medium">
                      {format(new Date(org.trial_ends_at!), 'MMM d, yyyy')}
                    </p>
                    <p className={`text-xs ${daysLeft <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                      {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
