import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { saveAdminProfileAction } from './actions';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminProfileSetupPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/admin/login');

  // If profile already complete, skip to admin
  const adminClient = createAdminClient();
  const { data: adminRow } = await adminClient
    .from('platform_admins')
    .select('profile_completed, name')
    .eq('user_id', user.id)
    .single();

  if (!adminRow) redirect('/admin/login?error=unauthorized');
  if (adminRow.profile_completed) redirect('/admin');

  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(200,57,43,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(200,57,43,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#C8392B] flex items-center justify-center overflow-hidden">
              <Image src="/favicon.png" alt="RedFox" width={28} height={28} className="w-7 h-7 object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-lg text-white tracking-tight">REDFOX</span>
              <span className="text-[9px] font-bold text-[#C8392B] tracking-[0.2em] uppercase">Internal Portal</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center">Almost done. We need a few details for your employee record.</p>
        </div>

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#C8392B] text-white text-xs flex items-center justify-center font-bold">2</span>
              <h1 className="text-white font-semibold text-lg">Complete your profile</h1>
            </div>
            <p className="text-gray-500 text-sm ml-7">Step 2 of 2 — Required for your employee record. This information is kept confidential.</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              Failed to save profile. Please try again.
            </div>
          )}

          <form action={saveAdminProfileAction} className="flex flex-col gap-5">
            {/* Legal name */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Legal Name</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="first_name" className="text-gray-400 text-xs">First name</Label>
                  <Input id="first_name" name="first_name" required
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="last_name" className="text-gray-400 text-xs">Last name</Label>
                  <Input id="last_name" name="last_name" required
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                </div>
              </div>
            </div>

            {/* Date of birth */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date_of_birth" className="text-gray-400 text-xs font-medium">
                Date of birth
              </Label>
              <Input id="date_of_birth" name="date_of_birth" type="date" required
                className="bg-white/[0.04] border-white/[0.08] text-white focus-visible:ring-[#C8392B]/50 h-10" />
            </div>

            {/* Address */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Home Address</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="address" className="text-gray-400 text-xs">Street address</Label>
                  <Input id="address" name="address" required placeholder="123 Main St"
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                </div>
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3 flex flex-col gap-1.5">
                    <Label htmlFor="city" className="text-gray-400 text-xs">City</Label>
                    <Input id="city" name="city" required
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                  </div>
                  <div className="col-span-1 flex flex-col gap-1.5">
                    <Label htmlFor="state" className="text-gray-400 text-xs">State</Label>
                    <Input id="state" name="state" required placeholder="TX" maxLength={2}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label htmlFor="zip" className="text-gray-400 text-xs">ZIP</Label>
                    <Input id="zip" name="zip" required placeholder="78701"
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency contact */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emergency Contact</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="emergency_contact_name" className="text-gray-400 text-xs">Full name</Label>
                    <Input id="emergency_contact_name" name="emergency_contact_name" required
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="emergency_contact_phone" className="text-gray-400 text-xs">Phone number</Label>
                    <Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" required
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emergency_contact_relationship" className="text-gray-400 text-xs">Relationship</Label>
                  <Input id="emergency_contact_relationship" name="emergency_contact_relationship" required
                    placeholder="Spouse, Parent, Sibling..."
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-gray-600 focus-visible:ring-[#C8392B]/50 h-10" />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-[#C8392B] hover:bg-[#b03223] text-white font-semibold shadow-lg shadow-red-900/30 transition-colors"
            >
              Complete Setup & Enter Portal
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Your information is stored securely and only accessible to RedFox leadership.
        </p>
      </div>
    </div>
  );
}
