import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { saveCrewProfileAction } from './actions';

interface Props {
  searchParams: Promise<{ employee_id?: string; error?: string }>;
}

export default async function CrewProfileSetupPage({ searchParams }: Props) {
  const { employee_id, error } = await searchParams;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#C8392B] flex items-center justify-center overflow-hidden">
              <Image src="/favicon.png" alt="RedFox" width={28} height={28} className="w-7 h-7 object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-lg text-foreground tracking-tight">REDFOX CRM</span>
              <span className="text-[9px] font-bold text-[#C8392B] tracking-[0.2em] uppercase">Employee Setup</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Almost done. We need a few details for your employee record.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#C8392B] text-white text-xs flex items-center justify-center font-bold">2</span>
              <h1 className="font-semibold text-lg text-foreground">Your information</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-7">
              Step 2 of 2 — Required for your employee record. Kept confidential and only accessible to your employer.
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              Failed to save your profile. Please try again.
            </div>
          )}

          <form action={saveCrewProfileAction} className="flex flex-col gap-5">
            <input type="hidden" name="employee_id" value={employee_id ?? ''} />

            {/* Legal name */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Legal Name</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" name="first_name" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input id="last_name" name="last_name" required />
                </div>
              </div>
            </div>

            {/* Personal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input id="date_of_birth" name="date_of_birth" type="date" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" name="phone" type="tel" required placeholder="(555) 000-0000" />
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Home Address</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="address">Street address</Label>
                  <Input id="address" name="address" required placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3 flex flex-col gap-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" name="city" required />
                  </div>
                  <div className="col-span-1 flex flex-col gap-1.5">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" name="state" required placeholder="TX" maxLength={2} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label htmlFor="zip">ZIP</Label>
                    <Input id="zip" name="zip" required placeholder="78701" />
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency contact */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Emergency Contact</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="emergency_contact_name">Full name</Label>
                    <Input id="emergency_contact_name" name="emergency_contact_name" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="emergency_contact_phone">Phone number</Label>
                    <Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" required />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                  <Input id="emergency_contact_relationship" name="emergency_contact_relationship" required placeholder="Spouse, Parent, Sibling..." />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-[#C8392B] hover:bg-[#b03223] text-white font-semibold"
            >
              Complete Setup
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your information is securely stored and only accessible to your employer.
        </p>
      </div>
    </div>
  );
}
