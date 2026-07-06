import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata = {
  title: 'Features - RedFox CRM',
  description: 'Discover all the features RedFox CRM offers for managing your outdoor service business.',
};

const features = [
  {
    title: 'Customer Management',
    description: 'Store all customer information, service history, photos, and notes in one place.',
    details: [
      'Multi-property support per customer',
      'Complete service history tracking',
      'Photo and attachment management',
      'Custom notes and communication logs',
      'Customer rating and feedback',
    ],
  },
  {
    title: 'Estimates & Invoicing',
    description: 'Create professional estimates and invoices in minutes with automatic calculations.',
    details: [
      'Pre-built templates for common services',
      'Line items with quantities and pricing',
      'Automatic tax calculations',
      'Discount and deposit tracking',
      'PDF generation and email delivery',
    ],
  },
  {
    title: 'Job Scheduling & Routing',
    description: 'Schedule jobs intelligently with route optimization to save time and fuel.',
    details: [
      'Drag-and-drop calendar scheduling',
      'Automatic route optimization',
      'Mobile-friendly job cards',
      'Real-time status updates',
      'Weather integration',
    ],
  },
  {
    title: 'Crew Management',
    description: 'Manage your team, track time, assign jobs, and monitor progress in real-time.',
    details: [
      'Team member profiles and availability',
      'Time tracking and labor costs',
      'Job assignment and task management',
      'Performance analytics',
      'Mobile app for field teams',
    ],
  },
  {
    title: 'Customer Portal',
    description: 'Give customers a seamless experience to track projects, pay invoices, and provide feedback.',
    details: [
      'Project status visibility',
      'Invoice viewing and payments',
      'Photo gallery of completed work',
      'Service history access',
      'Review and rating submission',
    ],
  },
  {
    title: 'Reports & Analytics',
    description: 'Make data-driven decisions with comprehensive insights into your business performance.',
    details: [
      'Revenue and profitability tracking',
      'Job completion rates',
      'Customer lifetime value',
      'Team productivity metrics',
      'Seasonal trends analysis',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Everything You Need.
            <br />
            <span className="text-primary">All in One Place.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From the first lead to the final payment, RedFox CRM helps you streamline operations, impress customers, and grow your business.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-accent rounded-lg p-8 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground mb-6">{feature.description}</p>
              <ul className="space-y-3">
                {feature.details.map((detail, didx) => (
                  <li key={didx} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Holiday Lighting Focus */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-accent rounded-lg p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Built for Holiday Lighting Professionals</h2>
          <p className="text-lg text-muted-foreground mb-8">
            RedFox CRM is purpose-built for outdoor service professionals. Whether you specialize in holiday lighting installation, roofline lights, pathway lighting, or tree wrapping, our platform has the tools you need to manage seasonal peaks and year-round growth.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <li className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Seasonal Scheduling</h4>
                <p className="text-sm text-muted-foreground">Manage peak seasons with advance planning and crew coordination.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Multi-Day Projects</h4>
                <p className="text-sm text-muted-foreground">Track complex installations across multiple days and properties.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Add-ons Management</h4>
                <p className="text-sm text-muted-foreground">Easily upsell wreaths, timers, removal services, and more.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground">Photo Documentation</h4>
                <p className="text-sm text-muted-foreground">Showcase your work with before/after photos and portfolio galleries.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Transform Your Business?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start with a free 30-day trial. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-block">
              <Button size="lg" variant="default">Start Free Trial</Button>
            </Link>
            <Link href="/landing/pricing" className="inline-block">
              <Button size="lg" variant="outline">View Pricing</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
