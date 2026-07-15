'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Mail, AlertTriangle, Truck, Loader2 } from 'lucide-react';
import { useOrgContext } from '@/lib/org-context';
import {
  PLANS,
  EMAIL_PACKS,
  getPlanChargeCents,
  formatCents,
  YEARLY_DISCOUNT,
  emailUsagePercent,
  emailsRemaining,
  emailsOverage,
  emailOverageCents,
  getPlan,
} from '@/lib/pricing';
import { getTrialState } from '@/lib/trial';
import { createSignupSetupIntent } from '@/app/(auth)/signup/actions';

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    '1 location',
    'Up to 100 customers',
    '2,000 marketing emails/mo',
    'Basic reporting',
  ],
  professional: [
    'Multiple locations',
    'Up to 1,000 customers',
    '4,000 marketing emails/mo',
    'Advanced reporting',
    'Priority support',
  ],
  enterprise: [
    'Unlimited locations',
    'Unlimited customers',
    '6,000 marketing emails/mo',
    'Custom reporting',
    'Dedicated support',
    'API access',
  ],
};

// Mock email usage — replace with real org data once email settings are wired
const MOCK_EMAIL_USAGE = {
  sentThisMonth: 0,
  packCredits: 0,
};

function EmailUsageMeter({ planId }: { planId: string }) {
  const { sentThisMonth, packCredits } = MOCK_EMAIL_USAGE;
  const plan = getPlan(planId);
  const pct = emailUsagePercent(planId, sentThisMonth, packCredits);
  const remaining = emailsRemaining(planId, sentThisMonth, packCredits);
  const overage = emailsOverage(planId, sentThisMonth, packCredits);
  const overageCost = emailOverageCents(planId, sentThisMonth, packCredits);
  const total = plan.emailsPerMonth + packCredits;

  const barColor =
    pct >= 90 ? 'bg-destructive' :
    pct >= 70 ? 'bg-amber-500' :
    'bg-primary';

  const isWarning = pct >= 70;
  const isOverage = overage > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Email Usage This Month</CardTitle>
          {isWarning && !isOverage && (
            <Badge variant="outline" className="ml-auto text-amber-700 border-amber-300 bg-amber-50 text-xs">
              <AlertTriangle className="size-3 mr-1" />
              {pct}% used
            </Badge>
          )}
          {isOverage && (
            <Badge variant="destructive" className="ml-auto text-xs">
              Over limit
            </Badge>
          )}
        </div>
        <CardDescription>
          Marketing campaign emails only. Transactional emails (invoices, estimates, receipts) are always unlimited.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{sentThisMonth.toLocaleString()} sent</span>
            <span>{total.toLocaleString()} included</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Sent this month</p>
            <p className="text-lg font-semibold tabular-nums">{sentThisMonth.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className={`text-lg font-semibold tabular-nums ${isOverage ? 'text-destructive' : ''}`}>
              {isOverage ? '0' : remaining.toLocaleString()}
            </p>
          </div>
          {isOverage ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Overage charge</p>
              <p className="text-lg font-semibold tabular-nums text-destructive">
                {formatCents(overageCost)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {overage.toLocaleString()} emails &times; {formatCents(Math.round(plan.emailOverageCentsPerEmail))}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Reset</p>
              <p className="text-sm font-medium">1st of month</p>
            </div>
          )}
        </div>

        {/* Warning at 90% */}
        {pct >= 90 && !isOverage && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You have used {pct}% of your monthly email allowance. Additional emails will be billed at{' '}
            {formatCents(Math.round(plan.emailOverageCentsPerEmail))} each.
          </p>
        )}

        {/* Email packs coming soon */}
        <div className="rounded-lg border border-dashed p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Email packs &mdash; coming soon</p>
          <div className="flex flex-wrap gap-2">
            {EMAIL_PACKS.map((pack) => (
              <span
                key={pack.id}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                +{(pack.size / 1000).toFixed(0)}k emails &mdash; {formatCents(pack.priceCents)}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const org = useOrgContext();
  const currentPlanId = org.plan ?? 'starter';

  const { isActive, isTrialing, daysLeft, expired } = getTrialState({
    trialEndsAt: org.trialEndsAt,
    subscriptionStatus: org.subscriptionStatus,
  });

  const statusLabel = isActive
    ? 'Active'
    : expired
      ? 'Trial ended'
      : 'Free trial';

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <PageHeader
        title="Billing &amp; Plans"
        description="Manage your subscription, email usage, and add-ons"
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">

          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">
                    {PLANS[currentPlanId as keyof typeof PLANS]?.name ?? 'Starter'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isActive && org.subscriptionInterval
                      ? `Billed ${org.subscriptionInterval}`
                      : isTrialing
                        ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial`
                        : expired
                          ? 'Choose a plan to continue'
                          : `${org.locationCount} location${org.locationCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <Badge variant={isActive ? 'secondary' : expired ? 'destructive' : 'outline'}>
                  {statusLabel}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Billing occurs on the same day each period. You can upgrade, downgrade, or cancel anytime.
              </p>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <PaymentMethodSection org={org} isTrialing={isTrialing} daysLeft={daysLeft} />

          {/* Email Usage Meter */}
          <EmailUsageMeter planId={currentPlanId} />

          {/* Available Plans */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((planId) => {
                const plan = PLANS[planId];
                const current = planId === currentPlanId;
                const yearlyCents = getPlanChargeCents(planId, 'yearly');
                return (
                  <Card key={plan.id} className={current ? 'ring-2 ring-primary' : ''}>
                    <CardHeader>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        {isTrialing && current && (
                          <div className="mb-3 pb-3 border-b">
                            <p className="text-xs font-semibold text-primary mb-1">
                              FREE TRIAL
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {daysLeft} day{daysLeft === 1 ? '' : 's'} free, then starts at:
                            </p>
                          </div>
                        )}
                        <p className="text-2xl font-bold">
                          {formatCents(plan.monthlyCents)}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          or {formatCents(yearlyCents)}/yr &mdash; save {Math.round(YEARLY_DISCOUNT * 100)}%
                        </p>
                      </div>
                      <ul className="space-y-2 text-sm">
                        {PLAN_FEATURES[plan.id].map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <Check className="size-4 text-primary mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                        <li className="flex items-start gap-2 text-muted-foreground text-xs pt-1 border-t">
                          <span>
                            Email overage: {formatCents(Math.round(plan.emailOverageCentsPerEmail))}/email
                          </span>
                        </li>
                      </ul>
                      {current ? (
                        <p className="text-sm text-muted-foreground font-medium">Current plan</p>
                      ) : (
                        <button className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                          Switch to {plan.name}
                        </button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Add-ons coming soon */}
          <div>
            <h2 className="text-lg font-semibold mb-1">Add-ons</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Optional features billed on top of your base plan.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Card className="border-dashed opacity-70">
                <CardContent className="p-4 flex items-start gap-3">
                  <Truck className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Fleet Management</p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">
                        Coming soon
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Live crew GPS tracking using employee phones. Pricing TBD.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-dashed opacity-70">
                <CardContent className="p-4 flex items-start gap-3">
                  <Mail className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Email Campaigns</p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">
                        Coming soon
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Branded marketing emails sent from your business domain.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>



        </div>
      </div>
    </div>
  );
}

// Separate component to handle payment method setup with Stripe
function PaymentMethodSection({ org, isTrialing, daysLeft }: {
  org: ReturnType<typeof useOrgContext>;
  isTrialing: boolean;
  daysLeft: number | null;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPaymentMethod = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use orgId as a safe email-like identifier (Stripe accepts UUIDs in email field)
      const result = await createSignupSetupIntent(`${org.orgId}@redfoxcrm.app`);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Open Stripe card setup modal in a new window/tab
      // In production, you'd want to use Stripe.js Elements for a better UX
      const setupUrl = `${window.location.origin}/payment-setup?clientSecret=${result.clientSecret}&customerId=${result.customerId}`;
      window.open(setupUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment setup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>The card charged for your subscription and any overage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {org.cardLast4 ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <CreditCard className="size-5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium capitalize">
                  {org.cardBrand ?? 'Card'} ending in {org.cardLast4}
                </p>
                <p className="text-xs text-muted-foreground">
                  Used for your subscription and any email overage charges.
                </p>
              </div>
            </div>
            <button
              onClick={handleAddPaymentMethod}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Change'}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-medium">No payment method on file</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {isTrialing ? (
                    <>Add a card now to keep your account active after your {daysLeft}-day trial ends.</>
                  ) : (
                    <>Add a card to activate your subscription.</>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleAddPaymentMethod}
              disabled={isLoading}
              className="w-full px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              {isLoading ? 'Setting up...' : 'Add Payment Method'}
            </button>
            {error && (
              <p className="text-xs text-amber-900 bg-amber-100 border border-amber-200 rounded px-2 py-1.5">
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

