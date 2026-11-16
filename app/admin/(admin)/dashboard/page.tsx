import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MrrChart, PlanBreakdownChart, SignupsChart } from '@/components/admin/admin-charts';
import {
  DollarSign,
  Users,
  Hourglass,
  Activity,
  ChevronRight,
  Mail,
  CircleAlert,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, differenceInCalendarDays, formatDistanceToNowStrict } from 'date-fns';
import { getPlanChargeCents } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

type OrgRow = {
  id: string;
  name: string | null;
  plan: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  lifetime_access: boolean | null;
  is_internal: boolean | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

type Account = OrgRow & {
  ownerEmail: string | null;
  lastSeen: string | null;
  customers: number;
  jobs: number;
};

const DAY = 24 * 60 * 60 * 1000;

function orgMonthlyRevenue(org: OrgRow): number {
  const interval = org.subscription_interval === 'yearly' ? 'yearly' : 'monthly';
  const dollars = getPlanChargeCents(org.plan ?? 'starter', interval) / 100;
  return interval === 'yearly' ? dollars / 12 : dollars;
}

const isPaying = (o: OrgRow) => o.subscription_status === 'active' && !o.lifetime_access;

function buildMrrData(orgs: OrgRow[]) {
  const now = new Date();
  return Array.from({ length: 8 }).map((_, i) => {
    const monthStart = startOfMonth(subMonths(now, 7 - i));
    const monthEnd = endOfMonth(monthStart);
    const paying = orgs.filter((o) => isPaying(o) && new Date(o.created_at) <= monthEnd);
    const fresh = paying.filter((o) => new Date(o.created_at) >= monthStart);
    return {
      month: format(monthEnd, 'MMM'),
      mrr: Math.round(paying.reduce((s, o) => s + orgMonthlyRevenue(o), 0)),
      new: Math.round(fresh.reduce((s, o) => s + orgMonthlyRevenue(o), 0)),
      churned: 0,
    };
  });
}

function buildSignupsByMonth(orgs: OrgRow[]) {
  const now = new Date();
  return Array.from({ length: 12 }).map((_, i) => {
    const monthStart = startOfMonth(subMonths(now, 11 - i));
    const monthEnd = endOfMonth(monthStart);
    return {
      day: format(monthStart, 'MMM'),
      signups: orgs.filter((o) => {
        const c = new Date(o.created_at);
        return c >= monthStart && c <= monthEnd;
      }).length,
    };
  });
}

/** Where an account stands, in plain words, for the table. */
function statusOf(a: Account): { label: string; tone: 'green' | 'amber' | 'red' | 'gray' | 'blue' } {
  if (a.lifetime_access) return { label: 'Free for life', tone: 'blue' };
  if (isPaying(a)) return { label: `Paying · ${(a.plan ?? 'starter').replace(/^\w/, (c) => c.toUpperCase())}`, tone: 'green' };
  if (a.subscription_status === 'past_due' || a.subscription_status === 'unpaid') return { label: 'Payment failed', tone: 'red' };
  if (a.subscription_status === 'cancelled' || a.subscription_status === 'canceled') return { label: 'Cancelled', tone: 'gray' };
  if (a.trial_ends_at) {
    const days = differenceInCalendarDays(new Date(a.trial_ends_at), new Date());
    if (days < 0) return { label: 'Trial ended', tone: 'red' };
    return { label: `Trial · ${days} day${days === 1 ? '' : 's'} left`, tone: days <= 7 ? 'amber' : 'blue' };
  }
  return { label: 'Trial · no end date', tone: 'gray' };
}

function health(lastSeen: string | null): { label: string; dot: string } {
  if (!lastSeen) return { label: 'Never logged in', dot: 'bg-gray-600' };
  const days = (Date.now() - new Date(lastSeen).getTime()) / DAY;
  const ago = `${formatDistanceToNowStrict(new Date(lastSeen))} ago`;
  if (days <= 7) return { label: ago, dot: 'bg-emerald-500' };
  if (days <= 30) return { label: ago, dot: 'bg-amber-500' };
  return { label: ago, dot: 'bg-red-500' };
}

const TONE: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  blue: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  gray: 'bg-white/[0.04] text-gray-400 border-white/[0.08]',
};

