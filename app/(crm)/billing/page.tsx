'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrgContext } from '@/lib/org-context';

export default function BillingPage() {
  const org = useOrgContext();

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for small businesses',
      price: '$29/month',
      features: ['1 Location', 'Up to 100 customers', 'Basic reporting'],
      current: !org.isEnterprise && org.locationCount === 1,
    },
    {
      name: 'Professional',
      description: 'For growing businesses',
      price: '$79/month',
      features: ['Multiple locations', 'Up to 1000 customers', 'Advanced reporting', 'Priority support'],
      current: !org.isEnterprise && org.locationCount > 1,
    },
    {
      name: 'Enterprise',
      description: 'For large organizations',
      price: 'Custom',
      features: ['Unlimited locations', 'Unlimited customers', 'Custom reporting', 'Dedicated support', 'API access'],
      current: org.isEnterprise,
    },
  ];

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
                  <p className="text-lg font-semibold">
                    {org.isEnterprise ? 'Enterprise' : org.locationCount > 1 ? 'Professional' : 'Starter'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {org.locationCount} location{org.locationCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Billing occurs monthly on the same day each month. You can upgrade, downgrade, or cancel your subscription anytime.
              </p>
            </CardContent>
          </Card>

          {/* Available Plans */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card key={plan.name} className={plan.current ? 'ring-2 ring-primary' : ''}>
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-2xl font-bold">{plan.price}</p>
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <span className="text-primary mt-1">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.current ? (
                      <p className="text-sm text-muted-foreground font-medium">Current plan</p>
                    ) : (
                      <button className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                        Upgrade
                      </button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Update your billing information</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Payment method setup coming soon. Contact support for billing inquiries.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
