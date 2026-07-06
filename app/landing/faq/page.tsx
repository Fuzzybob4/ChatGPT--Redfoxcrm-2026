import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'FAQ - RedFox CRM',
  description: 'Find answers to frequently asked questions about RedFox CRM.',
};

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is RedFox CRM?',
        a: 'RedFox CRM is an all-in-one business management platform built specifically for outdoor service professionals, including holiday lighting installers, lawn care companies, HVAC contractors, and pest control services.',
      },
      {
        q: 'How long is the free trial?',
        a: 'All new accounts get a 30-day free trial with full access to all features in the Starter plan. No credit card required to start.',
      },
      {
        q: 'Do I need technical skills to use RedFox?',
        a: 'No! RedFox is designed to be user-friendly and intuitive. Our onboarding process walks you through setup in minutes, and we offer support to help you get started.',
      },
    ],
  },
  {
    category: 'Features & Functionality',
    questions: [
      {
        q: 'Can I manage multiple locations?',
        a: 'Yes! The Professional plan includes up to 5 locations, and Enterprise plans support unlimited locations. Each location has its own team members, customers, and schedules.',
      },
      {
        q: 'Does RedFox have a mobile app?',
        a: 'Yes! RedFox includes a mobile app for both iOS and Android. Your field teams can access job details, update status, capture photos, and mark jobs as complete on the go.',
      },
      {
        q: 'Can customers pay invoices through the portal?',
        a: 'Absolutely! The customer portal includes payment processing. Customers can view invoices, pay online, and get updated with project progress and photos.',
      },
      {
        q: 'Does RedFox integrate with other tools?',
        a: 'Yes! RedFox integrates with popular accounting software, payment processors, and communication tools. Enterprise plans include custom API access for unlimited integrations.',
      },
    ],
  },
  {
    category: 'Billing & Pricing',
    questions: [
      {
        q: 'Can I change my plan anytime?',
        a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate charges accordingly.',
      },
      {
        q: 'Do you offer annual billing discounts?',
        a: 'Yes! Annual plans are 15% cheaper than monthly billing. Contact our sales team for details.',
      },
      {
        q: 'What happens after my free trial ends?',
        a: 'After 30 days, your trial converts to a paid plan. We\'ll notify you before the trial ends so you can choose your plan or cancel if needed.',
      },
      {
        q: 'Is there a cancellation fee?',
        a: 'No! You can cancel anytime without penalties. Your account remains active through the end of your billing cycle.',
      },
    ],
  },
  {
    category: 'Support & Security',
    questions: [
      {
        q: 'How do I get help?',
        a: 'Starter plans include email support, Professional plans include chat and email support, and Enterprise plans include phone support. We also offer a comprehensive help center and video tutorials.',
      },
      {
        q: 'Is my data secure?',
        a: 'Yes! RedFox uses industry-standard encryption, regular security audits, and complies with GDPR and SOC 2 requirements. Enterprise plans include advanced security features.',
      },
      {
        q: 'What if I need training for my team?',
        a: 'We offer onboarding support for all plans, live webinars, video tutorials, and detailed documentation. Enterprise plans include dedicated training sessions.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about RedFox CRM. Can't find what you're looking for? Contact our support team.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-12">
          {faqs.map((category, idx) => (
            <div key={idx}>
              <h2 className="text-2xl font-bold text-foreground mb-6">{category.category}</h2>
              <div className="space-y-4">
                {category.questions.map((item, qidx) => (
                  <div key={qidx} className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-foreground mb-2">{item.q}</h3>
                    <p className="text-muted-foreground">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-accent rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Still have questions?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Our support team is here to help. Reach out anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/landing/support" className="inline-block">
              <Button size="lg" variant="default">Contact Support</Button>
            </Link>
            <Link href="/signup" className="inline-block">
              <Button size="lg" variant="outline">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
