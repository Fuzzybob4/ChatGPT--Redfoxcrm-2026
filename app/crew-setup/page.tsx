'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function CrewSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get('employee_id') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    const confirm = form.get('confirm') as string;

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push(`/crew-setup/profile${employeeId ? `?employee_id=${employeeId}` : ''}`);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
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
            Welcome to the team! Let&apos;s get your account set up.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#C8392B] text-white text-xs flex items-center justify-center font-bold">1</span>
              <h1 className="font-semibold text-lg text-foreground">Set your password</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-7">Step 1 of 2 — Choose a secure password for your account.</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Minimum 8 characters" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required placeholder="Re-enter password" />
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-10 mt-2 bg-[#C8392B] hover:bg-[#b03223] text-white font-semibold"
            >
              {isPending ? 'Saving...' : 'Set Password & Continue'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
