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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect('/admin/login?error=invalid_credentials');
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
    redirect('/admin/login?error=unauthorized');
  }

  // First-time login — send them to complete their profile
  if (!adminRow.profile_completed) {
    redirect('/admin/setup/profile');
  }

  redirect('/admin');
}

export async function adminRequestAccessAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email) {
    redirect('/admin/login?tab=request&error=missing_email');
  }

  const adminClient = createAdminClient();

  // FIRST: Verify email is in platform_admins (pre-approved by CEO)
  const { data: adminRecord, error: adminQueryError } = await adminClient
    .from('platform_admins')
    .select('id, is_active')
    .eq('email', email)
    .maybeSingle();

  if (adminQueryError) {
    console.error('[v0] Error checking platform_admins:', adminQueryError);
    redirect('/admin/login?tab=request&error=server_error');
  }

  if (!adminRecord) {
    // Email is not in platform_admins — not authorized
    redirect('/admin/login?tab=request&error=not_authorized');
  }

  if (!adminRecord.is_active) {
    // Account is deactivated
    redirect('/admin/login?tab=request&error=account_deactivated');
  }

  // Email is approved — look up auth user
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('[v0] Error listing users:', listError);
    redirect('/admin/login?tab=request&error=server_error');
  }

  const authUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === email
  );

  if (!authUser) {
    // No auth account found — send a Supabase invite so they can set a password
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/setup`,
    });
    if (inviteError) {
      console.error('[v0] Error sending invite:', inviteError);
      redirect('/admin/login?tab=request&error=invite_failed');
    }
  } else {
    // Auth account exists — send a password reset / setup email
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/setup`,
      },
    });
    if (resetError) {
      console.error('[v0] Error generating reset link:', resetError);
      redirect('/admin/login?tab=request&error=invite_failed');
    }
  }

  redirect('/admin/login?tab=request&success=invite_sent');
}
