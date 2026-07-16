'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function saveCrewProfileAction(formData: FormData) {
  const employeeId = formData.get('employee_id') as string;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const adminClient = createAdminClient();

  // Find the employee row — match by employee_id param or by auth email
  let query = adminClient.from('employees').update({
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    full_name: `${formData.get('first_name')} ${formData.get('last_name')}`,
    phone: formData.get('phone') as string,
    date_of_birth: formData.get('date_of_birth') as string,
    address: formData.get('address') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    zip: formData.get('zip') as string,
    emergency_contact_name: formData.get('emergency_contact_name') as string,
    emergency_contact_phone: formData.get('emergency_contact_phone') as string,
    emergency_contact_relationship: formData.get('emergency_contact_relationship') as string,
    user_id: user.id,
    invite_accepted_at: new Date().toISOString(),
    is_active: true,
    profile_completed: true,
  });

  if (employeeId) {
    query = query.eq('id', employeeId);
  } else {
    query = query.eq('email', user.email!);
  }

  const { error } = await query;
  if (error) redirect('/crew-setup/profile?error=save_failed');

  // After profile completion, redirect to the CRM login
  redirect('/login?setup=complete');
}
