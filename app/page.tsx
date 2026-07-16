'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      // Don't redirect away from admin routes — they guard themselves server-side
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return;
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/landing');
      }
    }
  }, [user, isLoading, router]);

  return null;
}
