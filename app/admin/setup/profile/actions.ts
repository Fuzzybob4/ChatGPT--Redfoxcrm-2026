'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function saveAdminProfileAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email) redirect('/admin');

  const adminClient = createAdminClient();
  const email = user.email.toLowerCase();
  const { data: invitation } = await adminClient
    .from('platform_admin_invitations')
    .select('id, role')
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  const profile = {
    user_id: user.id,
    email,
    role: invitation?.role ?? 'customer_service',
    is_active: true,
    name: `${formData.get('first_name')} ${formData.get('last_name')}`,
    date_of_birth: formData.get('date_of_birth') as string,
    address: formData.get('address') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    zip: formData.get('zip') as string,
    emergency_contact_name: formData.get('emergency_contact_name') as string,
    emergency_contact_phone: formData.get('emergency_contact_phone') as string,
    emergency_contact_relationship: formData.get('emergency_contact_relationship') as string,
    invite_accepted_at: new Date().toISOString(),
    profile_completed: true,
  };

  const { error } = await adminClient
    .from('platform_admins')
    .upsert(profile, { onConflict: 'user_id' });

  if (error) {
    redirect('/admin/setup/profile?error=save_failed');
  }

  if (invitation) {
    await adminClient
      .from('platform_admin_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);
  }

  redirect('/admin/dashboard');
}
