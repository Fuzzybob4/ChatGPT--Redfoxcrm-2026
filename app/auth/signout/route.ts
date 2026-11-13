import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Plain link sign-out. Ignores link prefetches so opening a menu that contains
 * "Sign out" can never log someone out by itself.
 */
export async function GET() {
  const h = await headers();
  const isPrefetch =
    h.get('next-router-prefetch') !== null ||
    h.get('purpose') === 'prefetch' ||
    h.get('sec-purpose')?.includes('prefetch') ||
    h.get('x-middleware-prefetch') !== null;
  if (isPrefetch) return new Response(null, { status: 204 });
  return signOut();
}

export async function POST() {
  return signOut();
}