export default async function AdminDashboardPage() {
  const admin = await requireAdmin('dashboard');
  const db = createAdminClient();

  const [{ data: orgData }, { data: members }, usersRes] = await Promise.all([
    db
      .from('organizations')
      .select('id, name, plan, subscription_status, subscription_interval, lifetime_access, is_internal, trial_ends_at, stripe_customer_id, created_at')
      .order('created_at', { ascending: false }),
    db.from('user_memberships').select('org_id, user_id, role'),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const orgs = (orgData ?? []) as OrgRow[];
  const users = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u]));

  // Usage per account: who owns it, when anyone last logged in, how much they've put in.
  const accounts: Account[] = await Promise.all(
    orgs.map(async (o) => {
      const mine = (members ?? []).filter((m) => m.org_id === o.id);
      const owner = mine.find((m) => m.role === 'owner') ?? mine[0];
      const lastSeen = mine
        .map((m) => users.get(m.user_id)?.last_sign_in_at ?? null)
        .filter(Boolean)
        .sort()
        .pop() ?? null;
      const [c, j] = await Promise.all([
        db.from('customers').select('id', { count: 'exact', head: true }).eq('org_id', o.id),
        db.from('scheduled_jobs').select('id', { count: 'exact', head: true }).eq('org_id', o.id),
      ]);
      return {
        ...o,
        ownerEmail: owner ? users.get(owner.user_id)?.email ?? null : null,
        lastSeen,
        customers: c.count ?? 0,
        jobs: j.count ?? 0,
      };
    }),
  );

  const real = accounts.filter((a) => !a.is_internal);
  const internalCount = accounts.length - real.length;
  const prospects = real.filter((a) => !a.lifetime_access);

  const paying = prospects.filter(isPaying);
  const mrr = Math.round(paying.reduce((s, o) => s + orgMonthlyRevenue(o), 0));
  const onTrial = prospects.filter((a) => !isPaying(a) && a.subscription_status === 'trialing');
  const withCard = onTrial.filter((a) => a.stripe_customer_id).length;
  const signups30 = real.filter((a) => Date.now() - new Date(a.created_at).getTime() <= 30 * DAY).length;
  const active7 = real.filter((a) => a.lastSeen && Date.now() - new Date(a.lastSeen).getTime() <= 7 * DAY).length;

  // Funnel: signed up → put data in → added a card → paying.
  const funnel = [
    { label: 'Signed up', value: prospects.length },
    { label: 'Added customers or jobs', value: prospects.filter((a) => a.customers > 0 || a.jobs > 0).length },
    { label: 'Card on file', value: prospects.filter((a) => a.stripe_customer_id).length },
    { label: 'Paying', value: paying.length },
  ];
  const funnelMax = Math.max(1, funnel[0].value);

  // Needs attention: trials ending within 14 days, failed payments, never-used accounts.
  const attention = prospects
    .map((a) => {
      const s = statusOf(a);
      const daysLeft = a.trial_ends_at ? differenceInCalendarDays(new Date(a.trial_ends_at), new Date()) : null;
      let why: string | null = null;
      if (s.label === 'Payment failed') why = 'Payment failed: update card';
      else if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && !a.stripe_customer_id) why = `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}, no card yet`;
      else if (daysLeft !== null && daysLeft < 0 && !isPaying(a)) why = 'Trial ended without paying';
      return why ? { a, why } : null;
    })
    .filter(Boolean) as { a: Account; why: string }[];

  const planCounts: Record<string, number> = {};
  for (const o of paying) planCounts[o.plan ?? 'starter'] = (planCounts[o.plan ?? 'starter'] ?? 0) + 1;
  const planBreakdown = Object.entries(planCounts).map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value }));

  const kpis = [
    { label: 'Monthly revenue', value: `$${mrr.toLocaleString()}`, sub: `${paying.length} paying ${paying.length === 1 ? 'company' : 'companies'}`, icon: DollarSign, accent: true },
    { label: 'On free trial', value: onTrial.length.toString(), sub: `${withCard} with a card on file`, icon: Hourglass },
    { label: 'New signups', value: signups30.toString(), sub: 'last 30 days', icon: Users },
    { label: 'Active this week', value: active7.toString(), sub: `of ${real.length} accounts logged in`, icon: Activity },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#e85545]">Admin portal</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Welcome back, {admin.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-gray-400">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <p className="text-xs text-gray-500">
          {internalCount} internal &amp; test account{internalCount === 1 ? '' : 's'} hidden from these numbers
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`flex flex-col gap-3 rounded-xl border p-4 sm:p-5 ${k.accent ? 'border-[#C8392B]/30 bg-gradient-to-b from-[#C8392B]/10 to-[#111111]' : 'border-white/[0.06] bg-[#111111]'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-400">{k.label}</span>
              <k.icon className={`size-4 shrink-0 ${k.accent ? 'text-[#e85545]' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{k.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Needs attention */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <CircleAlert className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-white">Needs your attention</h2>
            <span className="ml-auto rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-gray-400">{attention.length}</span>
          </div>
          {attention.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nothing urgent. No trials ending soon and no failed payments.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/[0.05]">
              {attention.map(({ a, why }) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/customers/${a.id}`} className="block truncate text-sm font-medium text-white hover:underline">
                      {a.name?.trim() || 'Unnamed company'}
                    </Link>
                    <p className="truncate text-xs text-amber-400">{why}</p>
                  </div>
                  {a.ownerEmail && (
                    <a
                      href={`mailto:${a.ownerEmail}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-gray-300 hover:bg-white/[0.05]"
                      aria-label={`Email ${a.name ?? 'owner'}`}
                    >
                      <Mail className="size-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Funnel */}
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
          <h2 className="text-sm font-semibold text-white">Trial to paying</h2>
          <p className="mb-4 text-xs text-gray-400">Excludes free-for-life and internal accounts</p>
          <div className="flex flex-col gap-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-300">{f.label}</span>
                  <span className="font-semibold tabular-nums text-white">{f.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-[#C8392B]" style={{ width: `${Math.max(2, (f.value / funnelMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Accounts */}
      <section className="mb-6 rounded-xl border border-white/[0.06] bg-[#111111]">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Accounts</h2>
            <p className="text-xs text-gray-400">Newest first · green = logged in this week</p>
          </div>
          <Link href="/admin/customers" className="flex items-center gap-1 text-xs font-medium text-[#e85545] hover:underline">
            All customers <ChevronRight className="size-3" />
          </Link>
        </div>

        {/* Phone: cards */}
        <ul className="flex flex-col divide-y divide-white/[0.05] md:hidden">
          {real.map((a) => {
            const s = statusOf(a);
            const h = health(a.lastSeen);
            return (
              <li key={a.id}>
                <Link href={`/admin/customers/${a.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${h.dot}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{a.name?.trim() || 'Unnamed company'}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[s.tone]}`}>{s.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4 text-xs text-gray-400">
                    <span>{h.label}</span>
                    <span>{a.customers.toLocaleString()} customers</span>
                    <span>{a.jobs.toLocaleString()} jobs</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Desktop: table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-y border-white/[0.06] text-xs text-gray-400">
                <th scope="col" className="px-5 py-2.5 font-medium">Company</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Last active</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Customers</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Jobs</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {real.map((a) => {
                const s = statusOf(a);
                const h = health(a.lastSeen);
                return (
                  <tr key={a.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/admin/customers/${a.id}`} className="font-medium text-white hover:underline">
                        {a.name?.trim() || 'Unnamed company'}
                      </Link>
                      {a.ownerEmail && <p className="text-xs text-gray-500">{a.ownerEmail}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[s.tone]}`}>{s.label}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2 whitespace-nowrap text-gray-300">
                        <span className={`size-2 rounded-full ${h.dot}`} aria-hidden="true" />
                        {h.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-300">{a.customers.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-300">{a.jobs.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-400">{format(new Date(a.created_at), 'MMM d, yyyy')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Monthly recurring revenue</h2>
          <p className="mb-4 text-xs text-gray-400">Paying companies only, last 8 months</p>
          <MrrChart data={buildMrrData(prospects)} />
        </section>
        <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
          <h2 className="text-sm font-semibold text-white">Signups by month</h2>
          <p className="mb-4 text-xs text-gray-400">Last 12 months</p>
          <SignupsChart data={buildSignupsByMonth(real)} />
        </section>
        {planBreakdown.length > 0 && (
          <section className="rounded-xl border border-white/[0.06] bg-[#111111] p-5 lg:col-span-3">
            <h2 className="text-sm font-semibold text-white">Paying companies by plan</h2>
            <PlanBreakdownChart data={planBreakdown} />
          </section>
        )}
      </div>
    </div>
  );
}
