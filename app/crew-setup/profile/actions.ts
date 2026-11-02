'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { acceptCrewInviteForUser } from '@/lib/crew-invite';
import { redirect } from 'next/navigation';

export async function saveCrewProfileAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  // The employee row comes from the authenticated user's invite, never from
  // a form field (previously employee_id was posted and updated with the
  // service role, letting anyone overwrite any employee).
  const invite = await acceptCrewInviteForUser(user);
  if (!invite.ok) {
    const code = invite.error === 'server_error' ? 'save_failed' : invite.error;
    redirect(`/crew-setup/profile?error=${code}`);
  }

  const field = (name: string) => String(formData.get(name) ?? '').trim();
  const firstName = field('first_name');
  const lastName = field('last_name');
  if (!firstName || !lastName) redirect('/crew-setup/profile?error=save_failed');

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('employees')
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      phone: field('phone'),
      date_of_birth: field('date_of_birth'),
      address: field('address'),
      city: field('city'),
      state: field('state'),
      zip: field('zip'),
      emergency_contact_name: field('emergency_contact_name'),
      emergency_contact_phone: field('emergency_contact_phone'),
      emergency_contact_relationship: field('emergency_contact_relationship'),
      is_active: true,
      profile_completed: true,
    })
    .eq('id', invite.employeeId)
    .eq('user_id', user.id);

  if (error) redirect('/crew-setup/profile?error=save_failed');

  // After profile completion, redirect to the CRM login
  redirect('/login?setup=complete');
}
