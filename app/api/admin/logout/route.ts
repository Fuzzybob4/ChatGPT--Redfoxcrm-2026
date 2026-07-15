import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
