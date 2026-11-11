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



export default function LandingPage() {


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
                Built for Holiday &amp; Landscape Lighting Pros
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
                RedFox CRM is the all-in-one platform built specifically for holiday lighting and landscape lighting companies.
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
