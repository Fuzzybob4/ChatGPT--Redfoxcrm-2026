import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Pricing - RedFox CRM',
  description: 'Choose the perfect plan for your outdoor service business. All plans include a 30-day free trial.',
};

const plans = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'Perfect for solo operators and small teams',
    features: [
      '1 Location',
      'Up to 3 team members',
      'Up to 3,000 customers & properties',
      'Basic scheduling',
      'Estimates & invoicing',
      'Mobile app access',
      'Email support',
      'Monthly reports',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$149',
    period: '/month',
    description: 'For growing businesses with multiple crews',
    features: [
      'Up to 5 locations',
      'Up to 20 team members',
      'Up to 15,000 customers & properties',
      'Advanced scheduling & routing',
      'Estimates & invoicing',
      'Customer portal',
      'Mobile app access',
      'Photo documentation',
      'Performance analytics',
      'Priority email & chat support',
      'Weekly reports',
      'API access',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/month starting',
    description: 'For large organizations needing custom solutions',
    features: [
      'Unlimited locations',
      'Unlimited team members',
      'Unlimited customers & properties',
      'White-label options',
      'Custom integrations (QuickBooks, Stripe & more)',
      'Dedicated account manager',
      'Custom reporting',
      'Advanced security features',
      'Phone & prioritized support',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const addons = [
  {
    name: 'Recurring Services',
    price: '$29',
    description: 'Manage recurring service contracts and billing cycles',
  },
  {
    name: 'Route Optimization',
    price: '$49',
    description: 'Optimize routes for your crews to save time and fuel',
  },
  {
    name: 'Customer Portal Upsells',
    price: '$19',
    description: 'Allow customers to add optional services when paying invoices',
  },
  {
    name: 'SMS Notifications',
    price: '$29',
    description: 'Send text messages to customers about jobs and appointments',
  },
  {
    name: 'Email Campaigns',
    price: '$19',
    description: 'Send marketing emails and newsletters to customers',
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your business. All plans include a 30-day free trial with full access to all features.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`rounded-lg border transition-all ${
                plan.highlighted
                  ? 'border-primary bg-primary/5 shadow-xl'
                  : 'border-border bg-background'
              } p-8`}
            >
              {plan.highlighted && (
                <div className="inline-block bg-primary text-background px-3 py-1 rounded-full text-xs font-semibold mb-4">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

              <div className="mb-8">
                <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground ml-2">{plan.period}</span>
              </div>

              <Link href="/signup" className="w-full mb-8 block">
                <Button
                  variant={plan.highlighted ? 'default' : 'outline'}
                  size="lg"
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>

              <div className="space-y-4">
                {plan.features.map((feature, fidx) => (
                  <div key={fidx} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add-On Services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground mb-3">Power Up With Add-Ons</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Toggle these services on anytime from your dashboard. Add only what your business needs — cancel anytime.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {addons.map((addon) => (
            <div
              key={addon.name}
              className="rounded-lg border border-border bg-background p-6 flex flex-col gap-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-foreground">{addon.name}</h3>
                <span className="text-primary font-bold whitespace-nowrap">{addon.price}<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{addon.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-accent rounded-lg p-8">
          <h2 className="text-3xl font-bold text-foreground mb-8">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold text-foreground">Starter</th>
                  <th className="text-center py-3 px-4 font-semibold text-foreground">Professional</th>
                  <th className="text-center py-3 px-4 font-semibold text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Locations', '1', '5', 'Unlimited'],
                  ['Team Members', '3', '20', 'Unlimited'],
                  ['Customers & Properties', '3,000', '15,000', 'Unlimited'],
                  ['Estimates & Invoicing', '✓', '✓', '✓'],
                  ['Job Scheduling', 'Basic', 'Advanced', 'Advanced'],
                  ['Route Optimization', '—', '✓', '✓'],
                  ['Customer Portal', '—', '✓', '✓'],
                  ['Mobile App', '✓', '✓', '✓'],
                  ['Analytics & Reports', 'Monthly', 'Weekly', 'Custom'],
                  ['API Access', '—', '✓', '✓'],
                  ['White Label', '—', '—', '✓'],
                  ['Dedicated Support', '—', '✓', '✓'],
                ].map((row, ridx) => (
                  <tr key={ridx} className="border-b border-border hover:bg-background/50 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{row[0]}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{row[1]}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{row[2]}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-accent rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join 1000+ outdoor service companies already growing with RedFox CRM.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-block">
              <Button size="lg" variant="default">Start Your Free Trial</Button>
            </Link>
            <a href="#" className="inline-block">
              <Button size="lg" variant="outline">Schedule a Demo</Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
