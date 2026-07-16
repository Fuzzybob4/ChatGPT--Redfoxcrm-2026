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

  const { data: adminRecord, error: adminQueryError } = await adminClient
    .from('platform_admins')
    .select('user_id, is_active')
    .eq('email', email)
    .maybeSingle();

  if (adminQueryError) {
    redirect('/admin?tab=request&error=server_error');
  }

  if (adminRecord && !adminRecord.is_active) {
    redirect('/admin?tab=request&error=account_deactivated');
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.redfoxcrm.com';

  if (adminRecord) {
    const supabase = await createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=/admin/setup`,
    });

    if (resetError) {
      redirect('/admin?tab=request&error=invite_failed');
    }
  } else {
    // First-time admins must have an active, unexpired invitation created by the CEO.
    const { data: invitation, error: invitationError } = await adminClient
      .from('platform_admin_invitations')
      .select('id')
      .eq('email', email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (invitationError) {
      redirect('/admin?tab=request&error=server_error');
    }

    if (!invitation) {
      redirect('/admin?tab=request&error=not_authorized');
    }

    // Check if auth account already exists (from a previous failed invite attempt)
    const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers();
    const authUserExists = authUsers?.users?.some(u => u.email?.toLowerCase() === email);

    if (authUserExists) {
      // Auth account exists — send password reset instead of invite
      const supabase = await createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm?next=/admin/setup`,
      });

      if (resetError) {
        redirect('/admin?tab=request&error=invite_failed');
      }
    } else {
      // No auth account yet — send invite
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm?next=/admin/setup`,
      });

      if (inviteError) {
        console.error('[v0] inviteUserByEmail error:', inviteError);
        redirect('/admin?tab=request&error=invite_failed');
      }
    }
  }

  redirect('/admin?tab=request&success=invite_sent');
}
