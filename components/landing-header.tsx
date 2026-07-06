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
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/landing" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo.png"
              alt="RedFox CRM"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="font-bold text-lg text-foreground hidden sm:inline">
              REDFOX<br className="hidden" />
              <span className="text-xs font-normal text-muted-foreground">CRM</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {/* Product Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Product
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute left-0 mt-0 w-48 bg-background border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {menuItems.product.map((item) => (
                  <Link
                    key={item}
                    href={`/landing/${item.toLowerCase().replace(' ', '-')}`}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/landing/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>

            <Link href="/landing/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>

            {/* Industries Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Industries
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute left-0 mt-0 w-48 bg-background border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {menuItems.industries.map((item) => (
                  <Link
                    key={item}
                    href={`/landing/industries/${item.toLowerCase().replace(' ', '-')}`}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            {/* Resources Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Resources
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute left-0 mt-0 w-48 bg-background border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {menuItems.resources.map((item) => (
                  <Link
                    key={item}
                    href={`/landing/${item.toLowerCase().replace(' ', '-')}`}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/landing/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Log In
            </Link>
            <Link href="/signup">
              <Button variant="default">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
