'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0f0f]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/landing" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="RedFox CRM" width={36} height={36} className="w-9 h-9" />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-extrabold text-base text-white tracking-tight">REDFOX</span>
              <span className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase">CRM</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-7">

            {/* Features */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('features')}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Features <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {openMenu === 'features' && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg z-50">
                  {[
                    ['All Features', '/landing/features'],
                    ['Scheduling', '/landing/features'],
                    ['Invoicing', '/landing/features'],
                    ['Customer Portal', '/landing/features'],
                    ['Multi-Location', '/landing/features'],
                  ].map(([label, href]) => (
                    <Link key={label} href={href} className="block px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg transition-colors">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/landing/pricing" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Pricing
            </Link>

            {/* Industries — holiday lighting + landscape only */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('industries')}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Industries <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {openMenu === 'industries' && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg z-50">
                  {[
                    ['Holiday Lighting', '#'],
                    ['Landscape Lighting', '#'],
                  ].map(([label, href]) => (
                    <Link key={label} href={href} className="block px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg transition-colors">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Resources — Help Center + API Docs only */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('resources')}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Resources <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {openMenu === 'resources' && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg z-50">
                  {[
                    ['Help Center', '/landing/support'],
                    ['API Docs', '/landing/api'],
                    ['FAQ', '/landing/faq'],
                  ].map(([label, href]) => (
                    <Link key={label} href={href} className="block px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg transition-colors">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/landing/support" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Contact
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors hidden md:block">
              Log In
            </Link>
            <Link href="/signup" className="hidden md:block">
              <Button className="bg-primary hover:bg-primary/90 text-white font-semibold px-5">
                Start Free Trial
              </Button>
            </Link>
            {/* Mobile hamburger */}
            <button
              className="md:hidden text-gray-300 hover:text-white"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 py-4 space-y-1">
            <Link href="/landing/features" className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/5">Features</Link>
            <Link href="/landing/pricing" className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/5">Pricing</Link>
            <div className="px-3 pt-2 pb-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Industries</p>
              <Link href="#" className="block py-1.5 text-sm text-gray-400 hover:text-white">Holiday Lighting</Link>
              <Link href="#" className="block py-1.5 text-sm text-gray-400 hover:text-white">Landscape Lighting</Link>
            </div>
            <div className="px-3 pt-2 pb-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Resources</p>
              <Link href="/landing/support" className="block py-1.5 text-sm text-gray-400 hover:text-white">Help Center</Link>
              <Link href="/landing/api" className="block py-1.5 text-sm text-gray-400 hover:text-white">API Docs</Link>
              <Link href="/landing/faq" className="block py-1.5 text-sm text-gray-400 hover:text-white">FAQ</Link>
            </div>
            <div className="px-3 pt-3 flex flex-col gap-2">
              <Link href="/login"><Button variant="outline" className="w-full border-white/20 text-white bg-transparent hover:bg-white/10">Log In</Button></Link>
              <Link href="/signup"><Button className="w-full bg-primary hover:bg-primary/90">Start Free Trial</Button></Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
