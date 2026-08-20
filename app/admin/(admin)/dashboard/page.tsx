import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  MrrChart,
  PlanBreakdownChart,
  SignupsChart,
  ChurnRateChart,
} from '@/components/admin/admin-charts';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Infinity,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { getPlanChargeCents } from '@/lib/pricing';

type OrgRow = {
  id: string;
  plan: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  lifetime_access: boolean | null;
  created_at: string;
};

/** Monthly-normalized recurring revenue for one org (yearly plans ÷ 12). */
function orgMonthlyRevenue(org: OrgRow): number {
  const interval = org.subscription_interval === 'yearly' ? 'yearly' : 'monthly';
  const cents = getPlanChargeCents(org.plan ?? 'starter', interval);
  const dollars = cents / 100;
  return interval === 'yearly' ? dollars / 12 : dollars;
}

/** Real MRR trend over the last 8 months, based on active orgs' creation dates. */
function buildMrrData(orgs: OrgRow[]) {
  const now = new Date();
  return Array.from({ length: 8 }).map((_, i) => {
    const monthEnd = endOfMonth(subMonths(now, 7 - i));
    const monthStart = startOfMonth(subMonths(now, 7 - i));
    // Orgs that existed and were paying by the end of this month.
    const paidByThen = orgs.filter(
      (o) => o.subscription_status === 'active' && new Date(o.created_at) <= monthEnd,
    );
    const mrr = Math.round(paidByThen.reduce((s, o) => s + orgMonthlyRevenue(o), 0));
    const newThisMonth = orgs.filter((o) => {
      const c = new Date(o.created_at);
      return o.subscription_status === 'active' && c >= monthStart && c <= monthEnd;
    });
    const newRevenue = Math.round(newThisMonth.reduce((s, o) => s + orgMonthlyRevenue(o), 0));
    return {
      month: format(monthEnd, 'MMM'),
      mrr,
      new: newRevenue,
      churned: 0,
    };
  });
}

/** Real signups per day over the last 14 days. */
function buildSignupData(orgs: OrgRow[]) {
  const now = new Date();
  return Array.from({ length: 14 }).map((_, i) => {
    const day = subDays(now, 13 - i);
    const label = format(day, 'MMM d');
    const count = orgs.filter((o) => format(new Date(o.created_at), 'MMM d yyyy') === format(day, 'MMM d yyyy')).length;
    return { day: label, signups: count };
  });
}

