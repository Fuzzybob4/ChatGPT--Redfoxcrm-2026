'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Users,
  Calendar,
  DollarSign,
  MapPin,
  BarChart3,
  Star,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Gift,
  UserCheck,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';

const stats = [
  { icon: Users, value: '1000+', label: 'Active Companies' },
  { icon: DollarSign, value: '$250M+', label: 'Revenue Managed', accent: true },
  { icon: CheckCircle2, value: '50,000+', label: 'Jobs Completed' },
  { icon: Star, value: '4.9/5', label: 'Average Rating', accent: true },
  { icon: Clock, value: '10,000+', label: 'Hours Saved' },
];

const features = [
  {
    icon: UserCheck,
    title: 'Customer Management',
    description: 'Store all customer info, service history, photos, and notes in one place.',
  },
  {
    icon: DollarSign,
    title: 'Estimates & Invoices',
    description: 'Create beautiful proposals and invoices in minutes. Get paid faster.',
  },
  {
    icon: Calendar,
    title: 'Scheduling & Routing',
    description: 'Drag & drop scheduling with smart routing to save time and fuel.',
  },
  {
    icon: Users,
    title: 'Crew Management',
    description: 'Manage your team, track time, assign jobs, and monitor progress.',
  },
  {
    icon: Lightbulb,
    title: 'Customer Portal',
    description: 'Give your customers a seamless experience to approve, pay & more.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Insights',
    description: 'See what\'s working. Make smarter decisions with real-time data.',
  },
];

const testimonials = [
  {
    quote: '"RedFox CRM has completely transformed how we run our business. We save hours every week and our customers love the professional experience."',
    name: 'Luke C.',
    company: 'Lone Star Lighting Displays',
    initials: 'LC',
  },
  {
    quote: '"Finally, a CRM built specifically for our industry. The scheduling and routing features are game changers."',
    name: 'Emily L.',
    company: 'Enchanted Lighting Co.',
    initials: 'EL',
  },
  {
    quote: '"The customer portal and automated payments have been huge for our cash flow. I wish we had switched sooner!"',
    name: 'Justin G.',
    company: 'J&J Outdoor Services',
    initials: 'JG',
  },
  {
    quote: '"We run 4 crews across 2 cities and RedFox keeps everything coordinated. The multi-location feature alone is worth it."',
    name: 'Maria T.',
    company: 'Premier Holiday Lights',
    initials: 'MT',
  },
];

export default function LandingPage() {
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const visibleTestimonials = [
    testimonials[testimonialIndex % testimonials.length],
    testimonials[(testimonialIndex + 1) % testimonials.length],
    testimonials[(testimonialIndex + 2) % testimonials.length],
  ];

  return (
    <div className="overflow-hidden">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative bg-[#0f0f0f] text-white overflow-hidden">
        {/* subtle background grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(#e5222233 1px, transparent 1px), linear-gradient(90deg, #e5222233 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-0 lg:pt-20">
          <div className="grid lg:grid-cols-2 gap-12 items-end">

            {/* Left copy */}
            <div className="pb-20 space-y-8">
              <div className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full">
                Built for Outdoor Service Pros
              </div>

              <div className="space-y-3">
                <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.05] text-balance">
                  Run Your Business.
                </h1>
                <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.05] text-balance">
                  Grow Your <span className="text-primary">Profits.</span>
                </h1>
              </div>

              <p className="text-lg text-gray-300 max-w-md leading-relaxed">
                RedFox CRM is the all-in-one platform for holiday lighting, landscape, and outdoor service companies.
              </p>

              <ul className="space-y-3">
                {[
                  'Manage customers, jobs & crews',
                  'Create estimates & invoices in minutes',
                  'Schedule smarter & get paid faster',
                  'Delight customers & get more reviews',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href="/signup">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 h-12">
                    Start Your Free Trial
                  </Button>
                </Link>
                <Link href="#">
                  <Button size="lg" variant="ghost" className="border border-white/50 text-white bg-white/10 hover:bg-white/20 hover:text-white h-12 px-8 gap-2">
                    <Calendar className="w-4 h-4" />
                    Book a Demo
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 text-xs text-gray-400 pt-1">
                <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> 30-Day Free Trial</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Cancel Anytime</span>
              </div>
            </div>

            {/* Right — product screenshot */}
            <div className="relative flex items-end justify-center lg:justify-end pb-0">
              <div className="relative w-full max-w-2xl">
                {/* Glow effect behind image */}
                <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-3xl scale-95 translate-y-4" />
                <Image
                  src="/hero-screenshot.png"
                  alt="RedFox CRM map and route planning feature"
                  width={900}
                  height={620}
                  className="relative z-10 w-full rounded-xl shadow-2xl border border-white/10"
                  priority
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── TRUST BAR — hidden until we have real numbers ─────────── */}
      <section className="bg-white border-y border-gray-200 py-12 hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-10">
            Trusted by Outdoor Service Professionals
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-8">
            {stats.map(({ icon: Icon, value, label, accent }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${accent ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <p className="text-2xl font-extrabold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12 items-start">

            {/* Left headline */}
            <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-24">
              <h2 className="text-4xl font-extrabold text-gray-900 text-balance leading-tight">
                Everything You Need.<br />All in One Place.
              </h2>
              <div className="w-12 h-1 bg-primary rounded" />
              <p className="text-base text-gray-500 leading-relaxed">
                From the first lead to the final payment, RedFox CRM helps you streamline operations, impress your customers, and grow your business.
              </p>
              <Link href="/landing/features">
                <Button variant="default" className="gap-2 mt-2">
                  Explore Features <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Right feature grid */}
            <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className="group border border-gray-100 rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all bg-white">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS — hidden until we have real reviews ──────── */}
      <section className="bg-[#0f0f0f] py-24 hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-white mb-3">Loved by Business Owners</h2>
            <div className="w-12 h-1 bg-primary rounded mx-auto" />
          </div>

          <div className="relative flex items-center gap-4">
            <button
              onClick={() => setTestimonialIndex((i) => (i - 1 + testimonials.length) % testimonials.length)}
              className="shrink-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="grid sm:grid-cols-3 gap-4 flex-1 overflow-hidden">
              {visibleTestimonials.map((t, i) => (
                <div key={i} className="bg-[#1a1a1a] rounded-xl p-6 border border-white/10 space-y-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{t.quote}</p>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setTestimonialIndex((i) => (i + 1) % testimonials.length)}
              className="shrink-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FREE TRIAL CTA ───────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 border border-gray-200 rounded-2xl p-12">

            {/* Left */}
            <div className="flex items-center gap-6 shrink-0">
              <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center shrink-0">
                <Gift className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900">Start Your 30-Day</h2>
                <h2 className="text-3xl font-extrabold text-gray-900">Free Trial Today</h2>
                <p className="text-sm text-gray-500 mt-2">No credit card required. Cancel anytime.</p>
              </div>
            </div>

            {/* Middle checklist */}
            <ul className="space-y-3 shrink-0">
              {['Full access to all features', '30 days free, then choose your plan', 'Free onboarding & support'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Right CTAs */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <Link href="/signup" className="w-full">
                <Button size="lg" className="w-full px-10 h-12 text-base font-semibold">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="#" className="flex items-center gap-1.5 text-primary text-sm font-semibold hover:underline">
                Book A Demo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
