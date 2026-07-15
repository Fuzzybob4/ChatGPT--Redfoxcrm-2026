'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function LandingFooter() {
  return (
    <footer className="bg-[#0f0f0f] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/landing" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="RedFox CRM"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-base text-white tracking-tight">REDFOX</span>
                <span className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase">CRM</span>
              </div>
            </Link>
            <p className="text-sm text-gray-400 max-w-xs">
              The all-in-one CRM for outdoor service pros who want to work smarter and grow faster.
            </p>
            <div className="flex gap-4 pt-2">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <span className="sr-only">Facebook</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <span className="sr-only">Instagram</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" /></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <span className="sr-only">YouTube</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Product</h3>
            <ul className="space-y-3">
              <li><Link href="/landing/features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/landing/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Changelog</Link></li>
              <li><Link href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Integrations</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Company</h3>
            <ul className="space-y-3">
              <li><Link href="#" className="text-sm text-gray-400 hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="/landing/support" className="text-sm text-gray-400 hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Partners</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Resources</h3>
            <ul className="space-y-3">
              <li><Link href="/landing/support" className="text-sm text-gray-400 hover:text-white transition-colors">Help Center</Link></li>
              <li><Link href="/landing/api" className="text-sm text-gray-400 hover:text-white transition-colors">API Docs</Link></li>
              <li><Link href="/landing/faq" className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Stay Updated</h3>
            <p className="text-sm text-gray-400 mb-3">Get tips, updates, and industry insights delivered to your inbox.</p>
            <form className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-10 text-sm"
              />
              <Button variant="default" size="sm">Subscribe</Button>
            </form>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © 2025 RedFox CRM. All rights reserved.
            {/* Hidden admin entry — discoverable on mobile and hover */}
            <Link
              href="/admin/login"
              className="inline-block w-3 h-3 rounded-full bg-transparent ml-2 opacity-20 sm:opacity-0 hover:opacity-100 hover:bg-[#C8392B] transition-opacity duration-200 cursor-pointer"
              title="Admin portal"
              tabIndex={0}
            />
          </p>
          <div className="flex gap-6">
            <Link href="/landing/privacy" className="text-sm text-gray-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/landing/terms" className="text-sm text-gray-500 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
