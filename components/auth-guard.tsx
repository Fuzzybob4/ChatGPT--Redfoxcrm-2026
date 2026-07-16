'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    // If not logged in and trying to access protected route, redirect to login
    const publicRoutes = ['/auth', '/login', '/signup', '/landing', '/features', '/pricing', '/faq', '/support', '/api', '/privacy', '/terms', '/admin/login', '/admin/setup', '/crew-setup'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
    
    if (!user && !isPublicRoute) {
      router.push('/login');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return children;
}
