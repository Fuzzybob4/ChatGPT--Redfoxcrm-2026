'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function adminLoginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    redirect('/admin/login?error=missing_fields');
  }

  const supabase = await createClient();

  // Sign in with Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect('/admin/login?error=invalid_credentials');
  }

  // Verify this user is an active platform admin
  const adminClient = createAdminClient();
  const { data: adminRow, error: adminError } = await adminClient
    .from('platform_admins')
    .select('role, is_active')
    .eq('user_id', data.user.id)
    .single();

  if (adminError || !adminRow || !adminRow.is_active) {
    // Sign them back out immediately — not a platform admin
    await supabase.auth.signOut();
    redirect('/admin/login?error=unauthorized');
  }

  redirect('/admin');
}