/** Real churn rate: cancelled ÷ total orgs created up to each month. */
function buildChurnData(orgs: OrgRow[]) {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, i) => {
    const monthEnd = endOfMonth(subMonths(now, 5 - i));
    const created = orgs.filter((o) => new Date(o.created_at) <= monthEnd);
    const cancelled = created.filter((o) => o.subscription_status === 'cancelled');
    const rate = created.length > 0 ? (cancelled.length / created.length) * 100 : 0;
    return { month: format(monthEnd, 'MMM'), rate: parseFloat(rate.toFixed(1)) };
  });
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin('dashboard');
  const db = createAdminClient();

  // Fetch real data
  const [orgsResult, expiringResult, lifetimeResult] = await Promise.all([
    db.from('organizations').select('id, plan, subscription_status, subscription_interval, lifetime_access, created_at'),
    db
      .from('organizations')
      .select('id, name, plan, trial_ends_at')
      .lt('trial_ends_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .gt('trial_ends_at', new Date().toISOString())
      .order('trial_ends_at', { ascending: true })
      .limit(5),
    db.from('organizations').select('id').eq('lifetime_access', true),
  ]);

  const orgs = orgsResult.data ?? [];
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => o.subscription_status === 'active').length;
  const trialOrgs = orgs.filter((o) => o.subscription_status === 'trialing').length;
  const lifetimeCount = lifetimeResult.data?.length ?? 0;
  const expiringTrials = expiringResult.data ?? [];
  const activeAdminCount = 1; // Just show the current admin for now

  // Plan breakdown for pie chart
  const planCounts: Record<string, number> = {};
  for (const org of orgs) {
    const p = org.plan ?? 'unknown';
    planCounts[p] = (planCounts[p] ?? 0) + 1;
  }
  const planBreakdown = Object.entries(planCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // MRR from real active subscriptions, using the pricing source of truth
  // (yearly plans normalized to a monthly figure).
  const estimatedMrr = Math.round(
    orgs
      .filter((o) => o.subscription_status === 'active')
      .reduce((sum, o) => sum + orgMonthlyRevenue(o as OrgRow), 0),
  );

  const mrrData = buildMrrData(orgs as OrgRow[]);
  const signupData = buildSignupData(orgs as OrgRow[]);
  const churnData = buildChurnData(orgs as OrgRow[]);

  const kpis = [
    {
      label: 'Total Organizations',
      value: totalOrgs.toLocaleString(),
      icon: Users,
      sub: `${trialOrgs} on trial`,
      trend: 'up',
    },
    {
      label: 'Estimated MRR',
      value: `$${estimatedMrr.toLocaleString()}`,
      icon: DollarSign,
      sub: `${activeOrgs} active subscriptions`,
      trend: 'up',
    },
    {
      label: 'Expiring Trials',
      value: expiringTrials.length.toLocaleString(),
      icon: AlertTriangle,
      sub: 'within 7 days',
      trend: expiringTrials.length > 3 ? 'warn' : 'neutral',
    },
    {
      label: 'Lifetime Accounts',
      value: lifetimeCount.toLocaleString(),
      icon: Infinity,
      sub: 'no expiry, no billing',
      trend: 'neutral',
    },
    {
      label: 'Active Admins',
      value: activeAdminCount.toLocaleString(),
      icon: CreditCard,
      sub: 'internal team members',
      trend: 'neutral',
    },
    {
      label: 'Avg Plan Value',
      value: activeOrgs > 0 ? `$${Math.round(estimatedMrr / activeOrgs)}/mo` : '—',
      icon: BarChart3,
      sub: 'per active org',
      trend: 'up',
    },
  ];

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#C8392B] uppercase tracking-widest mb-1">Admin Portal</p>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {admin.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")} · {admin.role.toUpperCase()}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                kpi.trend === 'up' ? 'bg-[#C8392B]/10' :
                kpi.trend === 'warn' ? 'bg-amber-500/10' :
                'bg-white/[0.04]'
              }`}>
                <kpi.icon className={`size-4 ${
                  kpi.trend === 'up' ? 'text-[#C8392B]' :
                  kpi.trend === 'warn' ? 'text-amber-500' :
                  'text-gray-500'
                }`} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                {kpi.trend === 'up' && <TrendingUp className="size-3 text-green-500" />}
                {kpi.trend === 'warn' && <TrendingDown className="size-3 text-amber-500" />}
                {kpi.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-[#111111] border border-white/[0.06] rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-1">Monthly Recurring Revenue</p>
          <p className="text-xs text-gray-500 mb-4">MRR growth and new revenue trends</p>
          <MrrChart data={mrrData} />
        </div>
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-1">Plan Distribution</p>
          <p className="text-xs text-gray-500 mb-4">Accounts by subscription tier</p>
          <PlanBreakdownChart data={planBreakdown.length > 0 ? planBreakdown : [{ name: 'No data', value: 1 }]} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-1">New Signups</p>
          <p className="text-xs text-gray-500 mb-4">Last 14 days</p>
          <SignupsChart data={signupData} />
        </div>
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-1">Churn Rate</p>
          <p className="text-xs text-gray-500 mb-4">Monthly churn percentage</p>
          <ChurnRateChart data={churnData} />
        </div>
      </div>

      {/* Expiring trials */}
      {expiringTrials.length > 0 && (
        <div className="bg-[#111111] border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="size-4 text-amber-500" />
            <p className="text-sm font-semibold text-white">Trials Expiring Soon</p>
            <span className="ml-auto text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {expiringTrials.length} expiring in 7 days
            </span>
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {expiringTrials.map((org) => (
              <div key={org.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white font-medium">{org.name ?? 'Unnamed Org'}</p>
                  <p className="text-xs text-gray-500 capitalize">{org.plan} plan</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-400">
                    Expires {format(new Date(org.trial_ends_at!), 'MMM d')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
