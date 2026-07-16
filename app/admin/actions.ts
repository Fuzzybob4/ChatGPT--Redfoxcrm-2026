'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function adminLoginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    redirect('/admin?error=missing_fields');
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect('/admin?error=invalid_credentials');
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
    redirect('/admin?error=unauthorized');
  }

  // First-time login — send them to complete their profile
  if (!adminRow.profile_completed) {
    redirect('/admin/setup/profile');
  }

  redirect('/admin/dashboard');
}

export async function adminRequestAccessAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email) {
    redirect('/admin?tab=request&error=missing_email');
  }

  const adminClient = createAdminClient();

  // FIRST: Verify email is in platform_admins (pre-approved by CEO)
  const { data: adminRecord, error: adminQueryError } = await adminClient
    .from('platform_admins')
    .select('id, is_active')
    .eq('email', email)
    .maybeSingle();

  if (adminQueryError) {
    console.error('[v0] platform_admins query error:', adminQueryError);
    redirect('/admin?tab=request&error=server_error');
  }

  if (!adminRecord) {
    redirect('/admin?tab=request&error=not_authorized');
  }

  if (!adminRecord.is_active) {
    redirect('/admin?tab=request&error=account_deactivated');
  }

  // Email is approved — check if auth user exists via email lookup (faster than listUsers)
  const { data: existingUser, error: lookupError } = await adminClient.auth.admin.getUserByEmail(email);
  
  if (lookupError && lookupError.status !== 404) {
    // Real error, not just "user not found"
    console.error('[v0] getUserByEmail error:', lookupError);
    redirect('/admin?tab=request&error=server_error');
  }

  if (existingUser) {
    // Auth user exists — send password reset link
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/setup`,
      },
    });
    if (resetError) {
      console.error('[v0] generateLink error:', resetError);
      redirect('/admin?tab=request&error=invite_failed');
    }
  } else {
    // No auth user yet — send invite
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/setup`,
    });
    if (inviteError) {
      console.error('[v0] inviteUserByEmail error:', inviteError);
      redirect('/admin?tab=request&error=invite_failed');
    }
  }

  redirect('/admin?tab=request&success=invite_sent');
}
