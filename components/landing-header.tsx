'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingHeader() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const menuItems = {
    product: ['Features', 'Pricing', 'Changelog', 'Integrations'],
    industries: ['Lawn Care', 'Holiday Lighting', 'Pest Control', 'HVAC'],
    resources: ['Help Center', 'Blog', 'Guides', 'Webinars'],
    company: ['About Us', 'Careers', 'Contact', 'Partners'],
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/landing" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo.png"
              alt="RedFox CRM"
              width={36}
              height={36}
              className="w-9 h-9"
            />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-extrabold text-base text-gray-900 tracking-tight">REDFOX</span>
              <span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">CRM</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-7">
            {/* Product Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Product
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {menuItems.product.map((item) => (
                  <Link
                    key={item}
                    href={`/landing/${item.toLowerCase().replace(' ', '-')}`}
                    className="block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            {/* Features Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Features
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {['All Features', 'Scheduling', 'Invoicing', 'Customer Portal', 'Multi-Location'].map((item) => (
                  <Link
                    key={item}
                    href="/landing/features"
                    className="block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/landing/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>

            {/* Industries Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Industries
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {menuItems.industries.map((item) => (
                  <Link
                    key={item}
                    href="#"
                    className="block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            {/* Resources Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Resources
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {[['Help Center', '/landing/support'], ['API Docs', '/landing/api'], ['Guides', '#'], ['Webinars', '#']].map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              About
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              Log In
            </Link>
            <Link href="/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white font-semibold px-5">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
