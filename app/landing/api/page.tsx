import Link from 'next/link';
import { Code, GitBranch, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'API Documentation - RedFox CRM',
  description: 'Build custom integrations with the RedFox CRM REST API. Complete documentation and code examples.',
};

export default function APIPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            API Documentation
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build custom integrations and extend RedFox CRM with our powerful REST API. Full documentation, code examples, and SDKs available.
          </p>
        </div>
      </section>

      {/* Quick Start */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-accent rounded-lg p-8">
            <Code className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">RESTful API</h3>
            <p className="text-muted-foreground">Clean, easy-to-use REST endpoints with JSON responses. Authenticate using API keys or OAuth.</p>
          </div>
          <div className="bg-accent rounded-lg p-8">
            <GitBranch className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">SDKs & Libraries</h3>
            <p className="text-muted-foreground">Official SDKs for JavaScript, Python, and Go. Community libraries available for other languages.</p>
          </div>
          <div className="bg-accent rounded-lg p-8">
            <Zap className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Webhooks</h3>
            <p className="text-muted-foreground">Real-time notifications when events occur in your RedFox account. Build reactive integrations.</p>
          </div>
        </div>
      </section>

      {/* API Sections */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {[
            {
              title: 'Authentication',
              description: 'Learn how to authenticate your API requests using API keys or OAuth 2.0.',
              endpoints: ['API Keys', 'OAuth 2.0', 'Refresh Tokens'],
            },
            {
              title: 'Customers',
              description: 'Manage customer information, properties, and service history.',
              endpoints: ['GET /customers', 'POST /customers', 'PUT /customers/:id', 'DELETE /customers/:id'],
            },
            {
              title: 'Estimates',
              description: 'Create, retrieve, and manage estimates with line items and calculations.',
              endpoints: ['GET /estimates', 'POST /estimates', 'PUT /estimates/:id', 'GET /estimates/:id/pdf'],
            },
            {
              title: 'Jobs',
              description: 'Schedule, track, and manage service jobs across your locations.',
              endpoints: ['GET /jobs', 'POST /jobs', 'PUT /jobs/:id', 'PATCH /jobs/:id/status'],
            },
            {
              title: 'Invoices',
              description: 'Generate and manage invoices with automatic calculations and payment tracking.',
              endpoints: ['GET /invoices', 'POST /invoices', 'GET /invoices/:id/pdf', 'GET /invoices/:id/payments'],
            },
            {
              title: 'Team Members',
              description: 'Manage team members, roles, and permissions across your organization.',
              endpoints: ['GET /team-members', 'POST /team-members', 'PUT /team-members/:id', 'DELETE /team-members/:id'],
            },
          ].map((section, idx) => (
            <div key={idx} className="border border-border rounded-lg p-8">
              <h3 className="text-2xl font-bold text-foreground mb-2">{section.title}</h3>
              <p className="text-muted-foreground mb-6">{section.description}</p>
              <div className="bg-background rounded p-4 font-mono text-sm text-muted-foreground space-y-1">
                {section.endpoints.map((endpoint, eidx) => (
                  <div key={eidx}>{endpoint}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Code Examples */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-foreground mb-8">Code Examples</h2>
        <div className="bg-accent rounded-lg p-8">
          <h3 className="text-xl font-semibold text-foreground mb-4">Get Started in Minutes</h3>
          <div className="bg-background rounded-lg p-4 font-mono text-sm text-muted-foreground overflow-x-auto mb-4">
            <pre>{`// Initialize the RedFox API client
const RedFoxAPI = require('@redfox/api');

const api = new RedFoxAPI({
  apiKey: 'YOUR_API_KEY'
});

// Create a new customer
const customer = await api.customers.create({
  name: 'Smith Family',
  email: 'john@example.com',
  phone: '(512) 555-1234',
  address: '123 Main St, Austin, TX 78701'
});

// Create an estimate for the customer
const estimate = await api.estimates.create({
  customerId: customer.id,
  serviceType: 'Holiday Lighting Installation',
  lineItems: [
    { description: 'Roofline Lighting', quantity: 1, unitPrice: 2450 },
    { description: 'Pathway Lights', quantity: 6, unitPrice: 120 }
  ]
});

console.log('Estimate created:', estimate.id);`}</pre>
          </div>
          <p className="text-muted-foreground text-sm">Available in JavaScript, Python, Go, and more.</p>
        </div>
      </section>

      {/* Resources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-foreground mb-8">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-2">Rate Limits</h3>
            <p className="text-muted-foreground mb-4">Understand API rate limits for different plan tiers and best practices for handling limits gracefully.</p>
            <Link href="#" className="text-primary hover:text-primary/80 font-medium">Read More →</Link>
          </div>
          <div className="border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-2">Error Handling</h3>
            <p className="text-muted-foreground mb-4">Learn about error codes, error messages, and best practices for error handling in your integration.</p>
            <Link href="#" className="text-primary hover:text-primary/80 font-medium">Read More →</Link>
          </div>
          <div className="border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-2">Webhooks Guide</h3>
            <p className="text-muted-foreground mb-4">Set up webhooks to receive real-time notifications when events occur in your RedFox account.</p>
            <Link href="#" className="text-primary hover:text-primary/80 font-medium">Read More →</Link>
          </div>
          <div className="border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-2">SDK Reference</h3>
            <p className="text-muted-foreground mb-4">Complete reference documentation for all official SDKs and third-party libraries.</p>
            <Link href="#" className="text-primary hover:text-primary/80 font-medium">Read More →</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-accent rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Build?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Get API access with a Professional or Enterprise plan. Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-block">
              <Button size="lg" variant="default">Start Free Trial</Button>
            </Link>
            <a href="#" className="inline-block">
              <Button size="lg" variant="outline">View Full Docs</Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
