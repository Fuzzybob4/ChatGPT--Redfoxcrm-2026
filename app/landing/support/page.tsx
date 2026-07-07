import Link from 'next/link';
import { Mail, MessageSquare, Phone, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Support - RedFox CRM',
  description: 'Get help from our support team. Email, chat, phone, and documentation available.',
};

export default function SupportPage() {
  const supportOptions = [
    {
      icon: MessageSquare,
      title: 'Live Chat',
      description: 'Chat with our support team in real-time (Professional & Enterprise plans)',
      availability: 'Available Monday-Friday, 9am-6pm CST',
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Send detailed questions and attachments to our support team',
      availability: 'Response within 24 hours',
    },
    {
      icon: Phone,
      title: 'Phone Support',
      description: 'Speak directly with our team (Enterprise plan only)',
      availability: 'Available Monday-Friday, 8am-7pm CST',
    },
    {
      icon: BookOpen,
      title: 'Help Center',
      description: 'Explore our comprehensive documentation and video tutorials',
      availability: 'Available 24/7',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            We're Here to Help
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our support team is ready to assist you. Choose your preferred way to get in touch.
          </p>
        </div>
      </section>

      {/* Support Options */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {supportOptions.map((option, idx) => {
            const Icon = option.icon;
            return (
              <div key={idx} className="bg-accent rounded-lg p-8">
                <Icon className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">{option.title}</h3>
                <p className="text-muted-foreground mb-4">{option.description}</p>
                <p className="text-sm text-muted-foreground">{option.availability}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact Form */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-accent rounded-lg p-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Send us a message</h2>
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="your@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Subject</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="How can we help?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Message</label>
              <textarea
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                rows={6}
                placeholder="Tell us more about your question or issue..."
              />
            </div>
            <Button size="lg" variant="default">Send Message</Button>
          </form>
        </div>
      </section>

      {/* Resources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-foreground mb-8">Additional Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-2">Help Center</h3>
            <p className="text-muted-foreground mb-4">Browse our comprehensive documentation with guides, tutorials, and FAQs.</p>
            <Link href="#" className="text-primary hover:text-primary/80 font-medium">Visit Help Center →</Link>
          </div>
          <div className="border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-2">Video Tutorials</h3>
            <p className="text-muted-foreground mb-4">Watch step-by-step video guides to learn how to use RedFox CRM features.</p>
            <Link href="#" className="text-primary hover:text-primary/80 font-medium">Watch Videos →</Link>
          </div>
          <div className="border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-2">API Documentation</h3>
            <p className="text-muted-foreground mb-4">Access our complete API docs for developers and integrations.</p>
            <Link href="/landing/api" className="text-primary hover:text-primary/80 font-medium">View API Docs →</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-accent rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to get started?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Try RedFox CRM free for 30 days. No credit card required.
          </p>
          <Link href="/signup" className="inline-block">
            <Button size="lg" variant="default">Start Free Trial</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
