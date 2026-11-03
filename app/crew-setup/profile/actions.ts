'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { linkEmployeeAccount } from '@/lib/crew-accounts';
import { redirect } from 'next/navigation';

export async function saveCrewProfileAction(formData: FormData) {
  const employeeId = (formData.get('employee_id') as string) || '';

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email) redirect('/login');

  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();

  const adminClient = createAdminClient();

  // Always match on the signed-in user's own email so an employee can only
  // complete the record that was created for them.
  let query = adminClient
    .from('employees')
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      phone: formData.get('phone') as string,
      date_of_birth: (formData.get('date_of_birth') as string) || null,
      address: formData.get('address') as string,
      city: formData.get('city') as string,
      state: formData.get('state') as string,
      zip: formData.get('zip') as string,
      emergency_contact_name: formData.get('emergency_contact_name') as string,
      emergency_contact_phone: formData.get('emergency_contact_phone') as string,
      emergency_contact_relationship: formData.get('emergency_contact_relationship') as string,
      profile_completed: true,
    })
    .eq('email', user.email.toLowerCase())
    .or(`user_id.is.null,user_id.eq.${user.id}`);

  if (employeeId) query = query.eq('id', employeeId);

  const { error } = await query;
  if (error) redirect('/crew-setup/profile?error=save_failed');

  const linked = await linkEmployeeAccount(user);
  if (!linked) redirect('/crew-setup/profile?error=save_failed');

  redirect('/field');
}
