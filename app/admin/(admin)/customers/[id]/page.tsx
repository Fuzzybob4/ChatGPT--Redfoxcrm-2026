import { requireAdmin, hasPermission } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ADDONS } from '@/lib/pricing';
import Link from 'next/link';
import {
  ArrowLeft,
  Infinity,
  Shield,
  Clock,
  Building2,
  CreditCard,
  Package,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  grantLifetimeAccess,
  revokeLifetimeAccess,
  overridePlan,
  extendTrial,
  saveAdminNotes,
  toggleAddon,
} from '../actions';

interface Props {
  params: Promise<{ id: string }>;
}

const PLANS = ['starter', 'professional', 'enterprise'];

export default async function AdminCustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdmin('customers');
  const db = createAdminClient();

  const { data: org } = await db
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();

  if (!org) notFound();

  const { data: members } = await db
    .from('user_org_roles')
    .select('user_id, role')
    .eq('org_id', id);

  const { data: recentLogs } = await db
    .from('admin_audit_log')
    .select('action, admin_name, created_at, old_value, new_value')
    .eq('target_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  const activeAddons: string[] = (org.active_addons as string[] | null) ?? [];
  const canOverride = hasPermission(admin.role, 'plan_override');
  const canGrantLifetime = hasPermission(admin.role, 'lifetime_access');

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link href="/admin/customers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="size-4" /> Back to Customers
      </Link>

      {/* Org header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <Building2 className="size-5 text-gray-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{org.name}</h1>
              <p className="text-xs text-gray-500">{id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs px-2 py-0.5 rounded border text-gray-300 border-white/[0.08] bg-white/[0.04] capitalize">
              {org.plan ?? '—'} plan
            </span>
            <span className="text-xs px-2 py-0.5 rounded border text-gray-300 border-white/[0.08] bg-white/[0.04] capitalize">
              {org.subscription_status ?? '—'}
            </span>
            {org.lifetime_access && (
              <span className="text-xs px-2 py-0.5 rounded border text-[#e85545] border-[#C8392B]/30 bg-[#C8392B]/10 flex items-center gap-1">
                <Infinity className="size-3" /> Lifetime Access
              </span>
            )}
            {org.admin_plan_override && (
              <span className="text-xs px-2 py-0.5 rounded border text-purple-400 border-purple-400/30 bg-purple-400/10 flex items-center gap-1">
                <Shield className="size-3" /> Admin Override
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Joined {format(new Date(org.created_at), 'MMM d, yyyy')}</p>
          <p>{members?.length ?? 0} team members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lifetime Access */}
        {canGrantLifetime && (
          <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Infinity className="size-4 text-[#C8392B]" />
              <h2 className="text-sm font-semibold text-white">Lifetime Access</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Grant permanent free access — no subscription required, no expiry.
              {org.lifetime_granted_at && ` Granted ${format(new Date(org.lifetime_granted_at), 'MMM d, yyyy')}.`}
            </p>
            {org.lifetime_access ? (
              <form action={async () => { 'use server'; await revokeLifetimeAccess(id, org.name); }}>
                <Button type="submit" variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full">
                  Revoke Lifetime Access
                </Button>
              </form>
            ) : (
              <form action={async () => { 'use server'; await grantLifetimeAccess(id, org.name); }}>
                <Button type="submit" size="sm" className="bg-[#C8392B] hover:bg-[#b03223] text-white w-full">
                  Grant Lifetime Access
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Plan Override */}
        {canOverride && (
          <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="size-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">Plan Override</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Force a specific plan regardless of payment status.
            </p>
            <div className="flex gap-2 flex-wrap">
              {PLANS.map((p) => (
                <form key={p} action={async () => { 'use server'; await overridePlan(id, org.name, p); }}>
                  <button
                    type="submit"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      org.plan === p
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'text-gray-400 border-white/[0.08] hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {p}
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        {/* Trial Extension */}
        {canOverride && (
          <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="size-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Extend Trial</h2>
            </div>
            <p className="text-xs text-gray-500 mb-1">
              Current trial ends:{' '}
              <span className="text-white">
                {org.trial_ends_at ? format(new Date(org.trial_ends_at), 'MMM d, yyyy') : 'N/A'}
              </span>
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Extend access by a fixed number of days from today.
            </p>
            <div className="flex gap-2">
              {[7, 14, 30].map((days) => (
                <form key={days} action={async () => { 'use server'; await extendTrial(id, org.name, days); }}>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    +{days} days
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        {/* Add-ons */}
        {canOverride && (
          <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="size-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Add-ons</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Manually enable or disable add-ons for this account.
            </p>
            <div className="flex flex-col gap-2">
              {ADDONS.map((addon) => {
                const enabled = activeAddons.includes(addon.id);
                return (
                  <form
                    key={addon.id}
                    action={async () => {
                      'use server';
                      await toggleAddon(id, org.name, addon.id, !enabled);
                    }}
                  >
                    <button
                      type="submit"
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.06] hover:bg-white/[0.03] transition-colors text-left"
                    >
                      <span className="text-xs text-gray-300">{addon.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${enabled ? 'text-green-400 bg-green-400/10' : 'text-gray-600 bg-white/[0.04]'}`}>
                        {enabled ? 'Active' : 'Off'}
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin Notes */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-white">Internal Notes</h2>
          </div>
          <form action={async (formData: FormData) => {
            'use server';
            await saveAdminNotes(id, formData.get('notes') as string);
          }} className="flex flex-col gap-3">
            <Textarea
              name="notes"
              defaultValue={org.admin_notes ?? ''}
              placeholder="Internal notes visible only to admin team..."
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-gray-600 resize-none text-sm min-h-[80px]"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="outline" className="border-white/[0.08] text-gray-300 hover:text-white">
                Save Notes
              </Button>
            </div>
          </form>
        </div>

        {/* Audit History for this org */}
        {recentLogs && recentLogs.length > 0 && (
          <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white mb-4">Admin Action History</h2>
            <div className="flex flex-col divide-y divide-white/[0.04]">
              {recentLogs.map((log, i) => (
                <div key={i} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-white font-medium capitalize">{log.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">by {log.admin_name}</p>
                  </div>
                  <p className="text-xs text-gray-600 shrink-0">
                    {format(new Date(log.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
