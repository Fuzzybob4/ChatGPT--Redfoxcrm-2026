'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, MapPin, Users, Zap } from 'lucide-react';
import { pricingPlans } from '@/lib/data';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="RedFox" width={32} height={32} />
            <span className="font-bold text-lg text-foreground">RedFox Lighting</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Button render={<Link href="/signup" />} className="bg-primary hover:bg-primary/90">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-4 mb-16">
          <h1 className="text-4xl font-bold text-foreground">Simple, transparent pricing</h1>
          <p className="text-xl text-muted-foreground">
            Scale your holiday lighting business without breaking the bank
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Starter */}
          <div className="bg-card border border-border rounded-lg p-8 space-y-8 flex flex-col">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Starter</h3>
              <p className="text-muted-foreground">Perfect for solo operators</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">$49</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Billed monthly, cancel anytime</p>
            </div>

            <Button render={<Link href="/signup" />} variant="outline" className="w-full">
              Get Started
            </Button>

            <div className="space-y-3 flex-1">
              <p className="text-sm font-semibold text-foreground">What&apos;s included:</p>
              <ul className="space-y-2">
                {[
                  '1 Location',
                  'Up to 100 Customers',
                  'Estimates & Invoices',
                  'Customer Portal',
                  'Mobile App',
                  'Email Support',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Professional */}
          <div className="bg-card border-2 border-primary rounded-lg p-8 space-y-8 flex flex-col relative">
            <Badge className="absolute top-4 right-4 bg-primary">Popular</Badge>

            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Professional</h3>
              <p className="text-muted-foreground">For growing teams</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">$149</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Billed monthly, cancel anytime</p>
            </div>

            <Button render={<Link href="/signup" />} className="w-full bg-primary hover:bg-primary/90">
              Get Started
            </Button>

            <div className="space-y-3 flex-1">
              <p className="text-sm font-semibold text-foreground">What&apos;s included:</p>
              <ul className="space-y-2">
                {[
                  '5 Locations',
                  'Unlimited Customers',
                  'Advanced Estimates & Invoices',
                  'Crew Scheduling',
                  'Route Optimization',
                  'Customer Portal',
                  'Mobile App',
                  'Priority Support',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Enterprise */}
          <div className="bg-card border border-border rounded-lg p-8 space-y-8 flex flex-col">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Enterprise</h3>
              <p className="text-muted-foreground">For large operations</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">Custom</span>
              </div>
              <p className="text-sm text-muted-foreground">Contact us for pricing</p>
            </div>

            <Button render={<Link href="/signup" />} variant="outline" className="w-full">
              Contact Sales
            </Button>

            <div className="space-y-3 flex-1">
              <p className="text-sm font-semibold text-foreground">Everything Plus:</p>
              <ul className="space-y-2">
                {[
                  'Unlimited Locations',
                  'Unlimited Users & Customers',
                  'Custom Integrations',
                  'API Access',
                  'Advanced Analytics',
                  'SSO & Advanced Security',
                  'Dedicated Account Manager',
                  '24/7 Priority Support',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Features</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Starter</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Professional</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Locations
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">1</td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">5</td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">Unlimited</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" /> Team Members
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">Unlimited</td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">Unlimited</td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">Unlimited</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Advanced Features
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">Basic</td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">Advanced</td>
                  <td className="px-6 py-4 text-center text-sm text-muted-foreground">Custom</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Frequently asked questions</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Can I upgrade or downgrade anytime?</h3>
              <p className="text-muted-foreground">
                Yes! Upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">What&apos;s your refund policy?</h3>
              <p className="text-muted-foreground">
                We offer a 30-day money-back guarantee. If you&apos;re not satisfied, we&apos;ll refund your payment.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Do you offer discounts for annual billing?</h3>
              <p className="text-muted-foreground">
                Yes! Annual plans are 20% cheaper than monthly. Contact us for details.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Is there a free tier?</h3>
              <p className="text-muted-foreground">
                All new accounts get a 30-day free trial with full access to the Starter plan features.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Ready to get started?</h2>
          <p className="text-lg text-muted-foreground">
            Start your free 30-day trial today. No credit card required.
          </p>
          <Button render={<Link href="/signup" />} size="lg" className="bg-primary hover:bg-primary/90">
            Start Your Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 RedFox Lighting. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
