import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return NextResponse.redirect(new URL('/admin?error=missing_fields', request.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.redirect(new URL('/admin?error=invalid_credentials', request.url));
  }

  // Verify this user is an active platform admin
  const adminClient = createAdminClient();
  const { data: adminRow, error: adminError } = await adminClient
    .from('platform_admins')
    .select('role, is_active, profile_completed')
    .eq('user_id', data.user.id)
    .single();

  if (adminError || !adminRow || !adminRow.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/admin?error=unauthorized', request.url));
  }

  // Redirect to dashboard if profile is complete, otherwise to setup
  const nextUrl = adminRow.profile_completed ? '/admin/dashboard' : '/admin/setup/profile';
  const response = NextResponse.redirect(new URL(nextUrl, request.url));

  // The Supabase SSR client will have set cookies in the response headers
  // via the proxy, but we need to ensure they're in this response too
  return response;
}
