'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.redfoxcrm.com';

  if (!email || !password) {
    return NextResponse.redirect(`${siteUrl}/admin?error=missing_fields`, { status: 303 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.redirect(`${siteUrl}/admin?error=invalid_credentials`, { status: 303 });
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
    return NextResponse.redirect(`${siteUrl}/admin?error=unauthorized`, { status: 303 });
  }

  if (!adminRow.profile_completed) {
    return NextResponse.redirect(`${siteUrl}/admin/setup/profile`, { status: 303 });
  }

  return NextResponse.redirect(`${siteUrl}/admin/dashboard`, { status: 303 });
}
