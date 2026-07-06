'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Zap, Users, Calendar, DollarSign, MapPin, Lightbulb } from 'lucide-react';

export default function LandingPage() {
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
                Holiday Lighting CRM
              </h1>
              <p className="text-xl text-muted-foreground">
                Manage estimates, schedules, crews, and payments for your holiday lighting business.
                Everything you need in one beautiful platform.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button render={<Link href="/signup" />} size="lg" className="bg-primary hover:bg-primary/90">
                Start Free Trial
              </Button>
              <Button render={<Link href="/pricing" />} variant="outline" size="lg">
                View Pricing
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No credit card required. 30 days free. Cancel anytime.
            </p>
          </div>
          <div className="bg-gradient-to-b from-primary/10 to-primary/5 rounded-lg p-8 aspect-square flex items-center justify-center">
            <div className="text-center">
              <Lightbulb className="w-32 h-32 text-primary mx-auto opacity-50 mb-4" />
              <p className="text-muted-foreground">Holiday Lighting Installation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Everything you need to run your business
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="bg-primary/10 w-12 h-12 rounded flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Smart Estimates</h3>
              <p className="text-muted-foreground">
                Create professional estimates with line items, add-ons, and discounts. Convert estimates to invoices instantly.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-primary/10 w-12 h-12 rounded flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Scheduling</h3>
              <p className="text-muted-foreground">
                Visualize your schedule daily, weekly, or monthly. Assign crews, route optimize, and manage resources.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-primary/10 w-12 h-12 rounded flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Customer Portal</h3>
              <p className="text-muted-foreground">
                Let customers track projects, pay online, and view photos. Reduce support emails.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-primary/10 w-12 h-12 rounded flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Multi-Location</h3>
              <p className="text-muted-foreground">
                Manage unlimited locations with separate teams, budgets, and reporting. Enterprise scaling.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-primary/10 w-12 h-12 rounded flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Invoicing & Payments</h3>
              <p className="text-muted-foreground">
                Professional invoices, payment tracking, and automated reminders. Get paid faster.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-primary/10 w-12 h-12 rounded flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Mobile App</h3>
              <p className="text-muted-foreground">
                Access everything on the go. Check schedules, update job status, and capture photos from anywhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Ready to grow your business?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join hundreds of holiday lighting companies using RedFox to streamline operations and increase profitability.
          </p>
          <Button render={<Link href="/signup" />} size="lg" className="bg-primary hover:bg-primary/90">
            Start Your Free Trial Today
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
