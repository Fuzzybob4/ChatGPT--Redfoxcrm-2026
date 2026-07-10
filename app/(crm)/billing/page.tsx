'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard } from 'lucide-react';
import { useOrgContext } from '@/lib/org-context';
import { PLANS, getPlanChargeCents, formatCents, YEARLY_DISCOUNT } from '@/lib/pricing';
import { getTrialState } from '@/lib/trial';

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ['1 location', 'Up to 100 customers', 'Basic reporting'],
  professional: ['Multiple locations', 'Up to 1,000 customers', 'Advanced reporting', 'Priority support'],
  enterprise: ['Unlimited locations', 'Unlimited customers', 'Custom reporting', 'Dedicated support', 'API access'],
};

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
        description="Manage your subscription and billing information"
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-8">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{PLANS[currentPlanId as keyof typeof PLANS]?.name ?? 'Starter'}</p>
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
                Billing occurs on the same day each period. You can upgrade, downgrade, or cancel your subscription anytime.
              </p>
            </CardContent>
          </Card>

          {/* Available Plans */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
            <div className="grid md:grid-cols-3 gap-4">
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

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>The card charged for your subscription and add-ons</CardDescription>
            </CardHeader>
            <CardContent>
              {org.cardLast4 ? (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <CreditCard className="size-5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium capitalize">
                      {org.cardBrand ?? 'Card'} ending in {org.cardLast4}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Used for your monthly or yearly subscription charge.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No card on file yet. Add one to keep your account active after the trial.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
